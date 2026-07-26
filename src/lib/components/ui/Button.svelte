<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'default' | 'secondary' | 'ghost' | 'destructive' | 'link';
  type Size = 'default' | 'sm' | 'lg';

  let {
    children,
    variant = 'default',
    size = 'default',
    class: className = '',
    disabled = false,
    type = 'button',
    onclick
  } = $props<{
    children?: Snippet;
    variant?: Variant;
    size?: Size;
    class?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (event: MouseEvent) => void;
  }>();
</script>

<button
  class={`ui-button ui-button-${variant} ui-button-${size} ${className}`}
  {disabled}
  {type}
  {onclick}
>
  {#if children}{@render children()}{/if}
</button>
