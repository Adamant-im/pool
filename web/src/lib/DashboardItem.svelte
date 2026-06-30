<script>
  import DotIcon from './icons/DotIcon.svelte';

  export let name; export let value; export let isADM = false; export let isSmall = false; export let needAttention = false;
</script>

<div class="flex-1 min-w-max">
  <div class={`text-secondary ${isSmall ? 'text-sm' : ''}`}>
    {name}
  </div>
  <div class={isSmall ? 'text-2xl flex items-center gap-1' : 'text-3xl flex items-center gap-1'}>
    {value} {isADM ? 'ADM': ''}

    {#if needAttention}
      <div class="text-red">
        <DotIcon/>
      </div>
    {/if}
  </div>
</div>
