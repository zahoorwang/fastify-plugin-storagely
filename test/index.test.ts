import fastify from 'fastify';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

import { fastifyStoragely } from '../src/index';
import memory from '../src/drivers/memory';
import { name } from '../package.json' with { type: 'json' };

import type { FastifyInstance } from 'fastify';

import type { FastifyStoragelyOptions } from '../src/index';

async function setupServe(options: Partial<FastifyStoragelyOptions> = {}, handlePreReady?: (instance: FastifyInstance) => void | Promise<void>): Promise<FastifyInstance> {
  const instance = fastify();
  await instance.register(fastifyStoragely, { driver: memory(), ...options } as any);
  await handlePreReady?.(instance);
  await instance.ready();
  return instance;
}

describe(`plugin: ${name}`, () => {
  let serve: FastifyInstance;
  const closeSpied = vi.fn();

  beforeAll(async () => {
    serve = await setupServe(
      {
        close: closeSpied
      },
      async instance => {
        // Register a temporary route for request hookable testing
        instance.get('/test-storage', async req => {
          expect(req.storagely).toBeDefined();
          expect(req.storagelyPrefix).toBeDefined();
          expect(req.storagelySnapshot).toBeDefined();
          return { ok: true };
        });
      }
    );
  });

  afterAll(async () => {
    await serve.close();
  });

  // --------------------------------------------
  // Decorators
  // --------------------------------------------

  it('should decorate Fastify instance with storagely, storagelyPrefix, storagelySnapshot', () => {
    expect(serve.storagely).toBeDefined();
    expect(serve.storagelyPrefix).toBeDefined();
    expect(serve.storagelySnapshot).toBeDefined();
  });

  it('should decorate Fastify request with same APIs', async () => {
    const res = await serve.inject({ method: 'GET', url: '/test-storage' });
    expect(res.statusCode).toBe(200);
  });

  // --------------------------------------------
  // storagePrefix tests
  // --------------------------------------------

  it('should correctly namespace keys using storagelyPrefix', async () => {
    const users = serve.storagelyPrefix('users:');

    await users.setItem('u1', { name: 'Alice' });

    const raw = await serve.storagely.getItem('users:u1');
    expect(raw).toEqual({ name: 'Alice' });
  });

  // --------------------------------------------
  // snapshot tests
  // --------------------------------------------

  it('should correctly take and restore snapshots', async () => {
    await serve.storagely.setItem('foo', 'original');

    const snap = await serve.storagelySnapshot('');
    expect(snap).toBeDefined();

    // modify key
    await serve.storagely.setItem('foo', 'changed');

    // restore snapshot
    await serve.storagelySnapshot.restore(snap);

    const restored = await serve.storagely.getItem('foo');
    expect(restored).toBe('original');
  });

  // --------------------------------------------
  // close hook tests
  // --------------------------------------------

  it('should call close hook on server shutdown', async () => {
    const closeSpied = vi.fn();

    const fastifyClose = await setupServe({ close: closeSpied });
    await fastifyClose.close();
    expect(closeSpied).toHaveBeenCalled();
  });
});
