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

export type RouteDependencies = {
  prismaClient: ArticleRepository;
  storage: Storage;
};

export async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: RouteDependencies
) {
  if (request.url === '/articles' && request.method === 'POST')
    return createArticle(
      request,
      response,
      new ArticleService(dependencies.prismaClient)
    );

  if (request.url === '/articles' && request.method === 'GET')
    return listArticles(
      response,
      new ArticleService(dependencies.prismaClient)
    );

  if (request.url === '/uploads' && request.method === 'POST')
    return uploadFile(request, response, dependencies.storage);

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
      return deleteUpload(response, dependencies.storage, key);
  }

  return sendJson(response, 404, { message: 'Not found' });
}
