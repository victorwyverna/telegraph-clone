import { generateHTML, type JSONContent } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';

export const articleExtensions = [
  StarterKit,
  Link.configure({ openOnClick: false }),
  Image,
];

export function articleHtml(content: Record<string, unknown>) {
  return generateHTML(content as JSONContent, articleExtensions);
}

export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'ul',
      'ol',
      'li',
      'pre',
      'code',
      'br',
      'hr',
      'strong',
      'em',
      's',
      'a',
      'img',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?):|\/(?!\/))/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `article-${Date.now()}`;
}
