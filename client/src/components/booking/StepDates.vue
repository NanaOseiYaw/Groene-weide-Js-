<!-- Booking step 4: choose arrival and departure in the colourful calendar. Port of StepDates.razor. -->
<script setup>
import { computed } from 'vue';
import { checkPeriod, getMonth } from '../../api/booking.js';
import { useStepHeading } from '../../composables/useStepHeading.js';
import { useBooking } from '../../stores/booking.js';
import AvailabilityCalendar from './AvailabilityCalendar.vue';
import StepButtons from './StepButtons.vue';

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
defineEmits(['back', 'next']);

const { draft, setPeriod, clearPeriod } = useBooking();
const heading = useStepHeading(props.focusHeading);

const type = draft.spotType ?? 'TentCaravan';
const loadMonth = ({ year, month }) => getMonth({ type, year, month });
const check = ({ start, end }) => checkPeriod({ type, start, end });
const hasValidPeriod = computed(() => Boolean(draft.start && draft.end && draft.end > draft.start));
</script>

<template>
  <section class="step" aria-labelledby="step4-heading">
    <h2 id="step4-heading" ref="heading" tabindex="-1">Wanneer kom je?</h2>
    <p>Kies eerst je aankomstdag en daarna je vertrekdag. Je betaalt per nacht: de vertrekdag telt niet mee.</p>

    <AvailabilityCalendar
      :load-month="loadMonth"
      :check-period="check"
      :start="draft.start"
      :end="draft.end"
      @period-chosen="({ start, end }) => setPeriod(start, end)"
      @period-cleared="clearPeriod"
    />

    <StepButtons :can-continue="hasValidPeriod" @back="$emit('back')" @next="$emit('next')" />
  </section>
</template>
