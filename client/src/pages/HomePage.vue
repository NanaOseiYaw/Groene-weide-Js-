<!--
  TEMPORARY home page: a straight port of booking step 1 from the C# version (hero + the three fields),
  so the migrated styles can be compared with the original. Phase 8 replaces it with the new home page.
-->
<script setup>
import { onMounted, ref } from 'vue';
import { euro } from '@groene-weide/shared/format';
import { getSpotTypes } from '../api/campsite.js';
import AppIcon from '../components/ui/AppIcon.vue';
import FieldSign from '../components/ui/FieldSign.vue';
import { openingText, useCampsite } from '../composables/useCampsite.js';

const campsite = useCampsite();
const prices = ref({});

const fields = [
  {
    type: 'TentCaravan', name: 'Kampeerveld', icon: 'tent', image: '/img/field-tents.webp',
    alt: 'Impressie van het Kampeerveld: drie tenten en een caravan op een ruim grasveld.',
    text: 'Ruime grasplekken voor je eigen tent of caravan, voor maximaal zes personen.',
  },
  {
    type: 'Camper', name: 'Camperveld', icon: 'camper', image: '/img/field-campers.webp',
    alt: 'Impressie van het Camperveld: witte campers op ruime grasplekken met een grindstrook.',
    text: 'Camperplekken met stroom en water, voor maximaal vier personen.',
  },
  {
    type: 'Safari', name: 'Safariveld', icon: 'safari', image: '/img/field-safari.webp',
    alt: 'Impressie van het Safariveld: twee safaritenten met een houten terras tussen de bomen.',
    text: 'Ingerichte safaritenten met bedden en een eigen terras, voor maximaal vier personen.',
  },
];

onMounted(async () => {
  try {
    prices.value = Object.fromEntries((await getSpotTypes()).map((t) => [t.type, t.pricePerNightCents]));
  } catch {
    // Without prices the cards still work; the "Vanaf …" line is simply left out.
  }
});
</script>

<template>
  <section class="hero" aria-labelledby="start-heading">
    <!-- The only image that loads straight away (no lazy loading): it is the first thing guests see. -->
    <img
      class="hero__image"
      src="/img/hero-meadow.webp"
      srcset="/img/hero-meadow-800.webp 800w, /img/hero-meadow.webp 1365w"
      sizes="(min-width: 48em) 66vw, 100vw"
      width="1365"
      height="768"
      fetchpriority="high"
      alt="Een open grasveld met bomen in de ochtendnevel, met rechts in de verte een paar tenten en een caravan."
    />
    <div class="hero__panel">
      <h1 id="start-heading" class="hero__title" tabindex="-1">Een rustige plek in het groen</h1>
      <p class="hero__lead">Kies je plek, zie meteen wat er vrij is en reserveer in een paar stappen. Je hebt geen account nodig.</p>
      <div class="hero__actions">
        <RouterLink class="btn btn--large" to="/reserveren">Reserveer een plek</RouterLink>
        <a v-if="campsite.phone" class="hero__phone" :href="campsite.phoneHref"><AppIcon name="phone" /> Liever bellen? {{ campsite.phone }}</a>
      </div>
      <p class="hero__season"><AppIcon name="calendar" /> {{ openingText(campsite.season) }}</p>
    </div>
  </section>

  <section class="fields-intro" aria-labelledby="fields-heading">
    <h2 id="fields-heading" class="fields-intro__title">Waar wil je staan?</h2>
    <p class="fields-intro__lead">De camping heeft drie velden. Kies er een om meteen te beginnen.</p>

    <ul class="field-cards">
      <li v-for="field in fields" :key="field.type" class="field-card">
        <div class="field-card__media">
          <img class="field-card__image" :src="field.image" :alt="field.alt" width="1264" height="790" loading="lazy" />
          <span class="field-card__impression">Impressie</span>
        </div>
        <div class="field-card__body">
          <span class="field-card__sign"><FieldSign :name="field.name" :icon-name="field.icon" /></span>
          <p class="field-card__text">{{ field.text }}</p>
          <p v-if="prices[field.type] > 0" class="field-card__price">Vanaf {{ euro(prices[field.type]) }} per nacht</p>
          <RouterLink class="btn btn--secondary" :to="{ path: '/reserveren', query: { type: field.type } }">Kies het {{ field.name }}</RouterLink>
        </div>
      </li>
    </ul>
  </section>
</template>
