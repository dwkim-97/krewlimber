import {createContext} from 'react';
import type {User} from '@/types';

export const SessionContext = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<User | null>;
} | null>(null);
