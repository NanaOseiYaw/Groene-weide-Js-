<!-- Booking step 2: choose the spot type, with the price per night. Port of StepSpotType.razor. -->
<script setup>
import { computed, onMounted, ref } from 'vue';
import { euro } from '@groene-weide/shared/format';
import { getSpotTypes } from '../../api/campsite.js';
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import LoadingState from '../ui/LoadingState.vue';
import ChoiceCards from './ChoiceCards.vue';
import StepButtons from './StepButtons.vue';

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
defineEmits(['back', 'next']);

const { draft, chooseType } = useBooking();
const heading = useStepHeading(props.focusHeading);
const prices = ref(null);
const error = ref(null);

const OPTIONS = [
  { value: 'TentCaravan', icon: 'tent', title: 'Tent of caravan', text: 'Een ruime grasplek op het Kampeerveld. Je neemt je eigen tent of caravan mee.' },
  { value: 'Camper', icon: 'camper', title: 'Camper', text: 'Een camperplek met stroom en water op het Camperveld.' },
  { value: 'Safari', icon: 'safari', title: 'Safaritent', text: 'Een ingerichte safaritent met bedden en een eigen terras op het Safariveld.' },
];

// Only types that have bookable spots, each with its price per night.
const options = computed(() => OPTIONS
  .filter((option) => prices.value?.[option.value] !== undefined)
  .map((option) => ({ ...option, price: `${euro(prices.value[option.value])} per nacht` })));

const chosenType = computed({
  get: () => draft.spotType,
  set: (type) => chooseType(type),
});

onMounted(async () => {
  try {
    prices.value = Object.fromEntries((await getSpotTypes()).map((t) => [t.type, t.pricePerNightCents]));
  } catch (problem) {
    error.value = problem.message;
  }
});
</script>

<template>
  <section class="step" aria-labelledby="step2-heading">
    <h2 id="step2-heading" ref="heading" tabindex="-1">Waar wil je slapen?</h2>

    <AlertBox v-if="error" kind="error"><p>{{ error }}</p></AlertBox>
    <LoadingState v-else-if="!prices" text="Even geduld, de prijzen worden opgehaald." />
    <ChoiceCards v-else v-model="chosenType" name="spot-type" legend="Kies het type plek" :options="options" />

    <StepButtons :can-continue="draft.spotType !== null" @back="$emit('back')" @next="$emit('next')" />
  </section>
</template>
