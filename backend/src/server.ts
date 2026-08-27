import 'dotenv/config';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { getFile, uploadFile } from './storage.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS',
  );
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();

    return;
  }

  if (request.url === '/articles' && request.method === 'POST') {
    let body = '';

    for await (const chunk of request) {
      body += chunk;
    }

    let data: any;

    try {
      data = JSON.parse(body);
    } catch {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid JSON' }));
      return;
    }

    if (
      typeof data.slug !== 'string' ||
      data.slug.trim() === '' ||
      typeof data.title !== 'string' ||
      data.title.trim() === '' ||
      typeof data.content !== 'object' ||
      data.content === null
    ) {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid article data' }));
      return;
    }

    try {
      const article = await prisma.article.create({
        data: {
          slug: data.slug.trim(),
          title: data.title.trim(),
          content: data.content,
        },
      });

      response.writeHead(201, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify(article));
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        response.writeHead(409, {
          'Content-Type': 'application/json',
        });

        response.end(JSON.stringify({ message: 'Slug already exists' }));
        return;
      }

      throw error;
    }
  }

  if (request.url === '/uploads' && request.method === 'POST') {
    const contentType = request.headers['content-type']?.split(';')[0];
    const extension = new Map([
      ['image/jpeg', 'jpg'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
      ['image/gif', 'gif'],
    ]).get(contentType ?? '');

    if (!extension) {
      response.writeHead(415, {
        'Content-Type': 'application/json',
      });

      response.end(
        JSON.stringify({ message: 'Only JPEG, PNG, WebP, and GIF are allowed' }),
      );
      return;
    }

    const chunks: Buffer[] = [];

    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks);

    if (body.length === 0) {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Image is required' }));
      return;
    }

    const key = `${randomUUID()}.${extension}`;

    await uploadFile(key, body, contentType ?? '');

    response.writeHead(201, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify({ key }));
    return;
  }

  if (request.url === '/articles' && request.method === 'GET') {
    const articles = await prisma.article.findMany();

    response.writeHead(200, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(articles));

    return;
  }

  const articleSlugMatch = request.url?.match(/^\/articles\/([^/?]+)$/);
  const slug = articleSlugMatch?.[1];

  if (request.method === 'GET' && slug) {
    const article = await prisma.article.findUnique({
      where: { slug: decodeURIComponent(slug) },
    });

    if (!article) {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Article not found' }));

      return;
    }

    response.writeHead(200, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(article));

    return;
  }

  if (request.method === 'PATCH' && slug) {
    let body = '';

    for await (const chunk of request) {
      body += chunk;
    }

    let data: any;

    try {
      data = JSON.parse(body);
    } catch {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid JSON' }));
      return;
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid article data' }));
      return;
    }

    const hasTitle = data.title !== undefined;
    const hasContent = data.content !== undefined;

    if (
      (!hasTitle && !hasContent) ||
      (hasTitle &&
        (typeof data.title !== 'string' || data.title.trim() === '')) ||
      (hasContent &&
        (typeof data.content !== 'object' || data.content === null))
    ) {
      response.writeHead(400, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Invalid article data' }));
      return;
    }

    const articleSlug = decodeURIComponent(slug);

    const existingArticle = await prisma.article.findUnique({
      where: { slug: articleSlug },
    });

    if (!existingArticle) {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Article not found' }));

      return;
    }

    const article = await prisma.article.update({
      where: { slug: articleSlug },
      data: {
        ...(hasTitle ? { title: data.title.trim() } : {}),
        ...(hasContent ? { content: data.content } : {}),
      },
    });

    response.writeHead(200, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(article));

    return;
  }

  if (request.method === 'DELETE' && slug) {
    const articleSlug = decodeURIComponent(slug);

    const existingArticle = await prisma.article.findUnique({
      where: { slug: articleSlug },
    });

    if (!existingArticle) {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'Article not found' }));

      return;
    }

    await prisma.article.delete({
      where: { slug: articleSlug },
    });

    response.writeHead(204);
    response.end();

    return;
  }

  const uploadKeyMatch = request.url?.match(/^\/uploads\/([^/?]+)$/);
  const key = uploadKeyMatch?.[1];

  if (request.method === 'GET' && key) {
    try {
      const file = await getFile(decodeURIComponent(key));

      response.writeHead(200, {
        'Content-Type': file.contentType,
      });

      response.end(file.body);
      return;
    } catch {
      response.writeHead(404, {
        'Content-Type': 'application/json',
      });

      response.end(JSON.stringify({ message: 'File not found' }));
      return;
    }
  }

  response.writeHead(404, {
    'Content-Type': 'application/json',
  });

  response.end(
    JSON.stringify({
      message: 'Not found',
    }),
  );
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Server started on http://localhost:3000');
});
