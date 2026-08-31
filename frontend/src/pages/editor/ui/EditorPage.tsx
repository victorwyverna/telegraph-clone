import { useSearchParams, useParams } from 'react-router';

import { useArticle } from '@/entities/article/model/queries';
import { ArticleEditor } from '@/features/article-editor';
import { PageMessage } from '@/shared/ui/PageMessage';

export function EditorPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  const { data: article, isPending, error } = useArticle(slug ?? '');

  if (!slug) return <ArticleEditor />;

  if (isPending)
    return (
      <PageMessage>
        <p>Загружаем историю…</p>
      </PageMessage>
    );

  if (error || !article)
    return (
      <PageMessage>
        <h1>История не найдена</h1>
        <p>{error?.message ?? 'Статья не существует'}</p>
      </PageMessage>
    );

  return (
    <ArticleEditor
      article={article}
      articleSlug={slug}
      editToken={searchParams.get('token') ?? undefined}
    />
  );
}
