import type { Config } from './config.js';
import type { DB } from './db/database.js';
import type { Clock } from './lib/dates.js';

/** Everything a service needs, passed in explicitly so tests can swap any piece. */
export interface AppContext {
  db: DB;
  clock: Clock;
  config: Config;
}

export type Role = 'customer' | 'studio';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

/** Just enough of a user to decide which records they may see. */
export type Viewer = Pick<AuthUser, 'id' | 'role'>;

declare global {
  namespace Express {
    interface Request {
      /** Set by the session middleware when a valid session cookie is present. */
      user?: AuthUser;
    }
  }
}
