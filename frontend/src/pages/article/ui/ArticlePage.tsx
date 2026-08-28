import { useNavigate, useParams } from 'react-router';

import { useArticle } from '@/entities/article/model/queries';
import { sanitizeHtml, articleHtml } from '@/shared/lib/article-content';
import { formatDate } from '@/shared/lib/format-date';
import { PageMessage } from '@/shared/ui/PageMessage';
import { Header } from '@/widgets/header';
import styles from './ArticlePage.module.css';

export function ArticlePage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();

  const { data: article, isPending, error } = useArticle(slug);

  if (isPending)
    return (
      <>
        <Header />
        <PageMessage>
          <p>Загружаем историю…</p>
        </PageMessage>
      </>
    );

  if (error || !article)
    return (
      <>
        <Header />
        <PageMessage>
          <h1>История не найдена</h1>
          <p>{error?.message ?? 'Статья не существует'}</p>
        </PageMessage>
      </>
    );

  const publicUrl = `${window.location.origin}/${encodeURIComponent(article.slug)}`;

  return (
    <>
      <Header />

      <main className={styles.publicArticle}>
        <p className={styles.articleDate}>{formatDate(article.updatedAt)}</p>
        <h1>{article.title}</h1>
        <article
          className={styles.content}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(articleHtml(article.content)),
          }}
        />
        <footer className={styles.footer}>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(publicUrl)}
          >
            Скопировать ссылку
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/${encodeURIComponent(article.slug)}/edit`)
            }
          >
            Редактировать
          </button>
        </footer>
      </main>
    </>
  );
}
