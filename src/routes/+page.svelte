<script lang="ts">
  import { onMount } from 'svelte';
  import AuthPanel from '$lib/components/AuthPanel.svelte';
  import Workspace from '$lib/components/Workspace.svelte';

  type User = {
    id: string;
    displayName: string;
    handle?: string | null;
    loginId?: string | null;
    avatarUrl?: string | null;
    role: 'admin' | 'member';
    status: string;
  };
  let user = $state<User | null>(null);
  let googleConnected = $state(false);
  let checking = $state(true);

  onMount(async () => {
    try {
      const response = await fetch('/api/me');
      const payload = (await response.json()) as { user: User | null; googleConnected: boolean };
      user = payload.user;
      googleConnected = payload.googleConnected;
    } finally {
      checking = false;
    }
  });
</script>

{#if checking}
  <main class="loading-page">
    <span class="spinner"></span><span class="eyebrow">opening workspace</span>
  </main>
{:else if user}
  <Workspace {user} {googleConnected} />
{:else}
  <main class="auth-page"><AuthPanel /></main>
{/if}

<style>
  .auth-page {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 24px;
    background: radial-gradient(circle at 70% 5%, #231a12 0, #0b0d0f 35%);
  }
  .loading-page {
    display: grid;
    min-height: 100vh;
    place-content: center;
    justify-items: center;
    gap: 14px;
  }
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #2a3037;
    border-top-color: #e3a36a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
