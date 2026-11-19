<!--
  Booking step 7: "Betaling gelukt!". The confirmation was sent by e-mail. Port of StepConfirmation.razor.
  After 20 seconds the page goes back to the home page; anyone who needs more time can stop that.
-->
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { euro, formatLongDate } from '@groene-weide/shared/format';
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps({
  focusHeading: { type: Boolean, default: false },
  /** Seconds before the page goes back by itself. */
  seconds: { type: Number, default: 20 },
});
const emit = defineEmits(['finish']);

const { draft } = useBooking();
const heading = useStepHeading(props.focusHeading);
const reservation = draft.confirmation;
const secondsLeft = ref(props.seconds);
const stopped = ref(false);
let timer = null;

onMounted(() => {
  timer = setInterval(() => {
    secondsLeft.value -= 1;
    if (secondsLeft.value <= 0) finish();
  }, 1000);
});
onBeforeUnmount(() => clearInterval(timer));

function stop() {
  clearInterval(timer);
  stopped.value = true;
  secondsLeft.value = 0;
}

function finish() {
  clearInterval(timer);
  emit('finish');
}
</script>

<template>
  <section class="step confirmation" aria-labelledby="step7-heading">
    <img class="confirmation__image" src="/img/confirmation-tent.webp" alt="" width="960" height="720" loading="lazy" />
    <div class="confirmation__body">
      <p class="confirmation__badge"><AppIcon name="check-circle" /> Je reservering staat vast</p>
      <h2 id="step7-heading" ref="heading" tabindex="-1">Betaling gelukt!</h2>
      <template v-if="reservation">
        <p>Je reserveringsnummer is <strong class="confirmation__number">{{ reservation.number }}</strong>.</p>
        <dl class="summary">
          <div><dt><AppIcon name="location" /> Plek</dt><dd>{{ reservation.spot.name }}</dd></div>
          <div><dt><AppIcon name="arrival" /> Aankomst</dt><dd>{{ formatLongDate(reservation.start) }}</dd></div>
          <div><dt><AppIcon name="departure" /> Vertrek</dt><dd>{{ formatLongDate(reservation.end) }}</dd></div>
          <div><dt><AppIcon name="euro" /> Betaald</dt><dd>{{ euro(reservation.totalPriceCents) }}</dd></div>
        </dl>
        <AlertBox kind="success">
          <p>We hebben een bevestiging met de factuur gestuurd naar <strong>{{ reservation.guest.email }}</strong>.</p>
        </AlertBox>
      </template>

      <p class="confirmation__countdown" aria-live="polite">
        <template v-if="secondsLeft > 0">Over {{ secondsLeft }} seconden ga je terug naar de voorpagina.</template>
        <template v-else-if="stopped">Je blijft op deze pagina. Klik op de knop als je klaar bent.</template>
      </p>

      <div class="btn-row">
        <button type="button" class="btn" @click="finish">Terug naar de voorpagina</button>
        <button v-if="secondsLeft > 0" type="button" class="btn btn--secondary" @click="stop">Blijf op deze pagina</button>
      </div>
    </div>
  </section>
</template>
