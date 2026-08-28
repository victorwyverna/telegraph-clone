import { useNavigate } from 'react-router';

import { useArticles } from '@/entities/article/model/queries';
import { formatDate } from '@/shared/lib/format-date';
import { Header } from '@/widgets/header';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();

  const { data: articles = [], isPending, error } = useArticles();

  const sorted = [...articles].sort(
    (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
  );

  return (
    <>
      <Header />

      <main className={styles.home}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Пишите свободно</p>
          <h1>
            Делитесь историями,
            <br />
            которым нужен воздух.
          </h1>
          <p className={styles.lead}>
            Чистый лист, красивые тексты и ссылка, которой легко поделиться.
          </p>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => navigate('/new')}
          >
            Начать писать
          </button>
        </section>

        <section
          className={styles.articleList}
          aria-labelledby="articles-heading"
        >
          <div className={styles.sectionHeading}>
            <h2 id="articles-heading">Опубликовано</h2>
            <span>{articles.length} историй</span>
          </div>

          {isPending && <p className={styles.quiet}>Загружаем истории…</p>}

          {error && <p className={styles.errorMessage}>{error.message}</p>}

          {!isPending && !error && articles.length === 0 && (
            <p className={styles.quiet}>
              Здесь появятся ваши опубликованные истории.
            </p>
          )}

          <div className={styles.articleGrid}>
            {sorted.map((article) => (
              <button
                className={styles.articleCard}
                type="button"
                key={article.id}
                onClick={() => navigate(`/${encodeURIComponent(article.slug)}`)}
              >
                <p>{formatDate(article.updatedAt)}</p>
                <h3>{article.title}</h3>
                <span>
                  Читать историю <b>→</b>
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
