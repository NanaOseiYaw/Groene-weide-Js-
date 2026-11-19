<!--
  Progress bar of the booking flow: an <ol>, not clickable. Port of BookingProgress.razor.
  Finished steps get a check mark, the current step aria-current="step" plus a thick ring and bold text.
  The bar adapts: step 3 (camping gear) only exists for tent/caravan.
-->
<script setup>
import { computed } from 'vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps({
  /** Current booking step, 2 to 7. */
  currentStep: { type: Number, required: true },
  /** Chosen spot type; decides whether "Kampeermiddel" is part of the bar. */
  spotType: { type: String, default: null },
});

const steps = computed(() => [
  { label: 'Kampeerplek', step: 2 },
  ...(props.spotType === null || props.spotType === 'TentCaravan' ? [{ label: 'Kampeermiddel', step: 3 }] : []),
  { label: 'Datums', step: 4 },
  { label: 'Plek kiezen', step: 5 },
  { label: 'Betaling', step: 6 },
]);

const stateOf = (step) => (props.currentStep > step ? 'done' : props.currentStep === step ? 'current' : 'upcoming');

/** "Stap 2 van 4: Datums" for phones, where the step names do not fit next to each other. */
const summary = computed(() => {
  const number = steps.value.filter((s) => s.step <= props.currentStep).length;
  return `Stap ${number} van ${steps.value.length}: ${steps.value[number - 1].label}`;
});
</script>

<template>
  <nav class="progress" aria-label="Voortgang van je reservering">
    <ol class="progress__list">
      <li
        v-for="(item, index) in steps"
        :key="item.step"
        :class="['progress__step', `progress__step--${stateOf(item.step)}`]"
        :aria-current="stateOf(item.step) === 'current' ? 'step' : undefined"
      >
        <span class="progress__marker" aria-hidden="true">
          <AppIcon v-if="stateOf(item.step) === 'done'" name="check" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="progress__label">{{ item.label }}</span>
        <span v-if="stateOf(item.step) === 'done'" class="visually-hidden">(klaar)</span>
      </li>
    </ol>
    <p v-if="currentStep <= 6" class="progress__summary" aria-hidden="true">{{ summary }}</p>
  </nav>
</template>
