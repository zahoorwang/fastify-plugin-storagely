import fp from 'fastify-plugin';
import { createStorage, defineDriver, prefixStorage, snapshot, restoreSnapshot } from 'unstorage';

import type { FastifyPluginCallback } from 'fastify';
import type { CreateStorageOptions, Snapshot, Storage } from 'unstorage';

export { defineDriver };

// -------------------------------------------------------------------------------------------------
// Type Definitions
// -------------------------------------------------------------------------------------------------

/**
 * Configuration options for the `fastifyStoragely` plugin.
 *
 * Extends `unstorage`'s `CreateStorageOptions` with an optional `close` callback,
 * which is executed when the Fastify server is shutting down.
 */
export interface FastifyStoragelyOptions extends CreateStorageOptions {
  /**
   * Called when the `Fastify` server is closing.
   * Useful for stopping watchers and disposing mounted storages to prevent open handles.
   */
  close?: () => void | Promise<void>;
}

/**
 * Internal plugin type signature used by Fastify.
 * @internal
 */
type FastifyStoragelyPlugin = FastifyPluginCallback<NonNullable<FastifyStoragelyOptions>>;

/**
 * Represents a snapshot tool for storage, combining:
 * - a callable function to take a snapshot
 * - a `restore` method to restore a snapshot
 * @internal
 */
type StoragelySnapshotReturn = {
  /**
   * Take a snapshot of the current storage state for the given base/prefix.
   * @param base The base or prefix to snapshot
   * @returns A promise resolving to the snapshot data
   */
  (base: string): Promise<Snapshot>;

  /**
   * Restore storage state from a previously taken snapshot.
   * @param snapshot The snapshot data to restore
   * @param base Optional base/prefix to restore into
   */
  restore(snapshot: Snapshot, base?: string): Promise<void>;
};

// -------------------------------------------------------------------------------------------------
// Internal Utilities
// -------------------------------------------------------------------------------------------------

/**
 * Creates a prefixed storage factory.
 * @param storage The storage instance to prefix
 * @returns A function that takes a prefix and returns a prefixed Storage instance
 * @internal
 */
function createPrefixedStoragely(storage: Storage) {
  return (prefix: string) => {
    return prefixStorage(storage, prefix);
  };
}

/**
 * Creates a snapshoted storage instance.
 * Provides a callable function to take snapshots and a restore method to restore them.
 * @param storage The storage instance
 * @internal
 */
function createSnapshotedStoragely(storage: Storage): StoragelySnapshotReturn {
  const fn = ((base: string) => snapshot(storage, base)) as StoragelySnapshotReturn;
  fn.restore = (snapshot: Snapshot, base?: string) => restoreSnapshot(storage, snapshot, base);
  return fn;
}

// -------------------------------------------------------------------------------------------------
// Fastify Plugin Implementation
// -------------------------------------------------------------------------------------------------

/**
 * Fastify plugin integrating `unstorage` into Fastify.
 *
 * Provides:
 * - `fastify.storagely` and `req.storagely` for the base storage instance
 * - `fastify.storagelyPrefix` and `req.storagelyPrefix` for prefixed storage
 * - `fastify.storagelySnapshot` and `req.storagelySnapshot` for snapshot/restore
 *
 * Handles storage cleanup on server shutdown, invoking optional `close` callback.
 */
const plugin: FastifyStoragelyPlugin = (fastify, opts, done) => {
  const storagely = createStorage(opts);

  // Storage - base instance
  fastify.decorate('storagely', { getter: () => storagely });
  fastify.decorateRequest('storagely', { getter: () => storagely });

  // Storage Prefix factory
  const storagelyPrefix = createPrefixedStoragely(storagely);
  fastify.decorate('storagelyPrefix', storagelyPrefix);
  fastify.decorateRequest('storagelyPrefix', storagelyPrefix);

  // Snapshot / Restore
  const storagelySnapshot = createSnapshotedStoragely(storagely);
  fastify.decorate('storagelySnapshot', storagelySnapshot);
  fastify.decorateRequest('storagelySnapshot', storagelySnapshot);

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    try {
      await opts.close?.();
    } finally {
      await storagely.unwatch();

      const mounts = storagely.getMounts('');
      for (const { base } of mounts) {
        await storagely.unmount(base, true);
      }

      await storagely.dispose();
    }
  });

  done();
};

export const fastifyStoragely = fp(plugin, {
  fastify: '5.x',
  name: '@zahoor/fastify-storagely'
});

export default fastifyStoragely;

// -------------------------------------------------------------------------------------------------
// Fastify Type Augmentation
// -------------------------------------------------------------------------------------------------

/**
 * Extends the built-in Fastify type definitions to include
 * `storagely`, `storagelyPrefix`, and `storagelySnapshot` on both
 * `FastifyInstance` and `FastifyRequest`.
 *
 * This provides type-safe access to the shared `unstorage` storage
 * system throughout your Fastify application — allowing plugins,
 * routes, and requests to read/write data, create prefixed storages,
 * and manage snapshots.
 *
 * For example:
 * ```ts
 * // Access base storage
 * await fastify.storagely.setItem('key', { foo: 123 });
 *
 * // Use prefixed storage
 * const userStore = req.storagelyPrefix('users:');
 * await userStore.setItem('u1', { name: 'Alice' });
 *
 * // Take a snapshot
 * const snap = await req.storagelySnapshot('users:');
 *
 * // Restore a snapshot
 * await req.storagelySnapshot.restore(snap, 'users:');
 * ```
 *
 * The `storagelySnapshot` type is derived from an internal factory
 * that provides a function to create snapshots and a `restore` method
 * for restoring them.
 */
declare module 'fastify' {
  interface FastifyInstance {
    /**
     * The base `Storage` instance shared across the Fastify server.
     * Allows storing, retrieving, and deleting key-value pairs.
     */
    storagely: Storage;

    /**
     * A factory function to create prefixed storage instances.
     * Useful for namespacing keys to avoid collisions.
     *
     * @param prefix A string prefix to apply to all keys in the storage.
     * @returns A new `Storage` instance scoped to the given prefix.
     */
    storagelyPrefix(prefix: string): Storage;

    /**
     * Snapshot for storage.
     * Provides a callable function to create snapshots and a `restore` method to restore them.
     */
    storagelySnapshot: StoragelySnapshotReturn;
  }

  interface FastifyRequest {
    /**
     * The base `Storage` instance shared across the Fastify server.
     * Allows storing, retrieving, and deleting key-value pairs.
     */
    storagely: Storage;

    /**
     * A factory function to create prefixed storage instances.
     * Useful for namespacing keys to avoid collisions.
     *
     * @param prefix A string prefix to apply to all keys in the storage.
     * @returns A new `Storage` instance scoped to the given prefix.
     */
    storagelyPrefix(prefix: string): Storage;

    /**
     * Snapshot for storage.
     * Provides a callable function to create snapshots and a `restore` method to restore them.
     */
    storagelySnapshot: StoragelySnapshotReturn;
  }
}
