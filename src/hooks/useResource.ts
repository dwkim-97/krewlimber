import {useEffect, useState} from 'react';
import {api} from '@/apis/client';

export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, {signal: controller.signal})
      .then(value => {
        setData(value);
        setError('');
      })
      .catch(error => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : '정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return {
    data,
    error,
    loading,
    reload: () => {
      setLoading(true);
      setVersion(value => value + 1);
    },
  };
}
