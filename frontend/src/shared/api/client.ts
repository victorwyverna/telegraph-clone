const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, options);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    throw new Error(body?.message ?? 'Не удалось выполнить запрос');
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

export function uploadUrl(key: string) {
  return `${apiUrl}/uploads/${encodeURIComponent(key)}`;
}

export function uploadKeyFromUrl(src: string) {
  try {
    const url = new URL(src, window.location.origin);
    const api = new URL(apiUrl, window.location.origin);
    const prefix = `${api.pathname.replace(/\/$/, '')}/uploads/`;

    if (url.origin !== api.origin || !url.pathname.startsWith(prefix))
      return null;

    return decodeURIComponent(url.pathname.slice(prefix.length)) || null;
  } catch {
    return null;
  }
}
