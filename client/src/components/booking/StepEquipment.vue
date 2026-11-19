<!-- Booking step 3 (tent/caravan only): own tent or own caravan. Renting comes later. Port of StepEquipment.razor. -->
<script setup>
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import ChoiceCards from './ChoiceCards.vue';
import StepButtons from './StepButtons.vue';

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
defineEmits(['back', 'next']);

const { draft } = useBooking();
const heading = useStepHeading(props.focusHeading);

const OPTIONS = [
  { value: 'OwnTent', icon: 'tent', title: 'Eigen tent' },
  { value: 'OwnCaravan', icon: 'camper', title: 'Eigen caravan' },
];
</script>

<template>
  <section class="step" aria-labelledby="step3-heading">
    <h2 id="step3-heading" ref="heading" tabindex="-1">Wat neem je mee?</h2>

    <ChoiceCards v-model="draft.equipment" name="equipment" legend="Kies je kampeermiddel" variant="choices--two" :options="OPTIONS" />
    <p class="field__hint">Een tent of caravan huren kan nog niet via de website. Bel ons als je dat wilt.</p>

    <StepButtons :can-continue="draft.equipment !== null" @back="$emit('back')" @next="$emit('next')" />
  </section>
</template>
