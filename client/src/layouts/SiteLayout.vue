<!--
  Guest layout: skip link, header with name and phone number, the page, and a footer with the
  opening period and contact details. Port of MainLayout.razor.
-->
<script setup>
import AppIcon from '../components/ui/AppIcon.vue';
import SiteLogo from '../components/ui/SiteLogo.vue';
import { openingText, useCampsite } from '../composables/useCampsite.js';

const campsite = useCampsite();
</script>

<template>
  <a class="skip-link" href="#content">Ga naar de inhoud</a>

  <header class="site-header">
    <div class="site-header__inner">
      <RouterLink class="site-header__brand" to="/">
        <SiteLogo />
        <span>{{ campsite.name }}</span>
      </RouterLink>
      <a v-if="campsite.phone" class="site-header__phone" :href="campsite.phoneHref">
        <AppIcon name="phone" />
        <span><span class="site-header__phone-label">Liever bellen? </span>{{ campsite.phone }}</span>
      </a>
    </div>
  </header>

  <main id="content" class="site-main" tabindex="-1">
    <slot />
  </main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <section class="site-footer__block" aria-labelledby="footer-name">
        <h2 id="footer-name" class="site-footer__title">{{ campsite.name }}</h2>
        <p>Kamperen bij de boer, met plek voor je tent, caravan of camper, en acht ingerichte safaritenten.</p>
      </section>
      <section class="site-footer__block" aria-labelledby="footer-open">
        <h2 id="footer-open" class="site-footer__title">Openingstijden</h2>
        <p><AppIcon name="calendar" /> {{ openingText(campsite.season) }}</p>
      </section>
      <section class="site-footer__block" aria-labelledby="footer-contact">
        <h2 id="footer-contact" class="site-footer__title">Contact</h2>
        <ul class="site-footer__list">
          <li v-if="campsite.phone"><a :href="campsite.phoneHref"><AppIcon name="phone" /> {{ campsite.phone }}</a></li>
          <li v-if="campsite.email"><a :href="`mailto:${campsite.email}`"><AppIcon name="mail" /> {{ campsite.email }}</a></li>
        </ul>
      </section>
    </div>
    <div class="site-footer__bottom">
      <RouterLink to="/admin"><AppIcon name="lock" /> Inloggen voor medewerkers</RouterLink>
    </div>
  </footer>
</template>
