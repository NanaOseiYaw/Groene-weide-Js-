<!-- Booking step 5: choose an available spot, with the pop-up gallery. Port of StepSpot.razor. -->
<script setup>
import { formatDate, formatNights } from '@groene-weide/shared/format';
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import FieldSign from '../ui/FieldSign.vue';
import SpotList from './SpotList.vue';
import StepButtons from './StepButtons.vue';

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'next']);

const { draft, nights, chooseSpot } = useBooking();
const heading = useStepHeading(props.focusHeading);

const FIELDS = {
  TentCaravan: { name: 'Kampeerveld', icon: 'tent', image: '/img/field-tents.webp' },
  Camper: { name: 'Camperveld', icon: 'camper', image: '/img/field-campers.webp' },
  Safari: { name: 'Safariveld', icon: 'safari', image: '/img/field-safari.webp' },
};

/** Spot chosen and still free: continue straight to the next step. */
function spotChosen(spot) {
  chooseSpot(spot);
  emit('next');
}
</script>

<template>
  <section class="step" aria-labelledby="step5-heading">
    <h2 id="step5-heading" ref="heading" tabindex="-1">Kies je plek</h2>

    <template v-if="draft.spotType && draft.start && draft.end">
      <div class="field-banner">
        <img class="field-banner__image" :src="FIELDS[draft.spotType].image" alt="" width="1264" height="790" loading="lazy" />
        <div class="field-banner__text">
          <FieldSign :name="FIELDS[draft.spotType].name" :icon-name="FIELDS[draft.spotType].icon" />
          <p>Van <strong>{{ formatDate(draft.start) }}</strong> tot <strong>{{ formatDate(draft.end) }}</strong> ({{ formatNights(nights()) }}).</p>
          <p class="field-banner__note">De afbeelding is een impressie van het veld. In de details van een plek zie je foto's van die plek zelf.</p>
        </div>
      </div>

      <SpotList
        :type="draft.spotType"
        :start="draft.start"
        :end="draft.end"
        :selected-spot-id="draft.spotId"
        @spot-chosen="spotChosen"
        @choose-other-dates="emit('back')"
      />
    </template>
    <AlertBox v-else kind="info"><p>Kies eerst je datums.</p></AlertBox>

    <StepButtons :can-continue="draft.spotId !== null" @back="emit('back')" @next="emit('next')" />
  </section>
</template>
