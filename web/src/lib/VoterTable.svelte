<script>
  // @ts-nocheck
  import DataTable, {Head, Row, Cell, Body, Pagination} from '@smui/data-table';
  import IconButton from '@smui/icon-button';
  import {Label} from '@smui/common';
  import Select, {Option} from '@smui/select';

  import {formatNumber, sortBy} from '../utils.js';

  export let rows = [];
  export let votesWeight;

  $: voters = sortBy(sortDirection, sort, rows);

  let rowsPerPage = 10;
  let currentPage = 0;

  $: start = currentPage * rowsPerPage;
  $: end = Math.min(start + rowsPerPage, voters.length);
  $: slice = voters.slice(start, end);
  $: lastPage = Math.max(Math.ceil(voters.length / rowsPerPage) - 1, 0);

  let sortDirection = 'descending';
  let sort = 'pending';

  function calcWeightPercent(weightADM) {
    const weightPercent = weightADM / votesWeight * 10000000000;

    return weightPercent > 0 && weightPercent < 0.01 ? '> 0.01' : weightPercent.toFixed(2);
  }

  function handleSort() {
    voters = sortBy(sortDirection, sort, voters);
  }
</script>

<div class="max-w-280 w-full mt-6">
  <div class="text-xl flex gap-2 items-end mb-4">
    Voters
    <span class="text-secondary text-sm font-medium">
      {voters.length}
    </span>
  </div>
  <DataTable
    sortable
    bind:sort={sort}
    bind:sortDirection={sortDirection}
    on:SMUIDataTable:sorted={handleSort}
    table$aria-label="User list"
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
        <Cell columnId="pending">
          <Label>Pending</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell columnId="received">
          <Label>Received</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell columnId="balanceADM">
          <Label>Balance</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell columnId="votesCount">
          <Label>Votes</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell columnId="weightADM">
          <Label>Weight</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
        <Cell style="text-align: right;" columnId="timeStamp">
          <Label>% of Total votes</Label>
          <IconButton class="material-icons">arrow_upward</IconButton>
        </Cell>
      </Row>
    </Head>
    <Body>
      {#each slice as voter, index}
        <Row>
          <Cell numeric>{ index + 1 + currentPage * rowsPerPage }</Cell>
          <Cell>{ voter.address }</Cell>
          <Cell>{ voter.pending ? formatNumber(voter.pending) : '—' }</Cell>
          <Cell>{ voter.received ? formatNumber(voter.received) : '—' }</Cell>
          <Cell>{ voter.balanceADM ? formatNumber(voter.balanceADM) : '—' }</Cell>
          <Cell>{ voter.votesCount ? formatNumber(voter.votesCount) : '—' }</Cell>
          <Cell>{ voter.weightADM ? formatNumber(voter.weightADM) : '—' }</Cell>
          <Cell>{ votesWeight && voter.weightADM ? calcWeightPercent(voter.weightADM) : '—' }</Cell>
        </Row>
      {/each}
    </Body>

    <Pagination slot="paginate" class="flex-wrap">
      <svelte:fragment slot="rowsPerPage">
        <Label>Rows Per Page</Label>
        <Select variant="outlined" bind:value={rowsPerPage} noLabel>
          <Option value={10}>10</Option>
          <Option value={25}>25</Option>
          <Option value={100}>100</Option>
        </Select>
      </svelte:fragment>
      <svelte:fragment slot="total">
        {start + 1}-{end} of {voters.length}
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
