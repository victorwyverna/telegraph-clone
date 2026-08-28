import { randomUUID } from 'node:crypto';

const imageExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type Storage = {
  uploadFile(key: string, body: Buffer, contentType: string): Promise<void>;
  getFile(key: string): Promise<{ body: Buffer; contentType: string }>;
  deleteFile(key: string): Promise<void>;
  isMissingObjectError(error: unknown): boolean;
};

export function imageExtension(contentType: string) {
  return imageExtensions.get(contentType);
}

export function createUploadKey(extension: string) {
  return `${randomUUID()}.${extension}`;
}
