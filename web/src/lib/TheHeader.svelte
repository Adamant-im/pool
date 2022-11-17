<script>
  import GithubIcon from './icons/GithubIcon.svelte';

  import adamanatLogo from '../assets/logo.png';

  export let version = '';
</script>

<header class="bg-black">
  <div class="px-6 py-4 flex justify-between items-center">
    <div class="flex items-center gap-2">
      <img src={adamanatLogo} alt="ADAMANT Logo" class="w-10 h-10">
      <div class="font-medium">
        ADAMANT Forging Pool
        <span class="text-secondary text-sm">
          {version}
        </span>
      </div>
    </div>

    <a href="https://github.com/adamant-im/pool" class="text-2xl">
      <GithubIcon/>
    </a>
  </div>
</header>
