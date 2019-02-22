# dynamodb-dataloader

[![npm](https://img.shields.io/npm/v/@lifeomic/dynamodb-dataloader.svg)](https://www.npmjs.com/package/@lifeomic/dynamodb-dataloader)
[![Build Status](https://travis-ci.org/lifeomic/dynamodb-dataloader.svg?branch=master)](https://travis-ci.org/lifeomic/dynamodb-dataloader)
[![Greenkeeper badge](https://badges.greenkeeper.io/lifeomic/dynamodb-dataloader.svg)](https://greenkeeper.io/)

A DataLoader that batches requests for DynamoDB. The DataLoader can fetch items
from multiple tables at once so you should only need one instance per request.

You should be able to replace your calls to `dynamoClient.get` with
`loader.load` and automaticly switch your network calls from `GetItem` to
`BatchGetItem`.

NOTE: Make sure you update your IAM policy to allow `dynamodb:BatchGetItem` if
you have strict IAM policies

# Example code

```javascript
const { createDataLoader } = require('@lifeomic/dynamodb-dataloader');

// Once per request or scope that can share data access
const client = new AWS.DyanmoDB();
const loader = createDataLoader({ client });

// Once per item fetch
const item = await loader.load({
  table: 'your table name',
  key: { idAattribute: { S: 'some id' } }
});
```
