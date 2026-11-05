import {SESSION_CHECK_EVENT} from '@/consts';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json', ...init.headers},
  });
  const data = await response.json();
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && path !== '/me') {
      window.dispatchEvent(new Event(SESSION_CHECK_EVENT));
    }
    throw new Error(data.error ?? '요청을 처리하지 못했습니다.');
  }
  return data as T;
}
