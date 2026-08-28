export function articleHtml(content: Record<string, unknown>) {
  if (typeof content.html === 'string') return content.html;

  if (content.type === 'doc' && Array.isArray(content.content))
    return content.content
      .map((node) => {
        if (!isRecord(node) || node.type !== 'paragraph') return '';
        return `<p>${readText(node.content)}</p>`;
      })
      .join('');

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readText(nodes: unknown) {
  if (!Array.isArray(nodes)) return '';

  return nodes
    .map((node) =>
      isRecord(node) && typeof node.text === 'string' ? node.text : ''
    )
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
