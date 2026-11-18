// All pages and their addresses.
//   meta.layout         'site' (guests, default) or 'admin' (staff)
//   meta.title          text in the browser tab
//   meta.requiresStaff  only for signed-in staff; others go to the sign-in page and come back afterwards
// The API checks sign-in again for every staff request: this guard only decides which page to show.
import { nextTick } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import { useAuth } from './stores/auth.js';

const routes = [
  { path: '/', component: HomePage, meta: { title: 'Camping De Groene Weide – reserveer je plek' } },
  { path: '/reserveren', component: () => import('./pages/BookingPage.vue'), meta: { title: 'Reserveren – Camping De Groene Weide' } },
  { path: '/account/login', component: () => import('./pages/account/LoginPage.vue'), meta: { layout: 'admin', title: 'Inloggen – De Groene Weide' } },
  {
    path: '/admin',
    component: () => import('./pages/admin/DashboardPage.vue'),
    meta: { layout: 'admin', requiresStaff: true, title: 'Dagoverzicht – De Groene Weide' },
  },
  { path: '/:pathMatch(.*)*', component: () => import('./pages/NotFoundPage.vue'), meta: { title: 'Pagina niet gevonden – Camping De Groene Weide' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  // Back/forward restores the scroll position; a new page starts at the top.
  scrollBehavior: (to, from, savedPosition) => savedPosition ?? (to.hash ? { el: to.hash } : { top: 0 }),
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresStaff) return true;
  const auth = useAuth();
  await auth.ensureChecked();
  return auth.staff.value ? true : { path: '/account/login', query: { returnUrl: to.fullPath } };
});

// After moving to another page: a new tab title, and keyboard and screen reader focus on the
// page heading (like FocusOnNavigate in the C# version). Not on the very first page load.
router.afterEach((to, from, failure) => {
  if (failure) return;
  document.title = to.meta.title ?? 'Camping De Groene Weide';
  if (from.matched.length === 0) return;
  nextTick(() => {
    const heading = document.querySelector('#content h1');
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  });
});
