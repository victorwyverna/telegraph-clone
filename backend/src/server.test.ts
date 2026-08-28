import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from './server.js';

const article = {
  id: 1,
  slug: 'hello',
  title: 'Hello',
  content: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function withApp(
  run: (baseUrl: string, state: { deletedKeys: string[] }) => Promise<void>
) {
  const state = { deletedKeys: [] as string[] };
  const prismaClient = {
    article: {
      create: async ({ data }: { data: typeof article }) => data,
      findMany: async () => [article],
      findUnique: async ({ where }: { where: { slug: string } }) =>
        where.slug === 'hello' ? article : null,
      update: async () => article,
      delete: async () => article,
    },
  };
  const storage = {
    uploadFile: async () => undefined,
    getFile: async () => ({
      body: Buffer.from('image'),
      contentType: 'image/png',
    }),
    deleteFile: async (key: string) => {
      if (key === 'missing') throw new Error('missing');
      state.deletedKeys.push(key);
    },
    isMissingObjectError: (error: unknown) =>
      error instanceof Error && error.message === 'missing',
  };
  const server = createApp({ prismaClient: prismaClient as never, storage });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    await run(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      state
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('creates articles and rejects malformed article input', async () => {
  await withApp(async (baseUrl) => {
    const created = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New article', content: {} }),
    });

    assert.equal(created.status, 201);
    assert.equal((await created.json()).slug, 'new-article');

    const cyrillicTitle = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Моя первая ёлка', content: {} }),
    });

    assert.equal(cyrillicTitle.status, 201);
    assert.equal((await cyrillicTitle.json()).slug, 'moya-pervaya-yolka');

    const malformed = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { message: 'Invalid JSON' });
  });
});

test('deletes an uploaded image and reports a missing file', async () => {
  await withApp(async (baseUrl, state) => {
    const deleted = await fetch(`${baseUrl}/uploads/unused.png`, {
      method: 'DELETE',
    });

    assert.equal(deleted.status, 204);
    assert.deepEqual(state.deletedKeys, ['unused.png']);

    const missing = await fetch(`${baseUrl}/uploads/missing`, {
      method: 'DELETE',
    });

    assert.equal(missing.status, 404);
  });
});

test('validates image uploads and handles CORS preflight', async () => {
  await withApp(async (baseUrl) => {
    const rejected = await fetch(`${baseUrl}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'nope',
    });

    assert.equal(rejected.status, 415);

    const preflight = await fetch(`${baseUrl}/articles`, { method: 'OPTIONS' });

    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get('access-control-allow-methods'),
      'GET, POST, PATCH, DELETE, OPTIONS'
    );
  });
});
