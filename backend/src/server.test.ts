import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from './server.js';

const article = {
  id: 1,
  slug: 'hello',
  editToken: 'secret-token',
  title: 'Hello',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
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
      updateMany: async ({ where }: { where: { editToken: string } }) => ({
        count: where.editToken === article.editToken ? 1 : 0,
      }),
      deleteMany: async ({ where }: { where: { editToken: string } }) => ({
        count: where.editToken === article.editToken ? 1 : 0,
      }),
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
      body: JSON.stringify({ title: 'New article', content: article.content }),
    });

    assert.equal(created.status, 201);

    const createdBody = await created.json();

    assert.equal(createdBody.article.slug, 'new-article');
    assert.equal(typeof createdBody.editToken, 'string');

    const cyrillicTitle = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Моя первая ёлка',
        content: article.content,
      }),
    });

    assert.equal(cyrillicTitle.status, 201);
    assert.equal(
      (await cyrillicTitle.json()).article.slug,
      'moya-pervaya-yolka'
    );

    const tiptapDocument = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Rich article',
        content: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Heading' }],
            },
            {
              type: 'blockquote',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Quote' }],
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Link',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://example.com',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        class: null,
                      },
                    },
                  ],
                },
              ],
            },
            {
              type: 'image',
              attrs: {
                src: 'https://example.com/image.png',
                alt: null,
                title: null,
              },
            },
          ],
        },
      }),
    });

    assert.equal(tiptapDocument.status, 201);

    const malformed = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { message: 'Invalid JSON' });

    const invalidContent = await fetch(`${baseUrl}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unsafe article',
        content: { type: 'doc', content: [{ type: 'script' }] },
      }),
    });

    assert.equal(invalidContent.status, 400);
  });
});

test('requires an upload delete token to delete an image', async () => {
  await withApp(async (baseUrl, state) => {
    const uploaded = await fetch(`${baseUrl}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from('image'),
    });
    const { key, deleteToken } = (await uploaded.json()) as {
      key: string;
      deleteToken: string;
    };

    const forbidden = await fetch(`${baseUrl}/uploads/${key}`, {
      method: 'DELETE',
    });
    assert.equal(forbidden.status, 403);

    const deleted = await fetch(`${baseUrl}/uploads/${key}`, {
      method: 'DELETE',
      headers: { 'X-Upload-Delete-Token': deleteToken },
    });

    assert.equal(deleted.status, 204);
    assert.deepEqual(state.deletedKeys, [key]);

    const missing = await fetch(`${baseUrl}/uploads/missing`, {
      method: 'DELETE',
      headers: { 'X-Upload-Delete-Token': deleteToken },
    });
    assert.equal(missing.status, 403);
  });
});

test('requires an edit token to change or delete an article', async () => {
  await withApp(async (baseUrl) => {
    const noToken = await fetch(`${baseUrl}/articles/hello`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Changed' }),
    });

    assert.equal(noToken.status, 403);

    const wrongToken = await fetch(`${baseUrl}/articles/hello`, {
      method: 'DELETE',
      headers: { 'X-Edit-Token': 'wrong-token' },
    });

    assert.equal(wrongToken.status, 403);

    const updated = await fetch(`${baseUrl}/articles/hello`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Edit-Token': article.editToken,
      },
      body: JSON.stringify({ title: 'Changed' }),
    });

    assert.equal(updated.status, 200);
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

test('limits repeated publications from one client', async () => {
  await withApp(async (baseUrl) => {
    const responses = await Promise.all(
      Array.from({ length: 11 }, () =>
        fetch(`${baseUrl}/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'New article',
            content: article.content,
          }),
        })
      )
    );

    assert.equal(responses.at(-1)?.status, 429);
    assert.ok(responses.at(-1)?.headers.get('retry-after'));
  });
});
