import { BatchGetItemCommandOutput, DynamoDB } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { createDataLoader } from '../src';

function createMockDynamoDBClient(
  result: BatchGetItemCommandOutput | any
): DynamoDB {
  return {
    batchGetItem: jest.fn().mockImplementation(() => Promise.resolve(result)),
  } as unknown as DynamoDB;
}

type Key = any;

test('uses BatchGetItem to get items', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1, item2].map((item) => marshall(item)),
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2,
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(item2);
});

test('uses BatchGetItem to get items - 101 items', async () => {
  const itemArray: Key[] = new Array(101);
  itemArray.fill({ id: 'id' });
  const items = itemArray.map((x, y) => ({ id: `id${y + 1}` }));

  const client = createMockDynamoDBClient({
    Responses: {
      table1: items.map((item) => marshall(item)),
    },
  });

  const loader = createDataLoader({ client });
  const loadings: Promise<any | null>[] = [];
  for (const item of items) {
    loadings.push(
      loader.load({
        table: 'table1',
        key: item,
      })
    );
  }

  const loadedItems = await Promise.all(loadings);

  expect(client.batchGetItem).toBeCalledTimes(2);
  for (const key in loadedItems) {
    expect(loadedItems[key]).toEqual(items[key]);
  }
});

test('supports multiple tables', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1].map((item) => marshall(item)),
      table2: [item2].map((item) => marshall(item)),
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table2',
    key: item2,
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(item2);
});

test('marks unprocessed items as failures', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1].map((item) => marshall(item)),
    },
    UnprocessedKeys: {
      table2: {
        Keys: [item2].map((item) => marshall(item)),
      },
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table2',
    key: item2,
  });

  expect(await loading1).toEqual(item1);
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed',
  });

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('handles a response with nothing but unprocessed items', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };

  const client = createMockDynamoDBClient({
    UnprocessedKeys: {
      table2: {
        Keys: [item2].map((item) => marshall(item)),
      },
      table1: {
        Keys: [item1].map((item) => marshall(item)),
      },
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table2',
    key: item2,
  });

  await expect(loading1).rejects.toMatchObject({
    message: 'The item was not processed',
  });
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed',
  });

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('handles a response with found, unprocessed and null items', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };
  const item3: Key = { id: 'id3' };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1].map((item) => marshall(item)),
    },
    UnprocessedKeys: {
      table1: {
        Keys: [item2].map((item) => marshall(item)),
      },
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2,
  });
  const loading3 = loader.load({
    table: 'table2',
    key: item3,
  });

  expect(await loading1).toEqual(item1);
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed',
  });
  expect(await loading3).toBeNull();

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('handles a response with unprocessed and null items in the same table', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };

  const client = createMockDynamoDBClient({
    UnprocessedKeys: {
      table1: {
        Keys: [item2].map((item) => marshall(item)),
      },
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2,
  });

  expect(await loading1).toBeNull();
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed',
  });

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('returns null for items that do not exist', async () => {
  const item1: Key = { id: 'id1' };
  const item2: Key = { id: 'id2' };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1].map((item) => marshall(item)),
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2,
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(null);
});

test('Duplicate load requests for the same key are merged before the batch request', async () => {
  const item1: Key = { id: 'id1' };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1].map((item) => marshall(item)),
    },
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1,
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item1,
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(client.batchGetItem).toBeCalledWith({
    RequestItems: {
      table1: {
        Keys: [marshall(item1)],
      },
    },
  });

  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(item1);
});
