import slugify from '@sindresorhus/slugify';

import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

export type ArticleRepository = Pick<PrismaClient, 'article'>;

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
    return this.prisma.article.findMany();
  }

  findBySlug(slug: string) {
    return this.prisma.article.findUnique({ where: { slug } });
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
        return await this.prisma.article.create({
          data: {
            slug,
            title: input.title,
            content: toJsonObject(input.content),
          },
        });
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
    }
  ) {
    if (!(await this.findBySlug(slug))) return null;

    return this.prisma.article.update({
      where: { slug },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.content === undefined
          ? {}
          : { content: toJsonObject(input.content) }),
      },
    });
  }

  async delete(slug: string) {
    if (!(await this.findBySlug(slug))) return false;

    await this.prisma.article.delete({ where: { slug } });

    return true;
  }
}
