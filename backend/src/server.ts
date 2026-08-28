import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import slugify from '@sindresorhus/slugify';
import { z } from 'zod';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { decodePathPart, readJsonBody, sendJson } from './http.js';
import {
  deleteFile,
  getFile,
  isMissingObjectError,
  uploadFile,
} from './storage.js';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const imageExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);
const articleSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  content: z.record(z.string(), z.unknown()),
});
const articleUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined);

type AppDependencies = {
  prismaClient?: Pick<PrismaClient, 'article'>;
  storage?: {
    uploadFile: typeof uploadFile;
    getFile: typeof getFile;
    deleteFile: typeof deleteFile;
    isMissingObjectError: typeof isMissingObjectError;
  };
};

function toJsonObject(data: Record<string, unknown>): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

function articleSlug(value: string) {
  const slug = slugify(value).slice(0, 80).replace(/-+$/g, '');

  return slug || 'article';
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

async function readImageBody(request: IncomingMessage) {
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

    if (!tooLarge) chunks.push(buffer);
  }

  if (tooLarge) return null;

  return Buffer.concat(chunks);
}

function sendArticleInputError(
  response: ServerResponse,
  error: 'invalid-json' | 'invalid-data' | 'too-large'
) {
  if (error === 'invalid-json')
    return sendJson(response, 400, { message: 'Invalid JSON' });

  if (error === 'too-large')
    return sendJson(response, 413, {
      message: 'JSON body must not exceed 1 MiB',
    });

  return sendJson(response, 400, { message: 'Invalid article data' });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export function createApp(dependencies: AppDependencies = {}) {
  const prismaClient = dependencies.prismaClient ?? prisma;
  const storage = dependencies.storage ?? {
    uploadFile,
    getFile,
    deleteFile,
    isMissingObjectError,
  };

  return createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS'
    );
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();

      return;
    }

    if (request.url === '/articles' && request.method === 'POST') {
      const result = await readJsonBody(request, articleSchema);

      if ('error' in result)
        return sendArticleInputError(response, result.error);

      const baseSlug = articleSlug(result.data.slug ?? result.data.title);

      for (let suffix = 1; suffix <= 100; suffix += 1) {
        const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;

        try {
          const article = await prismaClient.article.create({
            data: {
              slug,
              title: result.data.title,
              content: toJsonObject(result.data.content),
            },
          });

          return sendJson(response, 201, article);
        } catch (error) {
          if (isUniqueConstraintError(error)) continue;

          throw error;
        }
      }

      return sendJson(response, 503, {
        message: 'Could not create a unique article URL',
      });
    }

    if (request.url === '/articles' && request.method === 'GET')
      return sendJson(response, 200, await prismaClient.article.findMany());

    if (request.url === '/uploads' && request.method === 'POST') {
      const contentType = request.headers['content-type']?.split(';')[0] ?? '';
      const extension = imageExtensions.get(contentType);

      if (!extension)
        return sendJson(response, 415, {
          message: 'Only JPEG, PNG, WebP, and GIF are allowed',
        });

      const body = await readImageBody(request);

      if (body === null)
        return sendJson(response, 413, {
          message: 'Image must not exceed 5 MiB',
        });

      if (body.length === 0)
        return sendJson(response, 400, { message: 'Image is required' });

      const key = `${randomUUID()}.${extension}`;

      try {
        await storage.uploadFile(key, body, contentType);
      } catch (error) {
        console.error('Failed to upload image to S3', error);

        return sendJson(response, 502, {
          message: 'Image storage is unavailable',
        });
      }

      return sendJson(response, 201, { key });
    }

    const articleMatch = request.url?.match(/^\/articles\/([^/?]+)$/);

    if (articleMatch) {
      const slug = decodePathPart(articleMatch[1]!);

      if (slug === null)
        return sendJson(response, 400, { message: 'Invalid URL encoding' });

      if (request.method === 'GET') {
        const article = await prismaClient.article.findUnique({
          where: { slug },
        });

        return article
          ? sendJson(response, 200, article)
          : sendJson(response, 404, { message: 'Article not found' });
      }

      if (request.method === 'PATCH') {
        const result = await readJsonBody(request, articleUpdateSchema);

        if ('error' in result)
          return sendArticleInputError(response, result.error);

        if (!(await prismaClient.article.findUnique({ where: { slug } })))
          return sendJson(response, 404, { message: 'Article not found' });

        const article = await prismaClient.article.update({
          where: { slug },
          data: {
            ...(result.data.title === undefined
              ? {}
              : { title: result.data.title }),
            ...(result.data.content === undefined
              ? {}
              : { content: toJsonObject(result.data.content) }),
          },
        });

        return sendJson(response, 200, article);
      }

      if (request.method === 'DELETE') {
        if (!(await prismaClient.article.findUnique({ where: { slug } })))
          return sendJson(response, 404, { message: 'Article not found' });

        await prismaClient.article.delete({ where: { slug } });

        response.writeHead(204);
        response.end();

        return;
      }
    }

    const uploadMatch = request.url?.match(/^\/uploads\/([^/?]+)$/);

    if (uploadMatch) {
      const key = decodePathPart(uploadMatch[1]!);

      if (key === null)
        return sendJson(response, 400, { message: 'Invalid URL encoding' });

      if (request.method === 'GET') {
        try {
          const file = await storage.getFile(key);

          response.writeHead(200, { 'Content-Type': file.contentType });
          response.end(file.body);

          return;
        } catch (error) {
          if (storage.isMissingObjectError(error))
            return sendJson(response, 404, { message: 'File not found' });

          console.error('Failed to get image from S3', error);

          return sendJson(response, 502, {
            message: 'Image storage is unavailable',
          });
        }
      }

      if (request.method === 'DELETE') {
        try {
          await storage.deleteFile(key);

          response.writeHead(204);
          response.end();

          return;
        } catch (error) {
          if (storage.isMissingObjectError(error))
            return sendJson(response, 404, { message: 'File not found' });

          console.error('Failed to delete image from S3', error);

          return sendJson(response, 502, {
            message: 'Image storage is unavailable',
          });
        }
      }
    }

    return sendJson(response, 404, { message: 'Not found' });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createApp();

  server.listen(3000, '0.0.0.0', () =>
    console.log('Server started on http://localhost:3000')
  );
}
