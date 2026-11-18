// Starts the Vue app: global styles, the router, and the app frame in <div id="app">.
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import './styles/main.scss';

createApp(App).use(router).mount('#app');
