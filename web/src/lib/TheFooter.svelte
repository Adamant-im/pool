<script>
  const links = [
    {
      url: 'https://adamant.im',
      text: 'Adamant.im',
      title: 'Go to ADAMANT Website',
    },
    {
      url: 'https://adamant.im/#adm-apps',
      text: 'Messenger Apps',
      title: 'Start Messaging',
    },
    {
      url: 'https://medium.com/adamant-im/hodl-list-of-adamant-pools-join-in-and-get-rewards-491a98610f4b',
      text: 'Choose a Pool',
      title: 'Join forging and earn ADM',
    },
    {
      url: 'https://medium.com/adamant-im/earning-money-on-adm-forging-4c7b6eb15516',
      text: 'Create a Pool',
      title: 'Create your own ADAMANT Forging Pool',
    },
  ];
</script>

<footer class="flex flex-wrap px-4 gap-4 justify-around py-10 text-center <sm:flex-col">
  {#each links as link (link.url)}
    <a
      href={link.url}
      title={link.title}
      target="_blank"
    >
      {link.text}
    </a>
  {/each}
</footer>
