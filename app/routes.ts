import type { RouteConfig } from '@react-router/dev/routes';
import { index, route } from '@react-router/dev/routes';

export default [
  index('./routes/home.tsx'),
  route('setup', './routes/setup.tsx'),
  route('invite/:token', './routes/invite.tsx'),
  route('reset/:token', './routes/reset.tsx'),
  route('share/:token', './routes/share.tsx'),
  route('api/*', './routes/api.ts'),
  route('*', './routes/not-found.tsx')
] satisfies RouteConfig;
