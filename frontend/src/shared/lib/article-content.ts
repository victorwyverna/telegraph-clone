import { generateHTML, type JSONContent } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';

export const articleExtensions = [
  StarterKit,
  Link.configure({ openOnClick: false }),
  Image,
];

export function articleHtml(content: Record<string, unknown>) {
  return generateHTML(content as JSONContent, articleExtensions);
}

export function sanitizeHtml(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html');

  document
    .querySelectorAll('script, style, iframe, object, embed')
    .forEach((node) => node.remove());
  document.querySelectorAll<HTMLElement>('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const isEvent = attribute.name.toLowerCase().startsWith('on');
      const isUrl = ['href', 'src'].includes(attribute.name.toLowerCase());
      const isUnsafeUrl = isUrl && !/^(https?:)?\//i.test(attribute.value);

      if (isEvent || isUnsafeUrl) element.removeAttribute(attribute.name);
    }
  });

  return document.body.innerHTML;
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  return slug || `article-${Date.now()}`;
}
