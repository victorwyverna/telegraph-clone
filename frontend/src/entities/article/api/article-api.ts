import { apiRequest } from '@/shared/api/client';

import type {
  Article,
  ArticleInput,
  CreatedArticle,
} from '@/entities/article/model/types';

export const articleApi = {
  getAll: () => apiRequest<Article[]>('/articles'),

  getBySlug: (slug: string) =>
    apiRequest<Article>(`/articles/${encodeURIComponent(slug)}`),

  create: (input: ArticleInput) =>
    apiRequest<CreatedArticle>('/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
      }),
    }),

  update: (slug: string, input: ArticleInput, editToken: string) =>
    apiRequest<Article>(`/articles/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Edit-Token': editToken,
      },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
      }),
    }),

  remove: (slug: string, editToken: string) =>
    apiRequest<void>(`/articles/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
      headers: { 'X-Edit-Token': editToken },
    }),

  uploadImage: (file: File) =>
    apiRequest<{ key: string }>('/uploads', {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    }),

  removeImage: (key: string) =>
    apiRequest<void>(`/uploads/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),
};
