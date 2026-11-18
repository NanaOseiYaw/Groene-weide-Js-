<!--
  Enter a phone reservation (also for friends of Bert). No payment step. Port of NewReservation.razor.
  The calendar shows what is full; reserve tents count as free here.
  The server checks everything again and answers with a Dutch message per field (422 "fields").
-->
<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { formatDate } from '@groene-weide/shared/format';
import { checkPhoneBookingPeriod, createPhoneReservation, getFreeSpots, getPhoneBookingMonth } from '../../api/admin.js';
import AvailabilityCalendar from '../../components/booking/AvailabilityCalendar.vue';
import AlertBox from '../../components/ui/AlertBox.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import LoadingState from '../../components/ui/LoadingState.vue';

const emptyForm = () => ({
  type: '', start: null, end: null, spotId: '',
  guestName: '', guestPhone: '', guestEmail: '', notes: '', isFriendOfBert: false,
});

const form = reactive(emptyForm());
const freeSpots = ref(null); // null = no period yet; [] = nothing free
const loadingSpots = ref(false);
const spotsError = ref(null);
const fieldErrors = ref({});
const error = ref(null);
const saved = ref(null);
const busy = ref(false);
const formVersion = ref(0); // a new number remounts the calendar after "start over"
const successBox = ref(null);
const inputs = { type: ref(null), dates: ref(null), spotId: ref(null), guestName: ref(null), guestPhone: ref(null), guestEmail: ref(null), notes: ref(null) };
const FIELD_ORDER = ['type', 'start', 'end', 'spotId', 'guestName', 'guestPhone', 'guestEmail', 'notes'];

// The calendar asks the staff API, so reserve tents count as free.
const loadMonth = ({ year, month }) => getPhoneBookingMonth({ type: form.type, year, month });
const checkPeriod = ({ start, end }) => checkPhoneBookingPeriod({ type: form.type, start, end });

/** A different type: choose dates and spot again. */
function typeChanged() {
  clearPeriod();
  clearFieldError('type');
}

async function periodChosen({ start, end }) {
  form.start = start;
  form.end = end;
  form.spotId = '';
  clearFieldError('start', 'end');
  await loadSpots();
}

function clearPeriod() {
  form.start = null;
  form.end = null;
  form.spotId = '';
  freeSpots.value = null;
  spotsError.value = null;
}

async function loadSpots() {
  if (!form.type || !form.start || !form.end) return;
  loadingSpots.value = true;
  spotsError.value = null;
  try {
    freeSpots.value = await getFreeSpots({ type: form.type, start: form.start, end: form.end });
  } catch (problem) {
    freeSpots.value = null;
    spotsError.value = problem.message;
  } finally {
    loadingSpots.value = false;
  }
}

async function save() {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    const { reservation, emailSent } = await createPhoneReservation({
      type: form.type,
      start: form.start,
      end: form.end,
      spotId: form.spotId === '' ? null : Number(form.spotId),
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      guestEmail: form.guestEmail,
      notes: form.notes,
      isFriendOfBert: form.isFriendOfBert,
    });
    saved.value = `De reservering van ${reservation.guestName} op plek ${reservation.spotName} van ${formatDate(reservation.start)} tot ${formatDate(reservation.end)} is opgeslagen.`
      + (emailSent ? ` De gast krijgt een bevestiging op ${reservation.email}.` : ' Er is geen e-mail verstuurd (geen e-mailadres).');
    await nextTick();
    successBox.value?.focus(); // the form is gone: put the focus on the result
  } catch (problem) {
    if (problem.code === 'validation_failed') {
      fieldErrors.value = problem.fields;
      return focusFirstError();
    }
    error.value = problem.message;
    // Someone else was just first: choose another spot from the refreshed list.
    if (problem.code === 'spot_taken') {
      form.spotId = '';
      await loadSpots();
    }
  } finally {
    busy.value = false;
  }
}

/** After "Reservering opslaan" with mistakes: focus on the first wrong field (it is linked to its message). */
async function focusFirstError() {
  await nextTick();
  const first = FIELD_ORDER.find((field) => fieldErrors.value[field]);
  if (first === 'start' || first === 'end') {
    // The dates are chosen in the calendar: go to its day that can be reached with Tab.
    inputs.dates.value?.querySelector('.calendar__day[tabindex="0"]')?.focus();
  } else {
    inputs[first]?.value?.focus();
  }
}

function clearFieldError(...fields) {
  if (!fields.some((field) => fieldErrors.value[field])) return;
  const rest = { ...fieldErrors.value };
  for (const field of fields) delete rest[field];
  fieldErrors.value = rest;
}

async function startOver() {
  Object.assign(form, emptyForm());
  freeSpots.value = null;
  spotsError.value = null;
  fieldErrors.value = {};
  error.value = null;
  saved.value = null;
  formVersion.value += 1;
  await nextTick();
  inputs.type.value?.focus();
}

const datesError = computed(() => fieldErrors.value.start ?? fieldErrors.value.end);

/** aria-describedby: the hint (if any) plus the error message (if any). */
const describedBy = (field, hint) => [hint, fieldErrors.value[field] ? `${field}-error` : null].filter(Boolean).join(' ') || undefined;
const invalid = (field) => (fieldErrors.value[field] ? { class: 'invalid', 'aria-invalid': 'true' } : {});
</script>

<template>
  <h1>Nieuwe reservering</h1>
  <p>Voor een gast die belt, of een vriend van Bert. Er is geen betaalstap.</p>

  <template v-if="saved">
    <div ref="successBox" tabindex="-1">
      <AlertBox kind="success" title="Reservering opgeslagen">
        <p>{{ saved }}</p>
        <p><RouterLink to="/admin/reservations">Naar de reserveringslijst</RouterLink></p>
      </AlertBox>
    </div>
    <button type="button" class="btn" @click="startOver"><AppIcon name="plus" /> Nog een reservering invoeren</button>
  </template>

  <form v-else class="manual-booking" novalidate @submit.prevent="save">
    <section class="manual-booking__section" aria-labelledby="where-heading">
      <h2 id="where-heading">Plek en datums</h2>
      <div class="field">
        <label for="type">Type plek</label>
        <select id="type" :ref="inputs.type" v-model="form.type" v-bind="invalid('type')" :aria-describedby="describedBy('type')" @change="typeChanged">
          <option value="">Kies een type</option>
          <option value="TentCaravan">Tent of caravan</option>
          <option value="Camper">Camper</option>
          <option value="Safari">Safaritent</option>
        </select>
        <div v-if="fieldErrors.type" id="type-error" class="validation-message">{{ fieldErrors.type }}</div>
      </div>

      <div v-if="form.type" :ref="inputs.dates" class="field">
        <!-- :key: another type (or starting over) gives a fresh calendar for that type. -->
        <AvailabilityCalendar
          :key="`${form.type}-${formVersion}`"
          :load-month="loadMonth"
          :check-period="checkPeriod"
          :start="form.start"
          :end="form.end"
          @period-chosen="periodChosen"
          @period-cleared="clearPeriod"
        />
        <div v-if="datesError" class="validation-message">{{ datesError }}</div>
      </div>

      <LoadingState v-if="loadingSpots" text="Even geduld, de vrije plekken worden geladen." />
      <AlertBox v-else-if="spotsError" kind="error">
        <p>{{ spotsError }}</p>
        <button type="button" class="btn btn--secondary btn--small" @click="loadSpots"><AppIcon name="refresh" /> Probeer opnieuw</button>
      </AlertBox>
      <div v-else-if="freeSpots" class="field">
        <AlertBox v-if="freeSpots.length === 0" kind="warning"><p>Er is in deze periode geen plek van dit type vrij. Kies andere datums.</p></AlertBox>
        <template v-else>
          <label for="spot">Plek</label>
          <select
            id="spot" :ref="inputs.spotId" v-model="form.spotId" v-bind="invalid('spotId')" :aria-describedby="describedBy('spotId')"
            @change="clearFieldError('spotId')"
          >
            <option value="">Kies een plek</option>
            <option v-for="spot in freeSpots" :key="spot.id" :value="String(spot.id)">{{ spot.name }}{{ spot.isHeld ? ' (reserve-tent)' : '' }}</option>
          </select>
        </template>
        <div v-if="fieldErrors.spotId" id="spotId-error" class="validation-message">{{ fieldErrors.spotId }}</div>
      </div>
    </section>

    <section class="manual-booking__section" aria-labelledby="guest-heading">
      <h2 id="guest-heading">Gast</h2>
      <div class="field">
        <label for="guest-name">Naam van de gast</label>
        <input id="guest-name" :ref="inputs.guestName" v-model="form.guestName" type="text" v-bind="invalid('guestName')" :aria-describedby="describedBy('guestName')" />
        <div v-if="fieldErrors.guestName" id="guestName-error" class="validation-message">{{ fieldErrors.guestName }}</div>
      </div>
      <div class="field">
        <label for="guest-phone">Telefoonnummer</label>
        <input id="guest-phone" :ref="inputs.guestPhone" v-model="form.guestPhone" type="tel" v-bind="invalid('guestPhone')" :aria-describedby="describedBy('guestPhone')" />
        <div v-if="fieldErrors.guestPhone" id="guestPhone-error" class="validation-message">{{ fieldErrors.guestPhone }}</div>
      </div>
      <div class="field">
        <label for="guest-email">E-mailadres (niet verplicht)</label>
        <span id="guest-email-hint" class="field__hint">Alleen als je dit invult, krijgt de gast een bevestiging per e-mail.</span>
        <input
          id="guest-email" :ref="inputs.guestEmail" v-model="form.guestEmail" type="email" v-bind="invalid('guestEmail')"
          :aria-describedby="describedBy('guestEmail', 'guest-email-hint')"
        />
        <div v-if="fieldErrors.guestEmail" id="guestEmail-error" class="validation-message">{{ fieldErrors.guestEmail }}</div>
      </div>
      <div class="field">
        <label for="notes">Opmerking (niet verplicht)</label>
        <textarea id="notes" :ref="inputs.notes" v-model="form.notes" v-bind="invalid('notes')" :aria-describedby="describedBy('notes')" />
        <div v-if="fieldErrors.notes" id="notes-error" class="validation-message">{{ fieldErrors.notes }}</div>
      </div>
      <div class="check-field">
        <input id="friend" v-model="form.isFriendOfBert" type="checkbox" />
        <label class="checkbox" for="friend">Vriend van Bert</label>
      </div>
    </section>

    <div aria-live="assertive">
      <AlertBox v-if="error" kind="error" title="Opslaan lukte niet"><p>{{ error }}</p></AlertBox>
    </div>

    <button type="submit" class="btn btn--large" :disabled="busy" :aria-busy="busy ? 'true' : undefined">
      <template v-if="busy"><AppIcon name="loader" /> <span>Bezig met opslaan…</span></template>
      <template v-else><AppIcon name="check" /> <span>Reservering opslaan</span></template>
    </button>
  </form>
</template>
