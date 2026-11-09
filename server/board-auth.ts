import type {Request} from 'express';
import type {User} from '../src/types';

export interface BoardAuthorization {
  member: (req: Request) => Promise<User>;
  admin: (req: Request) => Promise<User>;
  audit: (actorId: string, targetId: string, action: string, details: object) => Promise<void>;
}
