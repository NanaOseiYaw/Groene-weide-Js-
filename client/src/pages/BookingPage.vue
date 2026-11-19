<!--
  The booking flow for guests at /reserveren: one page, steps 2 to 7, no page reloads.
  Port of Home.razor (steps 2–7; step 1 is now the separate home page).
  The choices live in the booking store, so going back loses nothing. Steps cannot be skipped:
  the progress bar is not clickable, and a step without the choices it needs sends the guest back.

  /reserveren?type=Camper  (from the field cards on the home page) starts with that type chosen.
-->
<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BookingProgress from '../components/booking/BookingProgress.vue';
import StepConfirmation from '../components/booking/StepConfirmation.vue';
import StepDates from '../components/booking/StepDates.vue';
import StepEquipment from '../components/booking/StepEquipment.vue';
import StepSpot from '../components/booking/StepSpot.vue';
import StepSpotType from '../components/booking/StepSpotType.vue';
import StepSummary from '../components/booking/StepSummary.vue';
import AlertBox from '../components/ui/AlertBox.vue';
import { useBooking } from '../stores/booking.js';

const route = useRoute();
const router = useRouter();
const { draft, needsEquipmentStep, chooseType, reset } = useBooking();

/** Only move focus to the step heading after a step change (not when the page opens). */
const navigated = ref(false);

const STEPS = { 2: StepSpotType, 3: StepEquipment, 4: StepDates, 5: StepSpot, 6: StepSummary, 7: StepConfirmation };
const stepComponent = computed(() => STEPS[draft.step]);

onMounted(() => {
  const type = route.query.type;
  if (['TentCaravan', 'Camper', 'Safari'].includes(type)) {
    // Field chosen on the home page: continue with the step after "type".
    if (draft.step === 7) reset();
    chooseType(type);
    draft.step = needsEquipmentStep() ? 3 : 4;
    router.replace({ path: '/reserveren' }); // a reload must not start over again
  }
  if (!isStepValid()) {
    reset();
  }
});

/** Steps cannot be skipped: every step needs the choices of the steps before it. */
function isStepValid() {
  const { step } = draft;
  if (step < 2 || step > 7) return false;
  if (step >= 3 && !draft.spotType) return false;
  if (step === 3 && !needsEquipmentStep()) return false;
  if (step >= 4 && needsEquipmentStep() && !draft.equipment) return false;
  if (step >= 5 && !(draft.start && draft.end)) return false;
  if (step === 6 && !draft.spotId) return false;
  if (step === 7 && !draft.confirmation) return false;
  return true;
}

function goTo(step, { keepNotice = false } = {}) {
  navigated.value = true;
  if (!keepNotice) draft.notice = null;
  draft.step = step;
}

function next() {
  const following = { 2: needsEquipmentStep() ? 3 : 4, 3: 4, 4: 5, 5: 6, 6: 7 }[draft.step];
  goTo(following);
}

function back() {
  if (draft.step === 2) return router.push('/');
  goTo({ 3: 2, 4: needsEquipmentStep() ? 3 : 2, 5: 4, 6: 5 }[draft.step]);
}

function finish() {
  reset();
  router.push('/');
}

// The tab title follows the step, like the C# version.
watch(() => draft.step, (step) => {
  document.title = step === 7 ? 'Reservering gelukt – Camping De Groene Weide' : 'Reserveren – Camping De Groene Weide';
}, { immediate: true });
</script>

<template>
  <h1 class="booking__title">Reserveer je plek</h1>
  <BookingProgress :current-step="draft.step" :spot-type="draft.spotType" />

  <div aria-live="assertive">
    <AlertBox v-if="draft.notice" kind="warning"><p>{{ draft.notice }}</p></AlertBox>
  </div>

  <component
    :is="stepComponent"
    :key="draft.step"
    :focus-heading="navigated"
    @next="next"
    @back="back"
    @spot-taken="goTo(5, { keepNotice: true })"
    @finish="finish"
  />
</template>
