# @zahoor/fastify-storagely

[![NPM version](https://img.shields.io/npm/v/@zahoor/fastify-storagely?style=for-the-badge)](https://www.npmjs.com/package/@zahoor/fastify-storagely)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen?style=for-the-badge)]()

> **The current version has not been fully tested and is considered unstable; DO NOT USE.**

A Fastify plugin integrating [Unstorage](https://unstorage.unjs.io), providing base storage, prefixed storage, and snapshot/restore utilities with automatic cleanup on server shutdown.

## Features

- Base storage access (`fastify.storagely` / `req.storagely`)
- Prefixed storage factory (`fastify.storagelyPrefix(prefix)` / `req.storagelyPrefix(prefix)`)
- Snapshot and restore storage (`fastify.storagelySnapshot(base)` / `req.storagelySnapshot(base)`)
- Automatic cleanup of mounted storages on server shutdown
- Optional `close` callback to perform custom cleanup logic
- TypeScript ready with type-safe access

## Install

```sh
npm i @zahoor/fastify-storagely
```

### Compatibility

| Plugin version | `Fastify` version | `Unstorage` version |
| -------------- | ----------------- | ------------------- |
| `current`      | `^5.x`            | `^1.x`              |

## Usage

```ts
import fastify from 'fastify';
import storagely from '@zahoor/fastify-storagely';
import memory from '@zahoor/fastify-storagely/drivers/memory';

const serve = fastify();

serve.register(storagely, {
  // Optional Unstorage options
  driver: memory(),
  close: async () => {
    console.log('Server is closing, custom cleanup logic here');
  }
});

serve.get('/test', async (request, reply) => {
  // Base storage
  await request.storagely.setItem('foo', { bar: 123 });
  const value = await request.storagely.getItem('foo');

  // Prefixed storage
  const userStore = request.storagelyPrefix('users:');
  await userStore.setItem('u1', { name: 'Alice' });
  const user = await userStore.getItem('u1');

  // Take a snapshot
  const snap = await request.storagelySnapshot('users:');

  // Restore a snapshot
  await request.storagelySnapshot.restore(snap, 'users:');

  return { value, user };
});

await serve.listen({ port: 3000 });
```

## API

### FastifyInstance & FastifyRequest

- **`storagely`** (`Storage`)
  The base storage instance. Allows storing, retrieving, and deleting key-value pairs.

- **`storagelyPrefix(prefix: string)`** (`Storage`)
  Factory function to create prefixed storage instances. Useful for namespacing keys to avoid collisions.
  - `prefix`: A string prefix applied to all keys in the storage.

- **`storagelySnapshot(base: string)`** (`Promise<Snapshot>`)
  Function to take a snapshot of the current storage state.
  - `base`: The base or prefix to snapshot.

- **`storagelySnapshot.restore(snapshot: Snapshot, base?: string)`** (`Promise<void>`)
  Restore storage state from a previously taken snapshot.
  - `snapshot`: The snapshot data to restore.
  - `base` (optional): The base or prefix to restore into.

### Custom Driver

**See [`Unstorage Custom Driver`](https://unstorage.unjs.io/guide/custom-driver)**, for example:

```ts
import { defineDriver } from '@zahoor/fastify-storagely';

const myStorageDriver = defineDriver(options => {
  // ...
});
```

## Options

The plugin accepts all **Unstorage options** via **CreateStorageOptions**, plus an optional **close** callback.

- **close**: Called when the `Fastify` server is closing. Useful for stopping watchers or cleaning up mounted storages.

## Drivers

**See [`Unstorage Drivers`](https://unstorage.unjs.io/drivers)**

## License

Licensed under [MIT](./LICENSE).
