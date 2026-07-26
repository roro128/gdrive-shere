<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children, tone = 'neutral' } = $props<{
    children?: Snippet;
    tone?: 'neutral' | 'success' | 'warning';
  }>();
</script>

<span class={`ui-badge ui-badge-${tone}`}
  >{#if children}{@render children()}{/if}</span
>
