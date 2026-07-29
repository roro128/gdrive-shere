import type { D1Database } from '@cloudflare/workers-types';

declare global {
  interface Env {
    DB: D1Database;
    APP_ORIGIN?: string;
    RP_ID?: string;
    AUTH_SECRET?: string;
    APP_ENCRYPTION_KEY?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_ADMIN_EMAILS?: string;
    GOOGLE_API_KEY?: string;
    GOOGLE_REDIRECT_URI?: string;
  }
}
