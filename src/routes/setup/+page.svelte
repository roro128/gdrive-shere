<script lang="ts">
  import AuthPanel from '$lib/components/AuthPanel.svelte';
</script>

<main class="auth-page"><AuthPanel setupMode /></main>

<style>
  .auth-page {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 24px;
    background: radial-gradient(circle at 70% 5%, #231a12 0, #0b0d0f 35%);
  }
</style>
