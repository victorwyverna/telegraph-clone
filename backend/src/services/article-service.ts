import slugify from '@sindresorhus/slugify';
import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

export type ArticleRepository = Pick<PrismaClient, 'article'>;

type Article = Awaited<ReturnType<PrismaClient['article']['findUnique']>>;

function publicArticle(article: NonNullable<Article>) {
  const { editToken: _, ...result } = article;

  return result;
}

function toJsonObject(data: Record<string, unknown>): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

function articleSlug(value: string) {
  const slug = slugify(value).slice(0, 80).replace(/-+$/g, '');

  return slug || 'article';
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export class ArticleService {
  constructor(private readonly prisma: ArticleRepository) {}

  list() {
    return this.prisma.article
      .findMany()
      .then((articles) => articles.map(publicArticle));
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug } });

    return article ? publicArticle(article) : null;
  }

  async create(input: {
    slug?: string | undefined;
    title: string;
    content: Record<string, unknown>;
  }) {
    const baseSlug = articleSlug(input.slug ?? input.title);

    for (let suffix = 1; suffix <= 100; suffix += 1) {
      const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;

      try {
        const article = await this.prisma.article.create({
          data: {
            slug,
            editToken: randomUUID(),
            title: input.title,
            content: toJsonObject(input.content),
          },
        });

        return {
          article: publicArticle(article),
          editToken: article.editToken!,
        };
      } catch (error) {
        if (isUniqueConstraintError(error)) continue;

        throw error;
      }
    }

    return null;
  }

  async update(
    slug: string,
    input: {
      title?: string | undefined;
      content?: Record<string, unknown> | undefined;
      editToken: string;
    }
  ) {
    const result = await this.prisma.article.updateMany({
      where: { slug, editToken: input.editToken },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.content === undefined
          ? {}
          : { content: toJsonObject(input.content) }),
      },
    });

    if (result.count) return this.findBySlug(slug);

    return (await this.findBySlug(slug)) ? 'forbidden' : null;
  }

  async delete(slug: string, editToken: string) {
    const result = await this.prisma.article.deleteMany({
      where: { slug, editToken },
    });

    if (result.count) return true;

    return (await this.findBySlug(slug)) ? 'forbidden' : false;
  }
}
