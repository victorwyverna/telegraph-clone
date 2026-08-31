import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  updateArticle,
} from '../controllers/articles.js';
import { deleteUpload, getUpload, uploadFile } from '../controllers/uploads.js';
import { decodePathPart, sendJson } from '../http.js';
import {
  type ArticleRepository,
  ArticleService,
} from '../services/article-service.js';
import { type Storage } from '../services/upload-service.js';
import { type UploadTokenService } from '../services/upload-token-service.js';
import { type RateLimiter } from '../services/rate-limit-service.js';

export type RouteDependencies = {
  prismaClient: ArticleRepository;
  storage: Storage;
  uploadTokenService: UploadTokenService;
  rateLimiter: RateLimiter;
};

const PUBLISH_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };
const UPLOAD_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 };

function clientAddress(request: IncomingMessage) {
  return request.socket.remoteAddress ?? 'unknown';
}

function isRateLimited(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RouteDependencies,
  action: 'publish' | 'upload'
) {
  const result = dependencies.rateLimiter.check(
    `${action}:${clientAddress(request)}`,
    action === 'publish' ? PUBLISH_LIMIT : UPLOAD_LIMIT
  );

  if (result.allowed) return false;

  response.setHeader('Retry-After', result.retryAfterSeconds);

  sendJson(response, 429, {
    message: 'Too many requests. Please try again later.',
  });

  return true;
}

export async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RouteDependencies
) {
  if (request.url === '/articles' && request.method === 'POST') {
    if (isRateLimited(request, response, dependencies, 'publish')) return;

    return createArticle(
      request,
      response,
      new ArticleService(dependencies.prismaClient)
    );
  }

  if (request.url === '/articles' && request.method === 'GET')
    return listArticles(
      response,
      new ArticleService(dependencies.prismaClient)
    );

  if (request.url === '/uploads' && request.method === 'POST') {
    if (isRateLimited(request, response, dependencies, 'upload')) return;

    return uploadFile(
      request,
      response,
      dependencies.storage,
      dependencies.uploadTokenService
    );
  }

  const articleMatch = request.url?.match(/^\/articles\/([^/?]+)$/);

  if (articleMatch) {
    const slug = decodePathPart(articleMatch[1]!);

    if (slug === null)
      return sendJson(response, 400, { message: 'Invalid URL encoding' });

    const service = new ArticleService(dependencies.prismaClient);

    if (request.method === 'GET') return getArticle(response, service, slug);

    if (request.method === 'PATCH')
      return updateArticle(request, response, service, slug);

    if (request.method === 'DELETE')
      return deleteArticle(request, response, service, slug);
  }

  const uploadMatch = request.url?.match(/^\/uploads\/([^/?]+)$/);

  if (uploadMatch) {
    const key = decodePathPart(uploadMatch[1]!);

    if (key === null)
      return sendJson(response, 400, { message: 'Invalid URL encoding' });

    if (request.method === 'GET')
      return getUpload(response, dependencies.storage, key);

    if (request.method === 'DELETE')
      return deleteUpload(
        request,
        response,
        dependencies.storage,
        dependencies.uploadTokenService,
        key
      );
  }

  return sendJson(response, 404, { message: 'Not found' });
}
