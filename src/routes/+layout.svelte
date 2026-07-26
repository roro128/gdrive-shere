<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>GShare</title>
</svelte:head>

{@render children()}
