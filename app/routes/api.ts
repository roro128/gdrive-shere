import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { dispatchApiRequest } from '../../src/lib/server/api-dispatcher';

export function loader(args: LoaderFunctionArgs) {
  return dispatchApiRequest(args.request, args.context, args.params);
}

export function action(args: ActionFunctionArgs) {
  return dispatchApiRequest(args.request, args.context, args.params);
}
