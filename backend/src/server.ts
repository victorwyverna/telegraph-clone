import 'dotenv/config';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { prisma } from './db/prisma.js';
import { routeRequest, type RouteDependencies } from './routes/index.js';
import {
  deleteFile,
  getFile,
  isMissingObjectError,
  uploadFile,
} from './storage/s3.js';
import { createUploadTokenService } from './services/upload-token-service.js';
import { createRateLimiter } from './services/rate-limit-service.js';

export type AppDependencies = Partial<RouteDependencies>;

const defaultStorage = {
  uploadFile,
  getFile,
  deleteFile,
  isMissingObjectError,
};

export function createApp(dependencies: AppDependencies = {}) {
  const routeDependencies: RouteDependencies = {
    prismaClient: dependencies.prismaClient ?? prisma,
    storage: dependencies.storage ?? defaultStorage,
    uploadTokenService:
      dependencies.uploadTokenService ?? createUploadTokenService(),
    rateLimiter: dependencies.rateLimiter ?? createRateLimiter(),
  };

  return createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS'
    );
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Edit-Token, X-Upload-Delete-Token'
    );

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    await routeRequest(request, response, routeDependencies);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createApp();

  server.listen(3000, '0.0.0.0', () =>
    console.log('Server started on http://localhost:3000')
  );
}
