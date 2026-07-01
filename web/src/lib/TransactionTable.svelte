<script>
  // @ts-nocheck
  import DataTable, {Head, Row, Cell, Body, Pagination} from '@smui/data-table';
  import IconButton from '@smui/icon-button';
  import {Label} from '@smui/common';
  import Select, {Option} from '@smui/select';

  import {formatDate, formatNumber, sortBy, splitWholeDecimalNumberParts} from '../utils.js';

  let {rows = []} = $props();

  let perPage = $state(10);
  let currentPage = $state(0);
  let sortDirection = $state('descending');
  let sort = $state('timeStamp');

  const transactions = $derived(sortBy(sortDirection, sort, rows.slice()));
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
</style>

<div class="max-w-280 w-full mt-6">
  <div class="text-xl flex gap-2 items-end mb-4">
    Transactions
    <span class="text-secondary text-sm font-medium">
      {transactions.length}
    </span>
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
        <Cell numeric  columnId="id">
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
          <Cell numeric>{index + 1 + currentPage * perPage}</Cell>
          <Cell>
            <a
                    href={`https://explorer.adamant.im/address/${item.address}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Address details"
            >
              { item.address }
            </a>
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
