import type {Request} from 'express';
import type {User} from '../src/types';

export interface BoardAuthorization {
  member: (req: Request) => User;
  admin: (req: Request) => User;
  audit: (actorId: string, targetId: string, action: string, details: object) => void;
}
