import './app.css';
import App from './App.svelte';
import 'virtual:windi.css';
import { mount } from 'svelte';

mount(App, {
  target: document.getElementById('app'),
});
