export type Article = {
  id: number;
  slug: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ArticleInput = {
  title: string;
  html: string;
};
