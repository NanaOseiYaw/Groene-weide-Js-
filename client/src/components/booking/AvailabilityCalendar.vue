<!--
  Colourful availability calendar (Feature 3). Port of Calendar.razor.

  Guests: first click = arrival, second click = departure. Every day has a colour, an icon and text
  (never colour alone). Staff (show-stats): arrivals, departures and occupancy per day; a click selects
  the day. Works with mouse, touch, Tab, arrow keys, Home/End, PageUp/PageDown and Enter.

  The calendar does not call the API itself: the page passes the functions that load a month and
  check a period. That way the same calendar serves guests (public API), the staff phone booking
  (reserve tents count) and the staff daily overview (numbers per day).
-->
<script setup>
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue';
import { addDays, addMonths, daysBetween, firstOfMonth, parts, todayIn, weekdayFromMonday } from '@groene-weide/shared/dates';
import { euro, formatDate, formatLongDate, formatNights, formatShortDate } from '@groene-weide/shared/format';
import { loadCampsite } from '../../composables/useCampsite.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';
import LoadingState from '../ui/LoadingState.vue';

const props = defineProps({
  /** ({ year, month }) => Promise<day[]> (see GET /api/availability in docs/api.md) */
  loadMonth: { type: Function, required: true },
  /** ({ start, end }) => Promise<{ valid, message, alternatives }>; not needed with show-stats. */
  checkPeriod: { type: Function, default: null },
  /** Previously chosen arrival and departure (e.g. after going back). */
  start: { type: String, default: null },
  end: { type: String, default: null },
  /** Staff view: all spots, arrivals, departures and occupancy; a click selects a day. */
  showStats: { type: Boolean, default: false },
  /** Staff view: the selected day. */
  selectedDay: { type: String, default: null },
});
const emit = defineEmits(['period-chosen', 'period-cleared', 'day-selected']);

const DAY_NAMES = [['ma', 'maandag'], ['di', 'dinsdag'], ['wo', 'woensdag'], ['do', 'donderdag'], ['vr', 'vrijdag'], ['za', 'zaterdag'], ['zo', 'zondag']];
const NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
const MONTH_TITLE = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const titleId = `calendar-${useId()}`;
const days = ref(null);
const loadError = ref(null);
const month = ref(null); // 'YYYY-MM-01' of the month shown
const today = ref(todayIn('Europe/Amsterdam'));
const firstAllowedMonth = ref(null);
const focusDate = ref(null); // the day with tabindex=0 (roving tabindex)
const start = ref(props.start);
const end = ref(props.end);
const selected = ref(props.selectedDay);
// Staff view: the page can change the day too (previous/next day), so follow it.
watch(() => props.selectedDay, (day) => { selected.value = day; });
const message = ref(null);
const messageIsError = ref(false);
const alternatives = ref([]);
const dayButtons = new Map();
let loadCounter = 0;

// ---------- Loading ----------

onMounted(async () => {
  const campsite = await loadCampsite();
  if (campsite.today) today.value = campsite.today; // the server decides what "today" is
  firstAllowedMonth.value = firstOfMonth(today.value);
  const open = props.showStats ? props.selectedDay ?? today.value : start.value ?? campsite.firstOpenDay ?? today.value;
  month.value = firstOfMonth(open);
  focusDate.value = open;
  await loadDays();
});

async function loadDays() {
  const thisLoad = ++loadCounter; // when months are clicked quickly, only the last answer counts
  days.value = null;
  loadError.value = null;
  dayButtons.clear();
  const { year, month: monthNumber } = parts(month.value);
  try {
    const loaded = await props.loadMonth({ year, month: monthNumber });
    if (thisLoad !== loadCounter) return;
    days.value = loaded;
    if (focusDate.value.slice(0, 7) !== month.value.slice(0, 7)) focusDate.value = month.value;
  } catch (problem) {
    if (thisLoad === loadCounter) loadError.value = problem.message;
  }
}

const monthTitle = computed(() => (month.value ? MONTH_TITLE.format(new Date(`${month.value}T00:00:00Z`)) : ''));
const canGoBack = computed(() => props.showStats || (month.value && month.value > firstAllowedMonth.value));

/** The weeks of the month, starting on Monday; empty cells are null. */
const weeks = computed(() => {
  if (!days.value) return [];
  const cells = [...Array(weekdayFromMonday(month.value)).fill(null), ...days.value];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
});

/** Regular price per night this month (on a phone the price is not shown in every cell). */
const regularPrice = computed(() => {
  const prices = (days.value ?? []).filter((d) => d.totalSpots > 0 && d.status !== 'Deal').map((d) => d.pricePerNightCents);
  return prices.length > 0 ? Math.max(...prices) : null;
});
const hasDeals = computed(() => (days.value ?? []).some((d) => d.status === 'Deal'));

async function goToMonth(offset) {
  if (offset < 0 && !canGoBack.value) return;
  month.value = addMonths(month.value, offset);
  await loadDays();
}

// ---------- Clicking ----------

/** A departure day may be a full day, but not closed or in the past. */
const canBeDeparture = (day) => !day.isPast && day.inSeason && day.totalSpots > 0;

/** Can the day be clicked right now? (as arrival, as departure, or by staff) */
function isClickable(day) {
  if (props.showStats) return true;
  if (start.value && !end.value && day.date > start.value) return canBeDeparture(day);
  return day.selectable;
}

async function onDayClick(day) {
  if (props.showStats) {
    selected.value = day.date;
    emit('day-selected', day.date);
    return;
  }
  clearMessage();

  // Second click: departure date
  if (start.value && !end.value) {
    if (day.date === start.value) {
      return showMessage(`Kies een vertrekdatum ná ${formatDate(start.value)}. Je overnacht minstens één nacht.`, true);
    }
    if (day.date > start.value) {
      if (!canBeDeparture(day)) {
        return showMessage(day.isPast ? 'Deze dag is al voorbij.' : 'Op deze dag is de camping gesloten. Kies een andere vertrekdatum.', true);
      }
      end.value = day.date;
      return validate();
    }
    // Earlier than the arrival: that becomes the new arrival (when possible).
    if (day.selectable) {
      start.value = day.date;
      return showMessage(`De vertrekdatum moet na de aankomstdatum liggen. ${formatDate(day.date)} is nu je aankomstdatum; kies een vertrekdatum.`, false);
    }
  }

  // First click (or starting over): arrival date
  if (!day.selectable) {
    let text = 'Op deze dag is de camping gesloten.';
    if (day.status === 'Full' && !day.isPast) text = `Op ${formatDate(day.date)} is alles vol. Je kunt deze dag alleen als vertrekdag kiezen.`;
    else if (day.onlyDeparture) text = `${formatDate(day.date)} is de laatste dag van het seizoen. Je kunt deze dag alleen als vertrekdag kiezen.`;
    else if (day.isPast) text = 'Deze dag is al voorbij.';
    return showMessage(text, true);
  }

  const hadPeriod = end.value !== null;
  start.value = day.date;
  end.value = null;
  showMessage(`Aankomst: ${formatDate(day.date)}. Kies nu je vertrekdatum.`, false);
  if (hadPeriod) emit('period-cleared');
}

async function validate() {
  let result;
  try {
    result = await props.checkPeriod({ start: start.value, end: end.value });
  } catch (problem) {
    showMessage(problem.message, true);
    return emit('period-cleared');
  }
  if (result.valid) {
    showMessage(`Gekozen: ${formatDate(start.value)} t/m ${formatDate(end.value)}, ${formatNights(daysBetween(start.value, end.value))}.`, false);
    emit('period-chosen', { start: start.value, end: end.value });
  } else {
    showMessage(result.message, true);
    alternatives.value = result.alternatives;
    emit('period-cleared');
  }
}

async function chooseAlternative(period) {
  start.value = period.start;
  end.value = period.end;
  if (firstOfMonth(period.start) !== month.value) {
    month.value = firstOfMonth(period.start);
    await loadDays();
  }
  clearMessage();
  await validate();
}

function clearSelection() {
  start.value = null;
  end.value = null;
  showMessage('Je keuze is gewist. Kies een aankomstdatum.', false);
  emit('period-cleared');
}

function showMessage(text, isError) {
  message.value = text;
  messageIsError.value = isError;
  alternatives.value = [];
}

function clearMessage() {
  message.value = null;
  alternatives.value = [];
}

// ---------- Keyboard ----------

/** Arrows: day/week forward or back. Home/End: start/end of the week. PageUp/PageDown: month. */
async function onDayKey(event, date) {
  if (!NAVIGATION_KEYS.includes(event.key)) return;
  event.preventDefault(); // the page must not scroll while moving through the days
  const weekday = weekdayFromMonday(date);
  const target = {
    ArrowLeft: addDays(date, -1),
    ArrowRight: addDays(date, 1),
    ArrowUp: addDays(date, -7),
    ArrowDown: addDays(date, 7),
    Home: addDays(date, -weekday),
    End: addDays(date, 6 - weekday),
    PageUp: addMonths(date, -1),
    PageDown: addMonths(date, 1),
  }[event.key];
  if (target === date) return;

  const targetMonth = firstOfMonth(target);
  if (targetMonth < firstAllowedMonth.value && !props.showStats) return;

  focusDate.value = target;
  if (targetMonth !== month.value) {
    month.value = targetMonth;
    await loadDays();
    focusDate.value = target;
  }
  await nextTick();
  dayButtons.get(target)?.focus();
}

function setDayButton(date, element) {
  if (element) dayButtons.set(date, element);
  else dayButtons.delete(date);
}

// ---------- Display ----------

const inPeriod = (date) => start.value && end.value && date > start.value && date < end.value;

/** Status as a CSS modifier: Free → "free", AlmostFull → "almost-full", … */
const statusClass = (status) => (status === 'AlmostFull' ? 'almost-full' : status.toLowerCase());

function dayClasses(day) {
  const classes = ['calendar__day'];
  if (props.showStats) {
    classes.push(`calendar__day--${day.status === 'Deal' ? 'free' : statusClass(day.status)}`);
    if (day.date === selected.value) classes.push('calendar__day--selected');
    if (day.date === today.value) classes.push('calendar__day--today');
    return classes;
  }
  classes.push(day.isPast ? 'calendar__day--closed' : `calendar__day--${statusClass(day.status)}`);
  if (day.date === start.value) classes.push('calendar__day--arrival');
  if (day.date === end.value) classes.push('calendar__day--departure');
  if (inPeriod(day.date)) classes.push('calendar__day--in-range');
  if (!isClickable(day)) classes.push('calendar__day--disabled');
  return classes;
}

/** Icon per status (always next to the colour and the text). */
function statusIcon(day) {
  if (day.isPast) return 'minus';
  return { Free: 'check', AlmostFull: 'alert', Full: 'x', Deal: 'percent' }[day.status] ?? 'minus';
}

const occupancyText = (day) => (day.totalSpots === 0 ? '–' : `${Math.round(((day.totalSpots - day.freeSpots) * 100) / day.totalSpots)}%`);

/** Screen reader text (Dutch), e.g. "woensdag 12 mei 2027, nog 3 plekken, € 25 per nacht, kies als aankomstdatum". */
function ariaLabel(day) {
  const date = formatLongDate(day.date);
  if (props.showStats) {
    return `${date}: ${day.checkIns} ${day.checkIns === 1 ? 'aankomst' : 'aankomsten'}, ${day.checkOuts} ${day.checkOuts === 1 ? 'vertrek' : 'vertrekken'}, ${occupancyText(day)} bezet. Toon deze dag.`;
  }
  const label = [date, day.label];
  if (day.status === 'Deal') label.push(`${Math.round(day.discountPercentage)}% korting`);
  if (day.selectable) label.push(`${euro(day.pricePerNightCents)} per nacht`);
  if (day.date === start.value) label.push('gekozen als aankomstdatum');
  else if (day.date === end.value) label.push('gekozen als vertrekdatum');
  else if (inPeriod(day.date)) label.push('in je gekozen periode');

  if (day.date === start.value || day.date === end.value) return label.join(', ');
  if (start.value && !end.value && day.date > start.value) label.push(canBeDeparture(day) ? 'kies als vertrekdatum' : 'niet te kiezen');
  else if (day.selectable) label.push(end.value ? 'kies als nieuwe aankomstdatum' : 'kies als aankomstdatum');
  else label.push(day.onlyDeparture ? 'alleen als vertrekdag te kiezen' : 'niet te kiezen');
  return label.join(', ');
}

const dayNumber = (date) => Number(date.slice(8));
</script>

<template>
  <div :class="['calendar', { 'calendar--stats': showStats }]">
    <div class="calendar__header">
      <button type="button" class="btn btn--secondary calendar__nav" :disabled="!canGoBack" @click="goToMonth(-1)">
        <AppIcon name="chevron-left" /><span class="calendar__nav-text">Vorige maand</span>
      </button>
      <h3 :id="titleId" class="calendar__month" aria-live="polite">{{ monthTitle }}</h3>
      <button type="button" class="btn btn--secondary calendar__nav" :disabled="!month" @click="goToMonth(1)">
        <span class="calendar__nav-text">Volgende maand</span><AppIcon name="chevron-right" />
      </button>
    </div>

    <AlertBox v-if="loadError" kind="error">
      <p>{{ loadError }}</p>
      <button type="button" class="btn btn--secondary btn--small" @click="loadDays"><AppIcon name="refresh" /> Probeer opnieuw</button>
    </AlertBox>
    <LoadingState v-else-if="!days" text="Even geduld, de kalender wordt geladen." />
    <table v-else class="calendar__grid" :aria-labelledby="titleId">
      <thead>
        <tr>
          <th v-for="[short, full] in DAY_NAMES" :key="short" scope="col"><abbr :title="full">{{ short }}</abbr></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(week, index) in weeks" :key="index">
          <td v-for="(day, cell) in week" :key="day?.date ?? `empty-${cell}`">
            <button
              v-if="day"
              :ref="(element) => setDayButton(day.date, element)"
              type="button"
              :class="dayClasses(day)"
              :aria-label="showStats ? undefined : ariaLabel(day)"
              :aria-disabled="isClickable(day) ? undefined : 'true'"
              :tabindex="day.date === focusDate ? 0 : -1"
              @click="onDayClick(day)"
              @keydown="onDayKey($event, day.date)"
              @focus="focusDate = day.date"
            >
              <!-- Staff view: the name comes from the hidden sentence, so it always contains what is visible (WCAG 2.5.3). -->
              <span class="calendar__day-number" :aria-hidden="showStats ? 'true' : undefined">{{ dayNumber(day.date) }}</span>
              <template v-if="showStats">
                <span class="visually-hidden">{{ ariaLabel(day) }}</span>
                <span class="calendar__stats" aria-hidden="true">
                  <span><AppIcon name="arrival" />{{ day.checkIns }}</span>
                  <span><AppIcon name="departure" />{{ day.checkOuts }}</span>
                </span>
                <span class="calendar__label" aria-hidden="true">{{ occupancyText(day) }}</span>
              </template>
              <template v-else>
                <span class="calendar__icon"><AppIcon :name="statusIcon(day)" /></span>
                <span class="calendar__label">{{ day.label }}</span>
                <span v-if="day.selectable" class="calendar__price">{{ euro(day.pricePerNightCents) }}</span>
                <span v-if="day.date === start" class="calendar__marker">aankomst</span>
                <span v-else-if="day.date === end" class="calendar__marker">vertrek</span>
              </template>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Legend: always visible, with the same colour, icon and text as in the calendar. -->
    <ul class="calendar__legend" aria-label="Uitleg van de kleuren">
      <li v-if="showStats" class="calendar__legend-price">
        Per dag het percentage bezette plekken. Op een groter scherm ook
        <span class="calendar__legend-plain"><AppIcon name="arrival" /> aankomsten</span> en
        <span class="calendar__legend-plain"><AppIcon name="departure" /> vertrekken</span>.
      </li>
      <li><span class="calendar__swatch calendar__day--free"><AppIcon name="check" /></span> vrij</li>
      <li><span class="calendar__swatch calendar__day--almost-full"><AppIcon name="alert" /></span> bijna vol (nog een paar plekken)</li>
      <li><span class="calendar__swatch calendar__day--full"><AppIcon name="x" /></span> vol{{ showStats ? '' : ' (alleen als vertrekdag)' }}</li>
      <li v-if="!showStats"><span class="calendar__swatch calendar__day--deal"><AppIcon name="percent" /></span> deal: korting op rustige dagen</li>
      <li><span class="calendar__swatch calendar__day--closed"><AppIcon name="minus" /></span> gesloten{{ showStats ? '' : ' of voorbij' }}</li>
      <li v-if="!showStats && regularPrice !== null" class="calendar__legend-price">
        Prijs per nacht: <strong>{{ euro(regularPrice) }}</strong>{{ hasDeals ? ', op deal-dagen minder' : '' }}
      </li>
    </ul>

    <!-- Messages are read out by screen readers. -->
    <div aria-live="polite" class="calendar__messages">
      <AlertBox v-if="message" :kind="messageIsError ? 'error' : 'info'">
        <p>{{ message }}</p>
        <div v-if="alternatives.length > 0" class="btn-row">
          <button v-for="alt in alternatives" :key="alt.start" type="button" class="btn btn--secondary" @click="chooseAlternative(alt)">
            {{ formatShortDate(alt.start) }} t/m {{ formatShortDate(alt.end) }} ({{ formatNights(alt.nights) }})
          </button>
        </div>
      </AlertBox>
    </div>

    <template v-if="!showStats">
      <dl class="calendar__selection">
        <div><dt><AppIcon name="arrival" /> Aankomst</dt><dd>{{ start ? formatLongDate(start) : 'nog niet gekozen' }}</dd></div>
        <div><dt><AppIcon name="departure" /> Vertrek</dt><dd>{{ end ? formatLongDate(end) : 'nog niet gekozen' }}</dd></div>
        <div><dt><AppIcon name="calendar" /> Aantal nachten</dt><dd>{{ start && end ? formatNights(daysBetween(start, end)) : '–' }}</dd></div>
      </dl>
      <button v-if="start" type="button" class="btn btn--secondary btn--small" @click="clearSelection"><AppIcon name="x" /> Wis keuze</button>
    </template>
  </div>
</template>
