import { createDataLoader } from '../src';
import { DynamoDB } from 'aws-sdk';
import { Key, BatchGetItemOutput } from 'aws-sdk/clients/dynamodb';

function createMockDynamoDBClient(result: BatchGetItemOutput): DynamoDB {
  return ({
    batchGetItem: jest.fn().mockImplementation(() => ({
      promise: () => Promise.resolve(result)
    }))
  } as unknown) as DynamoDB;
}

test('uses BatchGetItem to get items', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1, item2]
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(item2);
});

test('supports multiple tables', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1],
      table2: [item2]
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table2',
    key: item2
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(item2);
});

test('marks unprocessed items as failures', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1]
    },
    UnprocessedKeys: {
      table2: {
        Keys: [item2]
      }
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table2',
    key: item2
  });

  expect(await loading1).toEqual(item1);
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed'
  });

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('handles a response with nothing but unprocessed items', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };

  const client = createMockDynamoDBClient({
    UnprocessedKeys: {
      table2: {
        Keys: [item2]
      },
      table1: {
        Keys: [item1]
      }
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table2',
    key: item2
  });

  await expect(loading1).rejects.toMatchObject({
    message: 'The item was not processed'
  });
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed'
  });

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('handles a response with found, unprocessed and null items', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };
  const item3: Key = { id: { S: 'id3' } };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1]
    },
    UnprocessedKeys: {
      table1: {
        Keys: [item2]
      }
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2
  });
  const loading3 = loader.load({
    table: 'table2',
    key: item3
  });

  expect(await loading1).toEqual(item1);
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed'
  });
  expect(await loading3).toBeNull();

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('handles a response with unprocessed and null items in the same table', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };

  const client = createMockDynamoDBClient({
    UnprocessedKeys: {
      table1: {
        Keys: [item2]
      }
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2
  });

  expect(await loading1).toBeNull();
  await expect(loading2).rejects.toMatchObject({
    message: 'The item was not processed'
  });

  expect(client.batchGetItem).toBeCalledTimes(1);
});

test('returns null for items that do not exist', async () => {
  const item1: Key = { id: { S: 'id1' } };
  const item2: Key = { id: { S: 'id2' } };

  const client = createMockDynamoDBClient({
    Responses: {
      table1: [item1]
    }
  });

  const loader = createDataLoader({ client });
  const loading1 = loader.load({
    table: 'table1',
    key: item1
  });
  const loading2 = loader.load({
    table: 'table1',
    key: item2
  });

  const [loadedItem1, loadedItem2] = await Promise.all([loading1, loading2]);

  expect(client.batchGetItem).toBeCalledTimes(1);
  expect(loadedItem1).toEqual(item1);
  expect(loadedItem2).toEqual(null);
});
