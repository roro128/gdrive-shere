<script lang="ts">
  type UserPreviewProps = {
    displayName: string;
    handle?: string | null;
    loginId?: string | null;
    avatarUrl?: string | null;
  };

  let { displayName, handle, loginId, avatarUrl }: UserPreviewProps = $props();
  let initial = $derived(displayName.trim().slice(0, 1).toUpperCase() || '?');
  let identity = $derived(`@${handle ?? loginId ?? 'member'}`);
</script>

<span class="user-preview">
  {#if avatarUrl}<img class="avatar" src={avatarUrl} alt="" />{:else}<span class="avatar"
      >{initial}</span
    >{/if}
  <span class="user-copy">
    <strong>{displayName}</strong>
    <small>{identity}</small>
  </span>
</span>

<style>
  .user-preview {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
  }

  .avatar {
    display: grid;
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    place-items: center;
    border-radius: 50%;
    color: #17120d;
    background: var(--copper);
    font-size: 0.72rem;
    font-weight: 700;
    object-fit: cover;
  }

  .user-copy {
    min-width: 0;
  }

  strong,
  small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 0.78rem;
    font-weight: 600;
  }

  small {
    margin-top: 3px;
    color: var(--dim);
    font:
      0.64rem 'DM Mono',
      monospace;
  }
</style>
