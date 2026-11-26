<!-- Booking step 3 (tent/caravan only): own tent or own caravan. Renting comes later. Port of StepEquipment.razor. -->
<script setup>

import { computed } from 'vue';
import { euro } from '@groene-weide/shared/format';
import { useStepHeading } from "../../composables/useStepHeading.js";
import { useBooking } from "../../stores/booking.js";
import ChoiceCards from "./ChoiceCards.vue";
import { equipmentOptions } from "./equipmentOptions.js";
import StepButtons from "./StepButtons.vue";

const props = defineProps({ focusHeading: { type: Boolean, default: false } });
defineEmits(["back", "next"]);

const { draft } = useBooking();
const heading = useStepHeading(props.focusHeading);

const options = computed(() => equipmentOptions
  .map((option) => ({ ...option, price: `${euro(option.priceCents)} per nacht` })));

</script>

<template>
  <section class="step" aria-labelledby="step3-heading">
    <h2 id="step3-heading" ref="heading" tabindex="-1">Wat neem je mee?</h2>

    <ChoiceCards
      v-model="draft.equipment"
      name="equipment"
      legend="Kies je kampeermiddel"
      variant="choices--equipment"
      :options="options"
    />

    <StepButtons
      :can-continue="draft.equipment !== null"
      @back="$emit('back')"
      @next="$emit('next')"
    />
  </section>
</template>
