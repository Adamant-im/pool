<script>
  // @ts-nocheck
  import DataTable, {Head, Row, Cell, Body, Pagination} from '@smui/data-table';
  import IconButton from '@smui/icon-button';
  import {Label} from '@smui/common';
  import Select, {Option} from '@smui/select';

  import {formatNumber, splitWholeDecimalNumberParts, sortBy} from '../utils.js';

  let {rows = [], votesWeight, activeAddresses = new Set(), delegate, names = new Map()} = $props();

  let activeOnly = $state(false);
  let query = $state('');
  let perPage = $state(10);
  let currentPage = $state(0);
  let sortDirection = $state('descending');
  let sort = $state('pending');

  function voterName(voter) {
    return names.get(voter.address)
      || voter.username
      || (delegate && voter.address === delegate.address ? delegate.username : '')
      || '';
  }

  // Precompute each voter's share of the total vote weight so the column is sortable.
  const withPercent = $derived(rows.map((voter) => ({
    ...voter,
    weightPercent: activeAddresses.has(voter.address) && votesWeight && voter.weightADM
      ? voter.weightADM / votesWeight * 10000000000
      : null,
  })));

  const filteredRows = $derived(
    withPercent.filter((voter) => {
      if (activeOnly && !activeAddresses.has(voter.address)) return false;

      const q = query.trim().toLowerCase();
      if (q && !voter.address.toLowerCase().includes(q) && !voterName(voter).toLowerCase().includes(q)) {
        return false;
      }

      return true;
    }),
  );

  const voters = $derived(sortBy(sortDirection, sort, filteredRows.slice()));
  const lastPage = $derived(Math.max(Math.ceil(voters.length / perPage) - 1, 0));
  const start = $derived(currentPage * perPage);
  const end = $derived(Math.min(start + perPage, voters.length));
  const slice = $derived(voters.slice(start, end));

  // Keep the current page within range when the list shrinks (filter/perPage).
  $effect(() => {
    if (currentPage > lastPage) currentPage = lastPage;
  });

  function formatWeightPercent(weightPercent) {
    if (weightPercent == null) return null;

    return weightPercent > 0 && weightPercent < 0.01 ? '> 0.01%' : `${weightPercent.toFixed(2)}%`;
  }
</script>

<style>
  .bold-white {
    font-weight: bold;
  }

  .delegate-name {
    display: block;
    margin-top: .125rem;
  }

  .table-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: .5rem;
  }

  .filter-input {
    min-width: 12rem;
    padding: .25rem .5rem;
    font-size: .875rem;
    font-weight: 400;
    color: #fff;
    background: transparent;
    border: 1px solid hsla(0, 0%, 100%, .24);
    border-radius: .25rem;
    outline: none;
  }

  .filter-input::placeholder {
    color: #8a8a8a;
  }

  .filter-input:focus {
    border-color: var(--mdc-theme-primary);
  }

  .active-filter {
    display: flex;
    align-items: center;
    gap: .375rem;
    font-size: .875rem;
    color: #b8b8b8;
    cursor: pointer;
    user-select: none;
  }

  .active-filter input {
    cursor: pointer;
    accent-color: var(--mdc-theme-primary);
  }
</style>

<div class="max-w-280 w-full mt-6">
  <div class="text-xl flex gap-2 items-end mb-4">
    Voters
    <span class="text-secondary text-sm font-medium">
      {voters.length}
    </span>
    <div class="table-controls">
      <input
        class="filter-input"
        type="text"
        placeholder="Address or name"
        bind:value={query}
        oninput={() => (currentPage = 0)}
      />
      <label class="active-filter">
        <input
          type="checkbox"
          bind:checked={activeOnly}
          onchange={() => (currentPage = 0)}
        />
        Active
      </label>
    </div>
  </div>
  <DataTable
    sortable
    bind:sort={sort}
    bind:sortDirection={sortDirection}
    table$aria-label="User list"
    style="width: 100%;"
  >
    <Head>
      <Row>
        <Cell columnId="id">
          <Label>#</Label>
        </Cell>
        <Cell style="width: 100%;" columnId="address">
          <Label>Address</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell
          numeric
          columnId="pending"
          class={
            sort==='pending' && sortDirection==='descending' ?
              'mdc-data-table__header-cell--sorted-descending' : ''
          }
        >
          <Label>Pending</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell numeric columnId="received">
          <Label>Received</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell numeric columnId="balanceADM">
          <Label>Balance</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell numeric columnId="votesCount">
          <Label>Votes</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell numeric columnId="weightADM">
          <Label>Weight</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell numeric columnId="weightPercent">
          <Label>% of Total votes</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
      </Row>
    </Head>
    <Body>
      {#each slice as voter, index}
        <Row>
          <Cell>{ index + 1 + currentPage * perPage }</Cell>
          <Cell>
            {#if delegate && voter.address === delegate.address}
              <a
                      href={`https://explorer.adamant.im/delegate/${voter.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Delegate details"
              >
                { voter.address }
              </a>
              <a
                      class="delegate-name"
                      href={`https://explorer.adamant.im/delegate/${voter.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Delegate details"
              >
                {delegate.username} <sub>{delegate.rank}</sub>
              </a>
            {:else}
              <a
                      href={`https://explorer.adamant.im/address/${voter.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Address details"
              >
                { voter.address }
              </a>
            {/if}
          </Cell>
          <Cell numeric>
            {#if voter.pending}
              {@const formatted = splitWholeDecimalNumberParts(formatNumber(voter.pending))}
              {#if formatted.decimal}
                <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
              {:else}
                  <span class="bold-white">{formatted.whole}</span>
              {/if}
            {:else}
              —
            {/if}
          </Cell>
          <Cell numeric>
            {#if voter.received}
              {@const formatted = splitWholeDecimalNumberParts(formatNumber(voter.received))}
              {#if formatted.decimal}
                <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
              {:else}
                <span class="bold-white">{formatted.whole}</span>
              {/if}
            {:else}
              —
            {/if}
          </Cell>
          <Cell numeric>
            {#if voter.balanceADM}
              {@const formatted = splitWholeDecimalNumberParts(formatNumber(voter.balanceADM))}
              {#if formatted.decimal}
                  <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
              {:else}
                  <span class="bold-white">{formatted.whole}</span>
              {/if}
            {:else}
              —
            {/if}
          </Cell>
          <Cell numeric>
            {#if voter.votesCount}
              {@const formatted = splitWholeDecimalNumberParts(formatNumber(voter.votesCount))}
              {#if formatted.decimal}
                <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
              {:else}
                  <span class="bold-white">{formatted.whole}</span>
              {/if}
            {:else}
              —
            {/if}
          </Cell>
          <Cell numeric>
            {#if !activeAddresses.has(voter.address)}
              Not active
            {:else if voter.weightADM}
              {@const formatted = splitWholeDecimalNumberParts(formatNumber(voter.weightADM))}
              {#if formatted.decimal}
                <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
              {:else}
                  <span class="bold-white">{formatted.whole}</span>
              {/if}
            {:else}
              —
            {/if}
          </Cell>
          <Cell numeric>
            {#if voter.weightPercent != null}
              {@const formatted = splitWholeDecimalNumberParts(formatWeightPercent(voter.weightPercent))}
              {#if formatted.decimal}
                <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
              {:else}
                  <span class="bold-white">{formatted.whole}</span>
              {/if}
            {:else}
              —
            {/if}
          </Cell>
        </Row>
      {/each}
    </Body>

    {#snippet paginate()}
      <Pagination class="flex-wrap">
        {#snippet rowsPerPage()}
          <Label>Rows Per Page</Label>
          <Select variant="outlined" bind:value={perPage} noLabel>
            <Option value={10}>10</Option>
            <Option value={25}>25</Option>
            <Option value={100}>100</Option>
          </Select>
        {/snippet}
        {#snippet total()}
          {start + 1}-{end} of {voters.length}
        {/snippet}

        <IconButton
          class="material-icons"
          action="first-page"
          title="First page"
          onclick={() => (currentPage = 0)}
          disabled={currentPage === 0}>first_page</IconButton
        >
        <IconButton
          class="material-icons"
          action="prev-page"
          title="Prev page"
          onclick={() => currentPage--}
          disabled={currentPage === 0}>chevron_left</IconButton
        >
        <IconButton
          class="material-icons"
          action="next-page"
          title="Next page"
          onclick={() => currentPage++}
          disabled={currentPage === lastPage}>chevron_right</IconButton
        >
        <IconButton
          class="material-icons"
          action="last-page"
          title="Last page"
          onclick={() => (currentPage = lastPage)}
          disabled={currentPage === lastPage}>last_page</IconButton
        >
      </Pagination>
    {/snippet}
  </DataTable>
</div>
