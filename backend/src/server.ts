import 'dotenv/config';
import { createServer } from 'node:http';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const server = createServer(async (request, response) => {
  if (request.url === '/articles' && request.method === 'POST') {
    let body = '';

    for await (const chunk of request) {
      body += chunk;
    }

    const data = JSON.parse(body);

    const article = await prisma.article.create({
      data: {
        slug: data.slug,
        title: data.title,
        content: data.content,
      },
    });

    response.writeHead(201, {
      'Content-Type': 'application/json',
    });

    response.end(JSON.stringify(article));

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
