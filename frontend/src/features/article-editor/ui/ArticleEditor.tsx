import { useForm } from '@tanstack/react-form';
import { EditorContent, useEditor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  useCreateArticle,
  useDeleteArticle,
  useUpdateArticle,
  useUploadImage,
} from '@/entities/article/model/queries';
import type { Article } from '@/entities/article/model/types';
import { articleHtml, slugify } from '@/shared/lib/article-content';
import { uploadUrl } from '@/shared/api/client';

import styles from './ArticleEditor.module.css';

type Props = { article?: Article; articleSlug?: string };
type Values = { title: string; slug: string };

export function ArticleEditor({ article, articleSlug }: Props) {
  const navigate = useNavigate();

  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();
  const uploadImage = useUploadImage();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const isEditing = Boolean(articleSlug);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: 'Начните писать историю…' }),
    ],
    editorProps: { attributes: { class: styles.contentEditor } },
  });

  const form = useForm({
    defaultValues: { title: '', slug: '' } as Values,
    onSubmit: async ({ value }) => {
      if (!value.title.trim()) {
        setError('Добавьте заголовок истории');

        return;
      }

      setError('');

      try {
        if (!editor) return;

        const input = {
          title: value.title.trim(),
          content: editor.getJSON(),
        };
        const saved =
          isEditing && articleSlug
            ? await updateArticle.mutateAsync({ slug: articleSlug, input })
            : await createArticle.mutateAsync({
                slug: slugify(value.slug || value.title),
                input,
              });

        navigate(`/${encodeURIComponent(saved.slug)}`);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось сохранить историю'
        );
      }
    },
  });

  useEffect(() => {
    if (!article) return;

    const values = {
      title: article.title,
      slug: article.slug,
    };

    form.reset(values);

    editor?.commands.setContent(articleHtml(article.content));
  }, [article, editor, form]);

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError('');

    try {
      const { key } = await uploadImage.mutateAsync(file);

      editor
        ?.chain()
        .focus()
        .setImage({ src: uploadUrl(key) })
        .run();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось загрузить изображение'
      );
    } finally {
      event.target.value = '';
    }
  }

  async function remove() {
    if (
      !articleSlug ||
      !window.confirm('Удалить историю без возможности восстановления?')
    )
      return;

    try {
      await deleteArticle.mutateAsync(articleSlug);

      navigate('/');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Не удалось удалить историю'
      );
    }
  }

  const isSaving =
    createArticle.isPending ||
    updateArticle.isPending ||
    deleteArticle.isPending;

  return (
    <main className={styles.editorPage}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className={styles.editorTopbar}>
          <button
            type="button"
            className={styles.backLink}
            onClick={() =>
              navigate(isEditing ? `/${articleSlug}` : '/articles')
            }
          >
            ← Назад
          </button>
          <div className={styles.editorActions}>
            {isEditing && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => void remove()}
              >
                Удалить
              </button>
            )}
            <button
              className={styles.publishButton}
              type="submit"
              disabled={isSaving}
            >
              {isSaving
                ? 'Сохраняем…'
                : isEditing
                  ? 'Сохранить'
                  : 'Опубликовать'}
            </button>
          </div>
        </div>
        <div className={styles.editorPaper}>
          <form.Field name="title">
            {(field) => (
              <input
                className={styles.titleInput}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder="Заголовок"
                aria-label="Заголовок истории"
                autoFocus
              />
            )}
          </form.Field>
          {!isEditing && (
            <div className={styles.slugField}>
              <span>telegraph.local/</span>
              <form.Field name="slug">
                {(field) => (
                  <input
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="адрес-истории"
                    aria-label="Адрес истории"
                  />
                )}
              </form.Field>
            </div>
          )}
          <div className={styles.toolbar} aria-label="Форматирование текста">
            <button
              type="button"
              className={editor?.isActive('bold') ? styles.active : undefined}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={editor?.isActive('italic') ? styles.active : undefined}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={
                editor?.isActive('heading', { level: 2 })
                  ? styles.active
                  : undefined
              }
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              H2
            </button>
            <button
              type="button"
              className={
                editor?.isActive('bulletList') ? styles.active : undefined
              }
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              • Список
            </button>
            <button
              type="button"
              onClick={() => {
                const url = window.prompt('Вставьте ссылку');
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
            >
              Ссылка
            </button>
            <button
              type="button"
              className={
                editor?.isActive('blockquote') ? styles.active : undefined
              }
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              Цитата
            </button>
            <button
              type="button"
              className={
                editor?.isActive('codeBlock') ? styles.active : undefined
              }
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              Код
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadImage.isPending}
            >
              {uploadImage.isPending ? 'Загрузка…' : 'Изображение'}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => void onImageChange(event)}
              hidden
            />
          </div>
          <EditorContent editor={editor} />
          {error && <p className={styles.errorMessage}>{error}</p>}
        </div>
      </form>
    </main>
  );
}
