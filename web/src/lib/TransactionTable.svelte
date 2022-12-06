<script>
// @ts-nocheck
import DataTable, {Head, Row, Cell, Body, Pagination} from '@smui/data-table';
import IconButton from '@smui/icon-button';
import {Label} from '@smui/common';
import Select, {Option} from '@smui/select';

import {formatDate, formatNumber, sortBy} from '../utils.js';

export let transactions = [];

let rowsPerPage = 10;
let currentPage = 0;

$: start = currentPage * rowsPerPage;
$: end = Math.min(start + rowsPerPage, transactions.length);
$: slice = transactions.slice(start, end);
$: lastPage = Math.max(Math.ceil(transactions.length / rowsPerPage) - 1, 0);

let sortDirection = 'descending';
let sort = 'timeStamp';

function handleSort() {
  transactions = sortBy(sortDirection, sort, transactions);
}
</script>

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
    on:SMUIDataTable:sorted={handleSort}
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
        <Cell columnId="payoutcount">
          <Label>Amount</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell style="text-align: right;" columnId="timeStamp">
          <Label>Date</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
      </Row>
    </Head>
    <Body>
      {#each slice as item, index}
        <Row>
          <Cell numeric>{index + 1 + currentPage * rowsPerPage}</Cell>
          <Cell>{item.address}</Cell>
          <Cell>{item.transactionId}</Cell>
          <Cell>{formatNumber(item.payoutcount)}</Cell>
          <Cell>{formatDate(item.timeStamp)?.YYYY_MM_DD_hh_mm}</Cell>
        </Row>
      {/each}
    </Body>

    <Pagination slot="paginate">
      <svelte:fragment slot="rowsPerPage">
        <Label>Rows Per Page</Label>
        <Select variant="outlined" bind:value={rowsPerPage} noLabel>
          <Option value={10}>10</Option>
          <Option value={25}>25</Option>
          <Option value={100}>100</Option>
        </Select>
      </svelte:fragment>
      <svelte:fragment slot="total">
        {start + 1}-{end} of {transactions.length}
      </svelte:fragment>

      <IconButton
        class="material-icons"
        action="first-page"
        title="First page"
        on:click={() => (currentPage = 0)}
        disabled={currentPage === 0}>first_page</IconButton
      >
      <IconButton
        class="material-icons"
        action="prev-page"
        title="Prev page"
        on:click={() => currentPage--}
        disabled={currentPage === 0}>chevron_left</IconButton
      >
      <IconButton
        class="material-icons"
        action="next-page"
        title="Next page"
        on:click={() => currentPage++}
        disabled={currentPage === lastPage}>chevron_right</IconButton
      >
      <IconButton
        class="material-icons"
        action="last-page"
        title="Last page"
        on:click={() => (currentPage = lastPage)}
        disabled={currentPage === lastPage}>last_page</IconButton
      >
    </Pagination>
  </DataTable>
</div>