import * as DataLoader from 'dataloader';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  groupBy,
  find,
  mapValues,
  map,
  isEmpty,
  uniqWith,
  isEqual,
} from 'lodash';

export type Options = {
  readonly client: DynamoDB;
};

export type ItemToGet<T> = {
  readonly table: string;
  readonly key: Partial<T>;
};

const MAX_BATCH_SIZE = 100;

export function createDataLoader<T>(options: Options) {
  // Keep a local reference to the client so that it cannot be
  // changed by the caller after creating the data loader
  const client = options.client;
  const loader = new DataLoader<ItemToGet<T>, T | null>(
    async (itemsToGet) => {
      // DynamoDB does not allow duplicate keys in the batchGet requests
      // do de-duplicate the keys before building the request
      const uniqueKeys = uniqWith(itemsToGet, isEqual);

      // Groups the items together by table into the request format that
      // DynamoDB expects
      const itemsByTable = groupBy(uniqueKeys, 'table');
      const requestItems = mapValues(
        itemsByTable,
        (itemsToGet: ItemToGet<T>[]) => {
          return { Keys: map(itemsToGet, 'key').map((key) => marshall(key)) };
        }
      );

      // Perform the batch lookup
      const results = await client.batchGetItem({ RequestItems: requestItems });

      // Map the results from DyanmoDB into an array of results in the same
      // order as the requested items
      return itemsToGet.map((itemToGet: ItemToGet<T>) => {
        if (results.Responses) {
          const rawTableResults = results.Responses[itemToGet.table];

          // Check if the item was found
          if (rawTableResults) {
            const tableResults = rawTableResults.map((item) =>
              unmarshall(item)
            );
            const itemResult = find(tableResults, itemToGet.key);
            if (itemResult) {
              return itemResult as T;
            }
          }
        }

        // If there are any unprocessed keys, treat them as failures that can
        // be retried
        if (results.UnprocessedKeys && !isEmpty(results.UnprocessedKeys)) {
          const rawTableResults = results.UnprocessedKeys[itemToGet.table];
          if (rawTableResults && rawTableResults.Keys) {
            const itemResult = find(
              rawTableResults.Keys.map((item) => unmarshall(item)),
              itemToGet.key
            );
            if (itemResult) return new Error('The item was not processed');
          }
        }

        return null;
      });
    },
    { maxBatchSize: MAX_BATCH_SIZE }
  );

  return loader;
}
