import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { articleApi } from '@/entities/article/api/article-api';

import type { ArticleInput } from '@/entities/article/model/types';

export const articleKeys = {
  all: ['articles'] as const,
  detail: (slug: string) => ['articles', slug] as const,
};

export function useArticles() {
  return useQuery({ queryKey: articleKeys.all, queryFn: articleApi.getAll });
}

export function useArticle(slug: string) {
  return useQuery({
    queryKey: articleKeys.detail(slug),
    queryFn: () => articleApi.getBySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: ArticleInput }) =>
      articleApi.create(slug, input),
    onSuccess: (article) => {
      queryClient.setQueryData(articleKeys.detail(article.slug), article);
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: ArticleInput }) =>
      articleApi.update(slug, input),
    onSuccess: (article) => {
      queryClient.setQueryData(articleKeys.detail(article.slug), article);
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: articleApi.remove,
    onSuccess: (_, slug) => {
      queryClient.removeQueries({ queryKey: articleKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: articleKeys.all });
    },
  });
}

export function useUploadImage() {
  return useMutation({ mutationFn: articleApi.uploadImage });
}

export function useDeleteImage() {
  return useMutation({ mutationFn: articleApi.removeImage });
}
