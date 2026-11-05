import {useEffect, useState} from 'react';
import {api} from '@/apis/client';

export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, {signal: controller.signal})
      .then(value => {
        if (controller.signal.aborted) return;
        setData(value);
        setError('');
        setLoadedPath(path);
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : '정보를 불러오지 못했습니다.');
          setLoadedPath(path);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return {
    data,
    setData,
    error,
    loading: loading || loadedPath !== path,
    reload: () => {
      setLoading(true);
      setVersion(value => value + 1);
    },
  };
}
