import { drizzle } from 'drizzle-orm/d1';
import { schema } from './auth-schema';

export function createDatabase(event: { platform?: App.Platform }) {
  const database = event.platform?.env?.DB;
  if (!database) throw new Error('Cloudflare D1 binding DB is not configured');
  return drizzle(database, { schema });
}
