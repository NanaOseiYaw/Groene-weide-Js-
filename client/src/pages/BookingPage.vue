<!-- PLACEHOLDER: the booking steps (type, gear, dates, spot, summary, confirmation) are ported in phase 5. -->
<script setup>
import AlertBox from '../components/ui/AlertBox.vue';
import { useCampsite } from '../composables/useCampsite.js';

const campsite = useCampsite();
</script>

<template>
  <h1 class="booking__title">Reserveer je plek</h1>
  <AlertBox kind="info" title="Online reserveren komt binnenkort terug">
    <p>
      Deze stappen worden op dit moment overgezet naar de nieuwe website.
      <template v-if="campsite.phone">Bel ons op <a :href="campsite.phoneHref">{{ campsite.phone }}</a> om te reserveren.</template>
    </p>
  </AlertBox>
  <p><RouterLink class="btn btn--secondary" to="/">Naar de voorpagina</RouterLink></p>
</template>
