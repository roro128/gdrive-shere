import type { HTMLAttributes } from 'react';
import { cn } from '../../utils';

export function Badge({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex w-fit items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground',
        className
      )}
      {...props}
    />
  );
}
