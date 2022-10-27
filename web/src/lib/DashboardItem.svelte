<script>
  import DotIcon from './icons/DotIcon.svelte';

  export let name; export let value; export let isADM = false; export let isSmall = false; export let needAttention = false;
</script>

<div class="flex-1 min-w-max">
  <div class={`text-secondary ${isSmall ? 'text-sm' : ''}`}>
    {name}
  </div>
  <div class="text-{isSmall ? 2 : 3}xl flex items-center gap-1">
    {value} {isADM ? 'ADM': ''}

    {#if needAttention}
      <div class="text-red">
        <DotIcon/>
      </div>
    {/if}
  </div>
</div>

<style windi:safelist>
  .text-2xl {
    font-size: 1.5rem;
    line-height: 2rem;
  }

  .text-3xl {
    font-size: 1.875rem;
    line-height: 2.25rem;
  }
</style>
