import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

import { readJsonBody, sendJson } from '../http.js';
import { isTiptapContent } from '../lib/tiptap-content.js';
import { type ArticleService } from '../services/article-service.js';

const tiptapContentSchema = z.custom<Record<string, unknown>>(isTiptapContent);

const articleSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  content: tiptapContentSchema,
});
const articleUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: tiptapContentSchema.optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined);

function editToken(request: IncomingMessage) {
  const value = request.headers['x-edit-token'];

  return typeof value === 'string' && value.length > 0 ? value : null;
}

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

  const created = await service.create(result.data);

  return created
    ? sendJson(response, 201, created)
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

  const token = editToken(request);

  if (!token) return sendJson(response, 403, { message: 'Invalid edit token' });

  const article = await service.update(slug, {
    ...result.data,
    editToken: token,
  });

  return article === 'forbidden'
    ? sendJson(response, 403, { message: 'Invalid edit token' })
    : article
      ? sendJson(response, 200, article)
      : sendJson(response, 404, { message: 'Article not found' });
}

export async function deleteArticle(
  request: IncomingMessage,
  response: ServerResponse,
  service: ArticleService,
  slug: string
) {
  const token = editToken(request);

  if (!token) return sendJson(response, 403, { message: 'Invalid edit token' });

  const result = await service.delete(slug, token);

  if (result === 'forbidden')
    return sendJson(response, 403, { message: 'Invalid edit token' });

  if (!result) return sendJson(response, 404, { message: 'Article not found' });

  response.writeHead(204);
  response.end();
}
