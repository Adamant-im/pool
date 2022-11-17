<script>
  import DashboardItem from './DashboardItem.svelte';
  import {parseADM} from '../utils.js';

  export let store; export let system;

  let items = [];
  let smallItems = [];

  $: {
    items = [
      {
        name: 'Total forged',
        value: parseADM(store?.delegate.forged),
        isADM: true,
      },
      {
        name: 'Forged this period',
        value: parseADM(system?.payoutperiodForged),
        isADM: true,
      },
      {
        name: 'Balance',
        value: parseADM(store?.delegate.balance),
        isADM: true,
      },
      {
        name: 'Pending rewards',
        value: parseADM(system?.payoutperiodRewards),
        isADM: true,
      },
    ];
  }

  $: {
    smallItems = [
      {
        name: 'Rank',
        value: store?.delegate.rank,
      },
      {
        name: 'Vote weight',
        value: parseADM(store?.delegate.votesWeight),
        isADM: true,
      },
      {
        name: 'Approval',
        value: store?.delegate.approval,
      },
      {
        name: (
          store?.delegate.rank <= 101 ?
            'Productivity' :
            'Status'
        ),
        value: (
          store?.delegate.rank <= 101 ?
            `${store?.delegate.productivity}%` :
            'Standby'
        ),
        needAttention: store?.delegate.rank > 101,
      },
    ];
  }
</script>

<div>
  <div class="flex flex-wrap items-center mt-6 gap-6">
    {#each items as item (item.name)}
      <DashboardItem
        name={item.name}
        value={item.value}
        isADM={item.isADM}
      />
    {/each}
  </div>
  <div class="flex flex-wrap items-center mt-6 gap-6">
    {#each smallItems as item (item.name)}
      <DashboardItem
        name={item.name}
        value={item.value}
        isADM={item.isADM}
        isSmall={true}
        needAttention={item.needAttention}
      />
    {/each}
  </div>
</div>
