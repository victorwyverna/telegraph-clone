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
