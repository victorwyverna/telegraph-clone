import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

import { readJsonBody, sendJson } from '../http.js';
import { type ArticleService } from '../services/article-service.js';

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

function sendInputError(
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

export async function createArticle(
  request: IncomingMessage,
  response: ServerResponse,
  service: ArticleService
) {
  const result = await readJsonBody(request, articleSchema);

  if ('error' in result) return sendInputError(response, result.error);

  const article = await service.create(result.data);

  return article
    ? sendJson(response, 201, article)
    : sendJson(response, 503, {
        message: 'Could not create a unique article URL',
      });
}

export async function listArticles(
  response: ServerResponse,
  service: ArticleService
) {
  return sendJson(response, 200, await service.list());
}

export async function getArticle(
  response: ServerResponse,
  service: ArticleService,
  slug: string
) {
  const article = await service.findBySlug(slug);

  return article
    ? sendJson(response, 200, article)
    : sendJson(response, 404, { message: 'Article not found' });
}

export async function updateArticle(
  request: IncomingMessage,
  response: ServerResponse,
  service: ArticleService,
  slug: string
) {
  const result = await readJsonBody(request, articleUpdateSchema);

  if ('error' in result) return sendInputError(response, result.error);

  const article = await service.update(slug, result.data);

  return article
    ? sendJson(response, 200, article)
    : sendJson(response, 404, { message: 'Article not found' });
}

export async function deleteArticle(
  response: ServerResponse,
  service: ArticleService,
  slug: string
) {
  if (!(await service.delete(slug)))
    return sendJson(response, 404, { message: 'Article not found' });

  response.writeHead(204);
  response.end();
}
