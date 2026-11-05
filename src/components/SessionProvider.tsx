import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {api} from '@/apis/client';
import {SessionContext} from '@/stores/session';
import type {User} from '@/types';
import {SESSION_CHECK_EVENT} from '@/consts';

export function SessionProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const {pathname} = useLocation();
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const data = await api<{user: User | null}>('/me');
      if (request === sequence.current) {
        setUser(data.user);
        setError('');
      }
      return data.user;
    } catch (error) {
      if (request === sequence.current) setError(error instanceof Error ? error.message : '서버에 연결할 수 없습니다.');
      throw error;
    }
  }, []);
  useEffect(() => {
    let active = true;
    function check() {
      void refresh()
        .catch(() => undefined)
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    function checkVisible() {
      if (document.visibilityState === 'visible') check();
    }
    check();
    window.addEventListener(SESSION_CHECK_EVENT, check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', checkVisible);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHECK_EVENT, check);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', checkVisible);
    };
  }, [pathname, refresh]);
  return <SessionContext.Provider value={{user, loading, error, refresh}}>{children}</SessionContext.Provider>;
}
