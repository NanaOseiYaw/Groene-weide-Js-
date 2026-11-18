// The guest's choices during the booking steps (port of BookingDraft.cs).
//
// Kept for the browser tab in sessionStorage, so going back, or reloading the page, loses nothing.
// Only choices are stored here, never anything secret: the booking token for paying stays in memory
// (StepSummary.vue) and the server checks every choice again when the reservation is saved.
import { reactive, watch } from 'vue';
import { daysBetween } from '@groene-weide/shared/dates';

const STORAGE_KEY = 'groene-weide-booking';

/** Booking steps: 2 type, 3 own tent/caravan (tent only), 4 dates, 5 spot, 6 summary + pay, 7 done. */
const emptyDraft = () => ({
  step: 2,
  spotType: null, // 'TentCaravan' | 'Camper' | 'Safari'
  equipment: null, // 'OwnTent' | 'OwnCaravan'
  start: null, // 'YYYY-MM-DD'
  end: null,
  spotId: null,
  spotName: null,
  totalPriceCents: 0,
  guest: { name: '', email: '', phone: '' },
  notice: null, // message at the top of the next step, e.g. "this spot was just taken"
  confirmation: null, // the paid reservation, for step 7
});

const draft = reactive(load());

watch(draft, () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked (private mode): the booking still works, it is just not kept on reload.
  }
}, { deep: true });

function load() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') return { ...emptyDraft(), ...saved };
  } catch {
    // Nothing saved, or unreadable: start fresh.
  }
  return emptyDraft();
}

/** Step 3 (own tent or caravan) only exists for the Kampeerveld. */
const needsEquipmentStep = () => draft.spotType === 'TentCaravan';

const nights = () => (draft.start && draft.end ? daysBetween(draft.start, draft.end) : 0);

function clearSpot() {
  Object.assign(draft, { spotId: null, spotName: null, totalPriceCents: 0 });
}

/** Another type: everything chosen after the type no longer applies. */
function chooseType(type) {
  if (draft.spotType === type) return;
  Object.assign(draft, { spotType: type, equipment: null, start: null, end: null });
  clearSpot();
}

/** A new period means choosing a spot again. */
function setPeriod(start, end) {
  if (draft.start !== start || draft.end !== end) clearSpot();
  Object.assign(draft, { start, end });
}

function clearPeriod() {
  Object.assign(draft, { start: null, end: null });
  clearSpot();
}

function chooseSpot(spot) {
  Object.assign(draft, { spotId: spot.id, spotName: spot.name, totalPriceCents: spot.totalPriceCents });
}

/** Start over, e.g. after a successful booking. */
function reset() {
  Object.assign(draft, emptyDraft());
}

export function useBooking() {
  return { draft, needsEquipmentStep, nights, chooseType, setPeriod, clearPeriod, chooseSpot, clearSpot, reset };
}
