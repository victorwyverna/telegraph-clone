import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ZodType } from 'zod';

const MAX_JSON_SIZE_BYTES = 1024 * 1024;

export function sendJson(
  response: ServerResponse,
  status: number,
  data: unknown
) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(data));
}

export async function readJsonBody<T>(
  request: IncomingMessage,
  schema: ZodType<T>
): Promise<
  { data: T } | { error: 'invalid-json' | 'invalid-data' | 'too-large' }
> {
  const contentLength = Number(request.headers['content-length']);

  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_SIZE_BYTES) {
    request.resume();
    return { error: 'too-large' };
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_JSON_SIZE_BYTES) {
      tooLarge = true;
      continue;
    }

    if (!tooLarge) chunks.push(buffer);
  }

  if (tooLarge) return { error: 'too-large' };

  let body: unknown;

  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return { error: 'invalid-json' };
  }

  const parsed = schema.safeParse(body);

  return parsed.success ? { data: parsed.data } : { error: 'invalid-data' };
}

export function decodePathPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
