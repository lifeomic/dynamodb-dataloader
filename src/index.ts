import * as DataLoader from 'dataloader';
import { DynamoDB } from 'aws-sdk';
import {
  Key,
  AttributeMap,
  KeysAndAttributes,
  BatchGetRequestMap
} from 'aws-sdk/clients/dynamodb';
import {
  groupBy,
  find,
  mapValues,
  map,
  isEmpty,
  uniqWith,
  isEqual
} from 'lodash';

export type Options = {
  readonly client: DynamoDB;
};

export type ItemToGet = {
  readonly table: string;
  readonly key: Key;
};

const MAX_BATCH_SIZE = 100;

export function createDataLoader(options: Options) {
  // Keep a local reference to the client so that it cannot be
  // changed by the caller after creating the data loader
  const client = options.client;
  const loader = new DataLoader<ItemToGet, AttributeMap | null>(
    async (itemsToGet) => {
      // DynamoDB does not allow duplicate keys in the batchGet requests
      // do de-duplicate the keys before building the request
      const uniqueKeys = uniqWith(itemsToGet, isEqual);

      // Groups the items together by table into the request format that
      // DynamoDB expects
      const itemsByTable = groupBy(uniqueKeys, 'table');
      const requestItems: BatchGetRequestMap = mapValues(
        itemsByTable,
        (itemsToGet: ItemToGet[]): KeysAndAttributes => {
          return { Keys: map(itemsToGet, 'key') };
        }
      );

      // Perform the batch lookup
      const results = await client
        .batchGetItem({ RequestItems: requestItems })
        .promise();

      // Map the results from DyanmoDB into an array of results in the same
      // order as the requested items
      return itemsToGet.map((itemToGet: ItemToGet) => {
        if (results.Responses) {
          const tableResults = results.Responses[itemToGet.table];

          // Check if the item was found
          if (tableResults) {
            const itemResult = find(tableResults, itemToGet.key);
            if (itemResult) return itemResult;
          }
        }

        // If there are any unprocessed keys, treat them as failures that can
        // be retried
        if (results.UnprocessedKeys && !isEmpty(results.UnprocessedKeys)) {
          const tableResults = results.UnprocessedKeys[itemToGet.table];
          if (tableResults) {
            const itemResult = find(tableResults.Keys, itemToGet.key);
            if (itemResult) return new Error('The item was not processed');
          }
        }

        return null;
      });
    }, { maxBatchSize: MAX_BATCH_SIZE }
  );

  return loader;
}
