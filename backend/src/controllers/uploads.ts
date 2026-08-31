import type { IncomingMessage, ServerResponse } from 'node:http';

import { sendJson } from '../http.js';
import {
  createUploadKey,
  imageExtension,
  MAX_IMAGE_SIZE_BYTES,
  type Storage,
} from '../services/upload-service.js';
import { type UploadTokenService } from '../services/upload-token-service.js';

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

  return tooLarge ? null : Buffer.concat(chunks);
}

export async function uploadFile(
  request: IncomingMessage,
  response: ServerResponse,
  storage: Storage,
  tokenService: UploadTokenService
) {
  const contentType = request.headers['content-type']?.split(';')[0] ?? '';
  const extension = imageExtension(contentType);

  if (!extension)
    return sendJson(response, 415, {
      message: 'Only JPEG, PNG, WebP, and GIF are allowed',
    });

  const body = await readImageBody(request);

  if (body === null)
    return sendJson(response, 413, { message: 'Image must not exceed 5 MiB' });

  if (body.length === 0)
    return sendJson(response, 400, { message: 'Image is required' });

  const key = createUploadKey(extension);

  try {
    await storage.uploadFile(key, body, contentType);
  } catch (error) {
    console.error('Failed to upload image to S3', error);

    return sendJson(response, 502, { message: 'Image storage is unavailable' });
  }

  return sendJson(response, 201, {
    key,
    deleteToken: tokenService.createDeleteToken(key),
  });
}

export async function getUpload(
  response: ServerResponse,
  storage: Storage,
  key: string
) {
  try {
    const file = await storage.getFile(key);

    response.writeHead(200, { 'Content-Type': file.contentType });
    response.end(file.body);
  } catch (error) {
    if (storage.isMissingObjectError(error))
      return sendJson(response, 404, { message: 'File not found' });

    console.error('Failed to get image from S3', error);

    return sendJson(response, 502, { message: 'Image storage is unavailable' });
  }
}

export async function deleteUpload(
  request: IncomingMessage,
  response: ServerResponse,
  storage: Storage,
  tokenService: UploadTokenService,
  key: string
) {
  const token = request.headers['x-upload-delete-token'];

  if (
    typeof token !== 'string' ||
    !tokenService.hasValidDeleteToken(key, token)
  )
    return sendJson(response, 403, { message: 'Invalid upload delete token' });

  try {
    await storage.deleteFile(key);

    response.writeHead(204);
    response.end();
  } catch (error) {
    if (storage.isMissingObjectError(error))
      return sendJson(response, 404, { message: 'File not found' });

    console.error('Failed to delete image from S3', error);

    return sendJson(response, 502, { message: 'Image storage is unavailable' });
  }
}
