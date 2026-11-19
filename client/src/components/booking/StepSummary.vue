<!--
  Booking step 6: summary with the total price, guest details and (simulated) payment. Port of StepSummary.razor.
  Order: store the reservation (payment open) → pay with the booking token → paid → confirmation e-mail.
  The price always comes from the server, never from the browser.
-->
<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { euro, formatLongDate, formatNights, SPOT_TYPE_LABELS } from '@groene-weide/shared/format';
import { validateGuestDetails } from '@groene-weide/shared/validation';
import { createReservation, getSpot, payReservation } from '../../api/booking.js';
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';
import LoadingState from '../ui/LoadingState.vue';

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
const emit = defineEmits(['back', 'next', 'spot-taken']);

const { draft, clearSpot } = useBooking();
const heading = useStepHeading(props.focusHeading);

const spot = ref(null);
const loadError = ref(null);
const fieldErrors = ref({});
const error = ref(null);
const busy = ref(false);
const nameInput = ref(null);
const emailInput = ref(null);
const phoneInput = ref(null);
const inputs = { name: nameInput, email: emailInput, phone: phoneInput };

const hasDealDiscount = computed(() => spot.value && spot.value.totalPriceCents < spot.value.nights * spot.value.pricePerNightCents);

onMounted(async () => {
  try {
    spot.value = await getSpot({ id: draft.spotId, start: draft.start, end: draft.end });
  } catch (problem) {
    if (problem.code === 'spot_unavailable') return spotTaken(problem.message);
    loadError.value = problem.message;
  }
});

async function pay() {
  if (busy.value) return;
  error.value = null;
  fieldErrors.value = validateGuestDetails(draft.guest);
  if (Object.keys(fieldErrors.value).length > 0) return focusFirstError();

  busy.value = true;
  try {
    // 1. Check and store the spot (one transaction on the server), payment still open.
    const { reservation, bookingToken } = await createReservation({
      spotId: draft.spotId,
      type: draft.spotType,
      equipment: draft.equipment,
      start: draft.start,
      end: draft.end,
      guest: draft.guest,
    });
    // 2. Pay, 3. mark as paid, 4. confirmation e-mail (all on the server).
    draft.confirmation = await payReservation(reservation.id, bookingToken);
    emit('next');
  } catch (problem) {
    if (problem.code === 'spot_taken') return spotTaken(problem.message);
    if (problem.code === 'validation_failed') {
      fieldErrors.value = problem.fields;
      return focusFirstError();
    }
    error.value = problem.message;
  } finally {
    busy.value = false;
  }
}

/** The spot was just taken: back to step 5 with the message on top. */
function spotTaken(message) {
  clearSpot();
  draft.notice = message;
  emit('spot-taken');
}

/**
 * After "Betaal" with mistakes: focus on the first wrong field. The field is linked to its message
 * (aria-describedby), so a screen reader reads the label, "invalid" and what to fix.
 */
async function focusFirstError() {
  await nextTick();
  const first = ['name', 'email', 'phone'].find((field) => fieldErrors.value[field]);
  inputs[first]?.value?.focus();
}

const describedBy = (field, hint) => [hint, fieldErrors.value[field] ? `guest-${field}-error` : null].filter(Boolean).join(' ') || undefined;
</script>

<template>
  <section class="step" aria-labelledby="step6-heading">
    <h2 id="step6-heading" ref="heading" tabindex="-1">Controleer en betaal</h2>

    <AlertBox v-if="loadError" kind="error"><p>{{ loadError }}</p></AlertBox>
    <LoadingState v-else-if="!spot" text="Even geduld, we rekenen de prijs uit." />
    <div v-else class="checkout">
      <aside class="checkout__summary card card--meadow" aria-labelledby="summary-heading">
        <h3 id="summary-heading">Je reservering</h3>
        <dl class="summary">
          <div><dt><AppIcon name="location" /> Plek</dt><dd>{{ spot.name }}, {{ SPOT_TYPE_LABELS[spot.type] }} ({{ spot.fieldName }})</dd></div>
          <div v-if="draft.equipment">
            <dt><AppIcon name="tent" /> Je neemt mee</dt><dd>{{ draft.equipment === 'OwnTent' ? 'Eigen tent' : 'Eigen caravan' }}</dd>
          </div>
          <div><dt><AppIcon name="arrival" /> Aankomst</dt><dd>{{ formatLongDate(draft.start) }}</dd></div>
          <div><dt><AppIcon name="departure" /> Vertrek</dt><dd>{{ formatLongDate(draft.end) }}</dd></div>
          <div>
            <dt><AppIcon name="calendar" /> Nachten</dt>
            <dd>{{ formatNights(spot.nights) }} × {{ euro(spot.pricePerNightCents) }}{{ hasDealDiscount ? ' (met deal-korting)' : '' }}</dd>
          </div>
        </dl>
        <p class="summary__total"><span>Totaal</span> <strong>{{ euro(spot.totalPriceCents) }}</strong></p>
      </aside>

      <div class="checkout__form">
        <h3>Je gegevens</h3>
        <form novalidate @submit.prevent="pay">
          <div class="field">
            <label for="guest-name">Naam</label>
            <input
              id="guest-name" ref="nameInput" v-model="draft.guest.name" type="text" autocomplete="name"
              :class="{ invalid: fieldErrors.name }" :aria-invalid="fieldErrors.name ? 'true' : undefined"
              :aria-describedby="describedBy('name')"
            />
            <div v-if="fieldErrors.name" id="guest-name-error" class="validation-message">{{ fieldErrors.name }}</div>
          </div>
          <div class="field">
            <label for="guest-email">E-mailadres</label>
            <span id="guest-email-hint" class="field__hint">Hier sturen we de bevestiging en de factuur naartoe.</span>
            <input
              id="guest-email" ref="emailInput" v-model="draft.guest.email" type="email" autocomplete="email"
              :class="{ invalid: fieldErrors.email }" :aria-invalid="fieldErrors.email ? 'true' : undefined"
              :aria-describedby="describedBy('email', 'guest-email-hint')"
            />
            <div v-if="fieldErrors.email" id="guest-email-error" class="validation-message">{{ fieldErrors.email }}</div>
          </div>
          <div class="field">
            <label for="guest-phone">Telefoonnummer</label>
            <span id="guest-phone-hint" class="field__hint">Alleen voor als we je moeten bellen over je reservering.</span>
            <input
              id="guest-phone" ref="phoneInput" v-model="draft.guest.phone" type="tel" autocomplete="tel"
              :class="{ invalid: fieldErrors.phone }" :aria-invalid="fieldErrors.phone ? 'true' : undefined"
              :aria-describedby="describedBy('phone', 'guest-phone-hint')"
            />
            <div v-if="fieldErrors.phone" id="guest-phone-error" class="validation-message">{{ fieldErrors.phone }}</div>
          </div>

          <AlertBox kind="info" title="Testversie"><p>Betalen gaat nog niet echt. Er wordt geen geld afgeschreven.</p></AlertBox>

          <div aria-live="assertive">
            <AlertBox v-if="error" kind="error" title="Betalen lukte niet"><p>{{ error }}</p></AlertBox>
          </div>

          <div class="btn-row btn-row--split">
            <button type="button" class="btn btn--secondary" :disabled="busy" @click="emit('back')"><AppIcon name="chevron-left" /> Terug</button>
            <button type="submit" class="btn btn--large" :disabled="busy" :aria-busy="busy ? 'true' : undefined">
              <template v-if="busy"><AppIcon name="loader" /> <span>Bezig met betalen…</span></template>
              <template v-else><AppIcon name="lock" /> <span>Betaal {{ euro(spot.totalPriceCents) }}</span></template>
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
