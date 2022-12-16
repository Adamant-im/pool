<script>
  import Button from '@smui/button';
  import {Label} from '@smui/common';

  import TheHeader from './lib/TheHeader.svelte';
  import TheFooter from './lib/TheFooter.svelte';

  import Dashboard from './lib/Dashboard.svelte';
  import TransactionTable from './lib/TransactionTable.svelte';
  import VoterTable from './lib/VoterTable.svelte';

  import UpdateIcon from './lib/icons/UpdateIcon.svelte';

  import {getAll} from './api.js';

  let transactions = [];
  let voters = [];
  let store; let system;

  let isUpdating = false;

  const updateAll = async () => {
    isUpdating = true;

    try {
      [
        voters,
        transactions,
        store,
        system,
      ] = await getAll();

      // merge and remove duplicates
      voters = voters.concat(
          store.delegate.voters.filter((storeVoter) => (
            !voters.find((dbVoter) => storeVoter.address === dbVoter.address)
          )),
      );
    } finally {
      setTimeout(() => (isUpdating = false), 1000);
    }
  };

  updateAll();

  setInterval(() => updateAll(), 60 * 1000);
</script>

<TheHeader version={system?.version}/>

<main class="px-10 py-10 flex flex-col items-center w-full">
  <div class="max-w-280 w-full">
    <div class="flex justify-between items-center gap-2">
      <div class="text-2xl font-medium">
        Dashboard
      </div>

      <Button variant="raised" on:click={updateAll} disabled={isUpdating}>
        <Label>
          <div class="flex gap-2 items-center">
            <UpdateIcon/>
            Update
          </div>
        </Label>
      </Button>
    </div>

    <p class="mt-4">
      Delegate
      <b class="underline decoration-dotted">
        <a href={`https://explorer.adamant.im/delegate/${store?.delegate.address}`} target="_blank" rel="noreferrer">
          {store?.delegate.username}
        </a>
      </b>
      distributes {system?.reward_percentage}% rewards to
      voters {system?.donate_percentage ? `and donates ${system?.donate_percentage}% to ADAMANT Foundation` : '' } with
      payouts every {system?.payoutperiod}. Minimum payout is {system?.minpayout} ADM.
    </p>

    <Dashboard
      store={store}
      system={system}
    />
  </div>

  <VoterTable
    rows={voters}
    votesWeight={store?.delegate.votesWeight}
  />

  <TransactionTable
    rows={transactions}
  />
</main>

<TheFooter/>
