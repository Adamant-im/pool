import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Cannot mount ADAMANT Forging Pool dashboard: #app element is missing.');
}

mount(App, {
  target,
});
