import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../utils';

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuItem = ContextMenuPrimitive.Item;
export const ContextMenuSeparator = ContextMenuPrimitive.Separator;

export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          'z-50 min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}
