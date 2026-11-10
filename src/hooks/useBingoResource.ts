import {useContext, useEffect, useRef, useState} from 'react';
import {api} from '@/apis/client';
import {SessionContext} from '@/stores/session';

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function useBingoResource<T>(endpoint: string) {
  const session = useContext(SessionContext);
  const identity = `${session?.user?.id ?? ''}:${session?.user?.status ?? ''}:${session?.user?.role ?? ''}`;
  const key = `${endpoint}:${identity}`;
  const [data, setData] = useState<T | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const runtime = useRef({
    key: '',
    version: 0,
    active: false,
    busy: false,
    controller: null as AbortController | null,
    refresh: async (_clearError: boolean) => {},
  });

  useEffect(() => {
    const current = runtime.current;
    current.key = key;
    current.active = true;
    current.busy = false;
    setBusy(false);
    setError('');
    setData(null);
    async function load(clearError: boolean) {
      if (!current.active || current.busy || current.key !== key) return;
      if (!clearError && current.controller && !current.controller.signal.aborted) return;
      current.controller?.abort();
      const controller = new AbortController();
      current.controller = controller;
      const version = ++current.version;
      if (clearError) setError('');
      try {
        const value = await api<T>(endpoint, {signal: controller.signal});
        if (controller.signal.aborted || version !== current.version || current.key !== key || !current.active) return;
        setData(value);
        setLoadedKey(key);
      } catch (cause) {
        if (controller.signal.aborted || version !== current.version || current.key !== key || !current.active) return;
        setError(previous => previous || (cause instanceof Error ? cause.message : '빙고 정보를 불러오지 못했습니다.'));
        setLoadedKey(key);
      } finally {
        if (current.controller === controller) current.controller = null;
      }
    }
    current.refresh = load;
    void load(false);
    const timer = window.setInterval(() => void load(false), 3000);
    return () => {
      current.active = false;
      current.version++;
      current.controller?.abort();
      window.clearInterval(timer);
    };
  }, [endpoint, key]);

  async function send(path: string, method: Method, body: object) {
    const current = runtime.current;
    if (!current.active || current.busy || current.key !== key) return false;
    current.controller?.abort();
    const controller = new AbortController();
    current.controller = controller;
    const version = ++current.version;
    current.busy = true;
    setBusy(true);
    setError('');
    let failed = false;
    try {
      const value = await api<T>(path, {method, body: JSON.stringify(body), signal: controller.signal});
      if (controller.signal.aborted || version !== current.version || current.key !== key || !current.active)
        return false;
      setData(value);
      setLoadedKey(key);
      return true;
    } catch (cause) {
      failed = true;
      if (!controller.signal.aborted && version === current.version && current.key === key && current.active) {
        setError(cause instanceof Error ? cause.message : '변경 사항을 저장하지 못했습니다.');
      }
      return false;
    } finally {
      if (version === current.version && current.key === key && current.active) {
        current.busy = false;
        setBusy(false);
        current.controller = null;
        if (failed) void current.refresh(false);
      }
    }
  }

  return {
    data: loadedKey === key ? data : null,
    loading: loadedKey !== key,
    busy,
    error,
    refresh: () => runtime.current.refresh(true),
    send,
  };
}
