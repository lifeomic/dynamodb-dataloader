import * as DataLoader from 'dataloader';
import { DynamoDB } from 'aws-sdk';
import {
  Key,
  AttributeMap,
  BatchGetRequestMap,
} from 'aws-sdk/clients/dynamodb';
import {
  chunk,
  groupBy,
  find,
  mapValues,
  map,
  uniqWith,
  isEqual,
} from 'lodash';

export type Options = {
  readonly client: DynamoDB;
};

export type ItemToGet = {
  readonly table: string;
  readonly key: Key;
};

const MAX_BATCH_SIZE = 500;

export function createDataLoader(options: Options) {
  // Keep a local reference to the client so that it cannot be
  // changed by the caller after creating the data loader
  const client = options.client;
  const loader = new DataLoader<ItemToGet, AttributeMap | null>(
    async (itemsToGet) => {
      // DynamoDB does not allow duplicate keys in the batchGet requests
      // do de-duplicate the keys before building the request
      const uniqueKeys = uniqWith(itemsToGet, isEqual);

      // BatchGetItems accepts a max of 100 queries. So, we need to chunk our batches
      // into 100-length chunks.
      const requestBatches = chunk(uniqueKeys, 100).map((batch) => {
        // Groups the items together by table into the request format that
        // DynamoDB expects
        const itemsByTable = groupBy(batch, 'table');

        const requestItems: BatchGetRequestMap = mapValues(
          itemsByTable,
          (itemsToGet) => {
            return { Keys: map(itemsToGet, 'key') };
          }
        );

        return requestItems;
      });

      // Perform the batch gets, collecting results as we go.
      const responses: { table: string; item: AttributeMap }[] = [];
      const unprocessedKeys: { table: string; key: Key }[] = [];
      for (const batch of requestBatches) {
        const res = await client
          .batchGetItem({ RequestItems: batch })
          .promise();

        if (res.Responses) {
          for (const [table, items] of Object.entries(res.Responses)) {
            for (const item of items) {
              responses.push({ table, item });
            }
          }
        }

        if (res.UnprocessedKeys) {
          for (const [table, { Keys }] of Object.entries(res.UnprocessedKeys)) {
            for (const key of Keys) {
              unprocessedKeys.push({ table, key });
            }
          }
        }
      }

      // Map the results from DynamoDB into an array of results in the same
      // order as the requested items
      return itemsToGet.map(({ table, key }) => {
        // Check if the item was found
        const result = find(responses, { table, item: key });
        if (result) {
          return result.item;
        }

        // If there are any unprocessed keys, treat them as failures that can
        // be retried
        const unprocessed = find(unprocessedKeys, { table, key });
        if (unprocessed) {
          return new Error('The item was not processed');
        }

        return null;
      });
    },
    { maxBatchSize: MAX_BATCH_SIZE }
  );

  return loader;
}
