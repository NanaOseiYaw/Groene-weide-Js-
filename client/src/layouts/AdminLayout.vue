<!--
  Staff layout: calmer and larger than the guest site, extra high contrast (black on white),
  no images. A large menu and a clear "Uitloggen" button. Port of AdminLayout.razor.
  The design direction of the staff section is kept on purpose (chosen for Anita, see the migration plan).
  When printing (daily overview) the header and menu disappear (_admin.scss).
-->
<script setup>
import { useRouter } from 'vue-router';
import AppIcon from '../components/ui/AppIcon.vue';
import SiteLogo from '../components/ui/SiteLogo.vue';
import { useAuth } from '../stores/auth.js';

const auth = useAuth();
const router = useRouter();

const menu = [
  { to: '/admin', icon: 'day', label: 'Dagoverzicht', exact: true },
  { to: '/admin/reservations', icon: 'list', label: 'Reserveringen' },
  { to: '/admin/spots', icon: 'location', label: 'Plekken' },
  { to: '/admin/new-reservation', icon: 'plus', label: 'Nieuwe reservering' },
  { to: '/admin/photos', icon: 'photo', label: "Foto's" },
];

async function signOut() {
  await auth.signOut();
  router.push({ path: '/account/login', query: { loggedOut: '1' } });
}
</script>

<template>
  <div class="admin">
    <a class="skip-link" href="#content">Ga naar de inhoud</a>

    <header class="admin-header">
      <div class="admin-header__inner">
        <RouterLink class="admin-header__brand" to="/admin">
          <SiteLogo />
          <span>De Groene Weide <span class="admin-header__sub">medewerkers</span></span>
        </RouterLink>
        <div v-if="auth.staff.value" class="admin-header__user">
          <span>Ingelogd als <strong>{{ auth.staff.value.name }}</strong></span>
          <button type="button" class="btn btn--secondary btn--small" @click="signOut"><AppIcon name="sign-out" /> Uitloggen</button>
        </div>
      </div>
      <nav v-if="auth.staff.value" class="admin-nav" aria-label="Medewerkersmenu">
        <ul class="admin-nav__list">
          <li v-for="item in menu" :key="item.to">
            <RouterLink v-slot="{ href, navigate, isActive, isExactActive }" :to="item.to" custom>
              <a
                :href="href"
                :class="['admin-nav__link', { active: item.exact ? isExactActive : isActive }]"
                :aria-current="(item.exact ? isExactActive : isActive) ? 'page' : undefined"
                @click="navigate"
              ><AppIcon :name="item.icon" /> {{ item.label }}</a>
            </RouterLink>
          </li>
        </ul>
      </nav>
    </header>

    <main id="content" class="admin-main" tabindex="-1">
      <slot />
    </main>
  </div>
</template>
