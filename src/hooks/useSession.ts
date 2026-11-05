import {useContext} from 'react';
import {SessionContext} from '@/stores/session';

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
