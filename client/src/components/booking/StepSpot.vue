<!-- Booking step 5: pick a spot. The map and the pop-up are in SpotPicker.vue. -->
<script setup>
import { formatDate, formatNights } from '@groene-weide/shared/format';
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import SpotPicker from './SpotPicker.vue';
import StepButtons from './StepButtons.vue';

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'next']);

const { draft, nights, chooseSpot } = useBooking();
const heading = useStepHeading(props.focusHeading);

// The spot is still free: go to the next step.
function spotChosen(spot) {
  chooseSpot(spot);
  emit('next');
}
</script>

<template>
  <section class="step" aria-labelledby="step5-heading">
    <h2 id="step5-heading" ref="heading" tabindex="-1">Kies je plek</h2>

    <template v-if="draft.spotType && draft.start && draft.end">
      <p>Van <strong>{{ formatDate(draft.start) }}</strong> tot <strong>{{ formatDate(draft.end) }}</strong> ({{ formatNights(nights()) }}).</p>
      <SpotPicker
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
