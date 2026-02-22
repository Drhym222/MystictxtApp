import { fetch } from 'expo/fetch';
import { getApiUrl } from './query-client';

export async function apiFetch(route: string, options: {
  method?: string;
  body?: any;
  token?: string | null;
} = {}) {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${route.startsWith('/') ? route.slice(1) : route}`;

  const headers: Record<string, string> = {};
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Request failed: ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.message) msg = parsed.message;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}
