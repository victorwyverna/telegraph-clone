type JsonObject = Record<string, unknown>;

const blockNodes = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'codeBlock',
  'horizontalRule',
  'image',
]);
const inlineNodes = new Set(['text', 'hardBreak', 'image']);
const marks = new Set(['bold', 'italic', 'strike', 'code', 'link']);

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: JsonObject, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isSafeUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2_048) return false;

  try {
    const url = new URL(value, 'https://article.invalid');

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:' ||
      (value.startsWith('/') && !value.startsWith('//'))
    );
  } catch {
    return false;
  }
}

function validMarks(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;

  return value.every((mark) => {
    if (
      !isObject(mark) ||
      typeof mark.type !== 'string' ||
      !marks.has(mark.type)
    )
      return false;

    if (mark.type !== 'link') return hasOnlyKeys(mark, ['type']);

    if (!hasOnlyKeys(mark, ['type', 'attrs']) || !isObject(mark.attrs))
      return false;

    return (
      hasOnlyKeys(mark.attrs, ['href', 'target', 'rel', 'class']) &&
      isSafeUrl(mark.attrs.href) &&
      (mark.attrs.target === null || mark.attrs.target === '_blank') &&
      (mark.attrs.rel === null || typeof mark.attrs.rel === 'string') &&
      (mark.attrs.class === null || typeof mark.attrs.class === 'string')
    );
  });
}

function validContent(value: unknown, kind: 'block' | 'inline' | 'list') {
  if (!Array.isArray(value)) return false;

  return value.every((node) => validNode(node, kind));
}

function validOptionalInlineContent(value: unknown) {
  return value === undefined || validContent(value, 'inline');
}

function validNode(value: unknown, kind: 'block' | 'inline' | 'list'): boolean {
  if (!isObject(value) || typeof value.type !== 'string') return false;

  if (value.type === 'text') {
    return (
      kind === 'inline' &&
      hasOnlyKeys(value, ['type', 'text', 'marks']) &&
      typeof value.text === 'string' &&
      validMarks(value.marks)
    );
  }

  if (value.type === 'hardBreak')
    return (
      kind === 'inline' &&
      hasOnlyKeys(value, ['type', 'marks']) &&
      validMarks(value.marks)
    );

  if (value.type === 'image') {
    if (
      (kind !== 'block' && kind !== 'inline') ||
      !hasOnlyKeys(value, ['type', 'attrs', 'marks']) ||
      !isObject(value.attrs)
    )
      return false;

    return (
      hasOnlyKeys(value.attrs, ['src', 'alt', 'title']) &&
      isSafeUrl(value.attrs.src) &&
      (value.attrs.alt === null || typeof value.attrs.alt === 'string') &&
      (value.attrs.title === null || typeof value.attrs.title === 'string') &&
      validMarks(value.marks)
    );
  }

  if (value.type === 'listItem')
    return (
      kind === 'list' &&
      hasOnlyKeys(value, ['type', 'content']) &&
      validContent(value.content, 'block')
    );

  if (kind !== 'block' || !blockNodes.has(value.type)) return false;

  switch (value.type) {
    case 'paragraph':
      return (
        hasOnlyKeys(value, ['type', 'content']) &&
        validOptionalInlineContent(value.content)
      );
    case 'blockquote':
      return (
        hasOnlyKeys(value, ['type', 'content']) &&
        validContent(value.content, 'block')
      );
    case 'heading':
      return (
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        isObject(value.attrs) &&
        hasOnlyKeys(value.attrs, ['level']) &&
        typeof value.attrs.level === 'number' &&
        Number.isInteger(value.attrs.level) &&
        value.attrs.level >= 1 &&
        value.attrs.level <= 6 &&
        validOptionalInlineContent(value.content)
      );
    case 'bulletList':
      return (
        hasOnlyKeys(value, ['type', 'content']) &&
        validContent(value.content, 'list')
      );
    case 'orderedList':
      return (
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        isObject(value.attrs) &&
        hasOnlyKeys(value.attrs, ['start', 'type']) &&
        typeof value.attrs.start === 'number' &&
        Number.isInteger(value.attrs.start) &&
        value.attrs.start >= 1 &&
        (value.attrs.type === null || typeof value.attrs.type === 'string') &&
        validContent(value.content, 'list')
      );
    case 'codeBlock':
      return (
        hasOnlyKeys(value, ['type', 'attrs', 'content']) &&
        isObject(value.attrs) &&
        hasOnlyKeys(value.attrs, ['language']) &&
        (value.attrs.language === null ||
          typeof value.attrs.language === 'string') &&
        validOptionalInlineContent(value.content)
      );
    case 'horizontalRule':
      return hasOnlyKeys(value, ['type']);
  }

  return false;
}

/** Validates the exact subset of the TipTap schema exposed by the editor. */
export function isTiptapContent(value: unknown): value is JsonObject {
  return (
    isObject(value) &&
    hasOnlyKeys(value, ['type', 'content']) &&
    value.type === 'doc' &&
    Array.isArray(value.content) &&
    value.content.length > 0 &&
    validContent(value.content, 'block')
  );
}
