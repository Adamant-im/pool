<script>
  // @ts-nocheck
  import DataTable, {Head, Row, Cell, Body, Pagination} from '@smui/data-table';
  import IconButton from '@smui/icon-button';
  import {Label} from '@smui/common';
  import Select, {Option} from '@smui/select';

  import {formatDate, formatNumber, sortBy, splitWholeDecimalNumberParts} from '../utils.js';

  let {rows = [], delegate, names = new Map()} = $props();

  let query = $state('');
  let perPage = $state(10);
  let currentPage = $state(0);
  let sortDirection = $state('descending');
  let sort = $state('timeStamp');

  function itemName(item) {
    return names.get(item.address)
      || (delegate && item.address === delegate.address ? (delegate.username || '') : '')
      || '';
  }

  const filteredRows = $derived(
    rows.filter((item) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;

      return item.address.toLowerCase().includes(q) || itemName(item).toLowerCase().includes(q);
    }),
  );

  const transactions = $derived(sortBy(sortDirection, sort, filteredRows.slice()));
  const lastPage = $derived(Math.max(Math.ceil(transactions.length / perPage) - 1, 0));
  const start = $derived(currentPage * perPage);
  const end = $derived(Math.min(start + perPage, transactions.length));
  const slice = $derived(transactions.slice(start, end));

  $effect(() => {
    if (currentPage > lastPage) currentPage = lastPage;
  });
</script>

<style>
  .bold-white {
    font-weight: bold;
  }

  .address-name {
    display: block;
    margin-top: .125rem;
  }

  .table-heading {
    display: flex;
    align-items: flex-end;
    gap: .5rem;
    width: 100%;
  }

  .table-title {
    display: flex;
    align-items: baseline;
    gap: .5rem;
  }

  .table-controls {
    flex: 1 1 auto;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
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

  @media (max-width: 42rem) {
    .table-heading {
      flex-wrap: wrap;
    }

    .table-controls {
      width: 100%;
    }

    .filter-input {
      flex: 1 1 12rem;
      min-width: 0;
    }
  }
</style>

<div class="max-w-280 w-full mt-6">
  <div class="table-heading text-xl mb-4">
    <div class="table-title">
      Transactions
      <span class="text-secondary text-sm font-medium">
        {transactions.length}
      </span>
    </div>
    <div class="table-controls">
      <input
        class="filter-input"
        type="text"
        placeholder="Address or name"
        bind:value={query}
        oninput={() => (currentPage = 0)}
      />
    </div>
  </div>
   <DataTable
    sortable
    bind:sort={sort}
    bind:sortDirection={sortDirection}
    table$aria-label="Transaction list"
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
        <Cell columnId="transactionId">
          <Label>ID</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell numeric columnId="payoutcount">
          <Label>Amount</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell
          class={
            sort==='timeStamp' && sortDirection==='descending' ?
              'mdc-data-table__header-cell--sorted-descending' : ''
          }
          style="text-align: right;"
          columnId="timeStamp"
        >
          <Label>Date</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
      </Row>
    </Head>
    <Body>
      {#each slice as item, index}
        <Row>
          <Cell>{index + 1 + currentPage * perPage}</Cell>
          <Cell>
            {@const name = itemName(item)}
            {#if delegate && item.address === delegate.address}
              <a
                      href={`https://explorer.adamant.im/address/${item.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Address details"
              >
                { item.address }
              </a>
              <a
                      class="address-name"
                      href={`https://explorer.adamant.im/delegate/${item.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Delegate details"
              >
                {name}
              </a>
            {:else}
              <a
                      href={`https://explorer.adamant.im/address/${item.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Address details"
              >
                { item.address }
              </a>
              {#if name}
                <a
                        class="address-name"
                        href={`https://explorer.adamant.im/delegate/${item.address}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Delegate details"
                >
                  {name}
                </a>
              {/if}
            {/if}
          </Cell>
          <Cell>
            <a
                    href={`https://explorer.adamant.im/tx/${item.transactionId}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Transaction details"
            >
              { item.transactionId }
            </a>
          </Cell>
          <Cell numeric>
            {@const formatted = splitWholeDecimalNumberParts(formatNumber(item.payoutcount))}
            {#if formatted.decimal}
              <span class="bold-white">{formatted.whole}</span><span>{formatted.decimal}</span>
            {:else}
              <span class="bold-white">{formatted.whole}</span>
            {/if}
          </Cell>
          <Cell>{formatDate(item.timeStamp)?.YYYY_MM_DD_hh_mm}</Cell>
        </Row>
      {/each}
    </Body>

    {#snippet paginate()}
      <Pagination>
        {#snippet rowsPerPage()}
          <Label>Rows Per Page</Label>
          <Select variant="outlined" bind:value={perPage} noLabel>
            <Option value={10}>10</Option>
            <Option value={25}>25</Option>
            <Option value={100}>100</Option>
          </Select>
        {/snippet}
        {#snippet total()}
          {start + 1}-{end} of {transactions.length}
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
