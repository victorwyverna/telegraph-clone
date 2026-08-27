import 'dotenv/config';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { getFile, isMissingObjectError, uploadFile } from './storage.js';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const articleSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  content: z.record(z.string(), z.unknown()),
});
const articleUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined);

function sendJson(response: import('node:http').ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data));
}

function toJsonObject(data: Record<string, unknown>): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

async function readImageBody(request: import('node:http').IncomingMessage) {
  const contentLength = Number(request.headers['content-length']);

  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
    request.resume();
    return null;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_IMAGE_SIZE_BYTES) {
      tooLarge = true;
      continue;
    }

    if (!tooLarge) {
      chunks.push(buffer);
    }
  }

  return tooLarge ? null : Buffer.concat(chunks);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS',
  );
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();

    return;
  }

  if (request.url === '/articles' && request.method === 'POST') {
    let body = '';

    for await (const chunk of request) {
      body += chunk;
    }

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid JSON' }));
      return;
    }

    const parsedData = articleSchema.safeParse(data);

    if (!parsedData.success) {
      sendJson(response, 400, { message: 'Invalid article data' });
      return;
    }

    try {
      const article = await prisma.article.create({
        data: {
          slug: parsedData.data.slug,
          title: parsedData.data.title,
          content: toJsonObject(parsedData.data.content),
        },
      });

      response.writeHead(201, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify(article));
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        response.writeHead(409, {
          'Content-Type': 'application/json',
        });

        response.end(JSON.stringify({ message: 'Slug already exists' }));
        return;
      }

      throw error;
    }
  }

  if (request.url === '/uploads' && request.method === 'POST') {
    const contentType = request.headers['content-type']?.split(';')[0];
    const extension = new Map([
      ['image/jpeg', 'jpg'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
      ['image/gif', 'gif'],
    ]).get(contentType ?? '');

    if (!extension) {
      response.writeHead(415, {
        'Content-Type': 'application/json',
      });

      response.end(
        JSON.stringify({ message: 'Only JPEG, PNG, WebP, and GIF are allowed' }),
      );
      return;
    }

    const body = await readImageBody(request);

    if (body === null) {
      sendJson(response, 413, {
        message: 'Image must not exceed 5 MiB',
      });
      return;
    }

    if (body.length === 0) {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Image is required' }));
      return;
    }

    const key = `${randomUUID()}.${extension}`;

    try {
      await uploadFile(key, body, contentType ?? '');
    } catch (error) {
      console.error('Failed to upload image to S3', error);
      sendJson(response, 502, { message: 'Image storage is unavailable' });
      return;
    }

    response.writeHead(201, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify({ key }));
    return;
  }

  if (request.url === '/articles' && request.method === 'GET') {
    const articles = await prisma.article.findMany();

    response.writeHead(200, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(articles));

    return;
  }

  const articleSlugMatch = request.url?.match(/^\/articles\/([^/?]+)$/);
  const slug = articleSlugMatch?.[1];

  if (request.method === 'GET' && slug) {
    const article = await prisma.article.findUnique({
      where: { slug: decodeURIComponent(slug) },
    });

    if (!article) {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Article not found' }));

      return;
    }

    response.writeHead(200, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(article));

    return;
  }

  if (request.method === 'PATCH' && slug) {
    let body = '';

    for await (const chunk of request) {
      body += chunk;
    }

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid JSON' }));
      return;
    }

    const parsedData = articleUpdateSchema.safeParse(data);

    if (!parsedData.success) {
      sendJson(response, 400, { message: 'Invalid article data' });
      return;
    }

    const articleSlug = decodeURIComponent(slug);

    const existingArticle = await prisma.article.findUnique({
      where: { slug: articleSlug },
    });

    if (!existingArticle) {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Article not found' }));

      return;
    }

    const article = await prisma.article.update({
      where: { slug: articleSlug },
      data: {
        ...(parsedData.data.title !== undefined
          ? { title: parsedData.data.title }
          : {}),
        ...(parsedData.data.content !== undefined
          ? { content: toJsonObject(parsedData.data.content) }
          : {}),
      },
    });

    response.writeHead(200, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(article));

    return;
  }

  if (request.method === 'DELETE' && slug) {
    const articleSlug = decodeURIComponent(slug);

    const existingArticle = await prisma.article.findUnique({
      where: { slug: articleSlug },
    });

    if (!existingArticle) {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Article not found' }));

      return;
    }

    await prisma.article.delete({
      where: { slug: articleSlug },
    });

    response.writeHead(204);
    response.end();

    return;
  }

  const uploadKeyMatch = request.url?.match(/^\/uploads\/([^/?]+)$/);
  const key = uploadKeyMatch?.[1];

  if (request.method === 'GET' && key) {
    try {
      const file = await getFile(decodeURIComponent(key));

      response.writeHead(200, {
        'Content-Type': file.contentType,
      });

      response.end(file.body);
      return;
    } catch (error) {
      if (isMissingObjectError(error)) {
        sendJson(response, 404, { message: 'File not found' });
        return;
      }

      console.error('Failed to get image from S3', error);
      sendJson(response, 502, { message: 'Image storage is unavailable' });
      return;
    }
  }

  response.writeHead(404, {
    'Content-Type': 'application/json',
  });

  response.end(
    JSON.stringify({
      message: 'Not found',
    }),
  );
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Server started on http://localhost:3000');
});
