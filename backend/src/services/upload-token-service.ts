import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type UploadTokenService = {
  createDeleteToken(key: string): string;
  hasValidDeleteToken(key: string, token: string): boolean;
};

export function createUploadTokenService(
  secret = process.env.UPLOAD_DELETE_TOKEN_SECRET
): UploadTokenService {
  if (!secret && process.env.NODE_ENV === 'production')
    throw new Error('UPLOAD_DELETE_TOKEN_SECRET must be configured');

  const signingSecret = secret ?? randomUUID();

  function tokenFor(key: string) {
    return createHmac('sha256', signingSecret).update(key).digest('base64url');
  }

  return {
    createDeleteToken: tokenFor,
    hasValidDeleteToken(key, token) {
      const expected = Buffer.from(tokenFor(key));
      const actual = Buffer.from(token);

      return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
      );
    },
  };
}
