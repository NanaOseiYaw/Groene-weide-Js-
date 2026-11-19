<!--
  Home page: the campsite's own landing page (migration plan §7). Editorial and spacious, its own
  structure, deliberately unlike the staff section: a full-width meadow photo, a short introduction,
  the three fields as large photo rows with the painted field sign, how booking works, practical
  information with the season, and a closing call to action. The booking flow itself is /reserveren.
  Styles: styles/components/_home.scss.
-->
<script setup>
import { computed, onMounted, ref } from 'vue';
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
    text: 'Het grootste veld, met veertig ruime grasplekken voor je eigen tent of caravan. Een deel van de plekken ligt in de schaduw van de bomen.',
    facts: [
      { icon: 'people', text: 'Tot zes personen per plek' },
      { icon: 'water', text: 'Water bij elke plek' },
      { icon: 'power', text: 'Stroom op een deel van de plekken' },
    ],
  },
  {
    type: 'Camper', name: 'Camperveld', icon: 'camper', image: '/img/field-campers.webp',
    alt: 'Impressie van het Camperveld: witte campers op ruime grasplekken met een grindstrook.',
    text: 'Twaalf ruime camperplekken. Bij elke plek sluit je direct aan op stroom en water.',
    facts: [
      { icon: 'people', text: 'Tot vier personen per plek' },
      { icon: 'power', text: 'Stroom bij elke plek' },
      { icon: 'water', text: 'Water bij elke plek' },
    ],
  },
  {
    type: 'Safari', name: 'Safariveld', icon: 'safari', image: '/img/field-safari.webp',
    alt: 'Impressie van het Safariveld: twee safaritenten met een houten terras tussen de bomen.',
    text: 'Acht ingerichte safaritenten tussen de bomen. De bedden staan klaar, je hoeft alleen je eigen spullen mee te nemen.',
    facts: [
      { icon: 'people', text: 'Tot vier personen per tent' },
      { icon: 'beds', text: 'Bedden in de tent' },
      { icon: 'terrace', text: 'Eigen terras met stroom' },
    ],
  },
];

const steps = [
  { title: 'Kies je veld en je datums', text: 'In de kalender zie je per dag of er nog plek is.' },
  { title: 'Kies je plek', text: "Bij elke plek zie je foto's en hoe ver het lopen is naar de wc en het zwembad." },
  { title: 'Vul je gegevens in en betaal', text: 'Je krijgt meteen een bevestiging per e-mail. Een account is niet nodig.' },
];

const facilities = [
  { icon: 'pool', title: 'Zwembad', text: 'Op loopafstand van alle drie de velden.' },
  { icon: 'toilet', title: "Wc's", text: 'Bij elke plek zie je hoeveel meter het lopen is naar de wc.' },
  { icon: 'power', title: 'Stroom en water', text: 'Bij de camperplekken en safaritenten altijd, op het Kampeerveld bij een deel van de plekken.' },
  { icon: 'shade', title: 'Schaduw', text: 'Wil je onder de bomen staan? Bij elke plek staat of er schaduw is.' },
];

// The twelve months with "open" or "closed", from the season in the settings (e.g. 04-01 to 10-31).
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTH_NAMES = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const seasonMonths = computed(() => {
  const { start, end } = campsite.value.season;
  const first = Number(start.slice(0, 2));
  const last = Number(end.slice(0, 2));
  const open = (m) => (first <= last ? m >= first && m <= last : m >= first || m <= last);
  return MONTHS.map((short, i) => ({ short, name: MONTH_NAMES[i], open: open(i + 1) }));
});

onMounted(async () => {
  try {
    prices.value = Object.fromEntries((await getSpotTypes()).map((t) => [t.type, t.pricePerNightCents]));
  } catch {
    // Without prices the rows still work; the "vanaf …" line is simply left out.
  }
});
</script>

<template>
  <div class="home">
    <section class="home-hero" aria-labelledby="start-heading">
      <!-- The only image that loads straight away (no lazy loading): it is the first thing guests see. -->
      <img
        class="home-hero__image"
        src="/img/hero-meadow.webp"
        srcset="/img/hero-meadow-800.webp 800w, /img/hero-meadow.webp 1365w"
        sizes="100vw"
        width="1365"
        height="768"
        fetchpriority="high"
        alt="Een open grasveld met bomen in de ochtendnevel, met rechts in de verte een paar tenten en een caravan."
      />
      <div class="home-wrap">
        <div class="home-hero__slab">
          <h1 id="start-heading" class="home-hero__title" tabindex="-1">Een rustige plek in het groen</h1>
          <p class="home-hero__lead">Kamperen bij de boer, met ruimte om je heen. Kies je plek, zie meteen wat er vrij is en reserveer in een paar stappen.</p>
          <div class="home-hero__actions">
            <RouterLink class="btn btn--large btn--sun" to="/reserveren">Reserveer een plek</RouterLink>
            <a v-if="campsite.phone" class="home-hero__phone" :href="campsite.phoneHref"><AppIcon name="phone" /> Liever bellen? {{ campsite.phone }}</a>
          </div>
          <p class="home-hero__season"><AppIcon name="calendar" /> {{ openingText(campsite.season) }}</p>
        </div>
      </div>
    </section>

    <section class="home-intro home-wrap" aria-labelledby="intro-heading">
      <h2 id="intro-heading" class="visually-hidden">Over de camping</h2>
      <p class="home-intro__statement">
        De Groene Weide is een kleine camping op het boerenland: zestig plekken, verdeeld over drie velden.
        Je staat op gras, met de weilanden om je heen.
      </p>
      <p class="home-intro__aside">
        Reserveren doe je hier zelf, zonder account. Je ziet per dag wat er vrij is en kiest je eigen plek,
        met foto's en de afstand tot de wc en het zwembad.
      </p>
    </section>

    <section id="velden" class="home-fields" aria-labelledby="fields-heading">
      <div class="home-wrap">
        <h2 id="fields-heading" class="home-section-title">Waar wil je staan?</h2>
        <p class="home-section-lead">Elk veld heeft zijn eigen soort plek. Kies er een, dan zie je meteen welke plekken vrij zijn.</p>

        <ul class="field-rows">
          <li v-for="field in fields" :key="field.type" class="field-row">
            <div class="field-row__media">
              <img class="field-row__image" :src="field.image" :alt="field.alt" width="1264" height="790" loading="lazy" />
              <span class="field-row__impression">Impressie</span>
            </div>
            <div class="field-row__body">
              <h3 class="field-row__name"><FieldSign :name="field.name" :icon-name="field.icon" /></h3>
              <p class="field-row__text">{{ field.text }}</p>
              <ul class="field-row__facts">
                <li v-for="fact in field.facts" :key="fact.text"><AppIcon :name="fact.icon" /> {{ fact.text }}</li>
              </ul>
              <p v-if="prices[field.type] > 0" class="field-row__price">
                Vanaf <strong>{{ euro(prices[field.type]) }}</strong> per nacht
              </p>
              <RouterLink class="btn" :to="{ path: '/reserveren', query: { type: field.type } }">Kies het {{ field.name }}</RouterLink>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section id="zo-werkt-het" class="home-steps" aria-labelledby="steps-heading">
      <div class="home-wrap">
        <h2 id="steps-heading" class="home-section-title">Zo reserveer je</h2>
        <ol class="step-path">
          <li v-for="step in steps" :key="step.title" class="step-path__item">
            <h3 class="step-path__title">{{ step.title }}</h3>
            <p class="step-path__text">{{ step.text }}</p>
          </li>
        </ol>
        <RouterLink class="btn btn--large" to="/reserveren">Reserveer een plek</RouterLink>
      </div>
    </section>

    <section id="praktisch" class="home-practical home-wrap" aria-labelledby="practical-heading">
      <h2 id="practical-heading" class="home-section-title">Goed om te weten</h2>

      <div class="home-practical__grid">
        <div class="season">
          <h3 class="season__title">Wanneer zijn we open?</h3>
          <p class="season__text">{{ openingText(campsite.season) }}. Daarbuiten is de camping dicht.</p>
          <ol class="season__months">
            <li v-for="month in seasonMonths" :key="month.short" :class="['season__month', { 'season__month--open': month.open }]">
              <span aria-hidden="true">{{ month.short }}</span>
              <span class="visually-hidden">{{ month.name }}: {{ month.open ? 'open' : 'gesloten' }}</span>
              <AppIcon v-if="month.open" name="check" />
            </li>
          </ol>
        </div>

        <ul class="facilities">
          <li v-for="item in facilities" :key="item.title" class="facilities__item">
            <span class="facilities__icon"><AppIcon :name="item.icon" /></span>
            <span>
              <strong class="facilities__title">{{ item.title }}</strong>
              <span class="facilities__text">{{ item.text }}</span>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section class="home-closing" aria-labelledby="closing-heading">
      <div class="home-wrap home-closing__inner">
        <div>
          <h2 id="closing-heading" class="home-closing__title">Zin om te komen?</h2>
          <p class="home-closing__text">Kies je datums en je ziet direct welke plekken nog vrij zijn.</p>
        </div>
        <div class="home-closing__actions">
          <RouterLink class="btn btn--large btn--sun" to="/reserveren">Reserveer een plek</RouterLink>
          <a v-if="campsite.phone" class="home-closing__phone" :href="campsite.phoneHref"><AppIcon name="phone" /> Bel {{ campsite.phone }}</a>
        </div>
      </div>
    </section>
  </div>
</template>
