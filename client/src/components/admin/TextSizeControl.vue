<!--
  Text size choice for the staff section (useTextSize): four radio buttons that look like one row of
  toggles. Native radios, so arrow keys, Tab and screen readers work as usual. The chosen one is
  white with a tick, not only a different colour.
-->
<script setup>
import AppIcon from '../ui/AppIcon.vue';
import { TEXT_SIZES, useTextSize } from '../../composables/useTextSize.js';

const { textSize, setTextSize } = useTextSize();
</script>

<template>
  <fieldset class="text-size">
    <legend class="text-size__legend">Tekstgrootte</legend>
    <div class="text-size__options">
      <label v-for="size in TEXT_SIZES" :key="size.value" :class="['text-size__option', `text-size__option--${size.value}`]">
        <input
          type="radio"
          name="text-size"
          class="text-size__input"
          :value="size.value"
          :checked="textSize === size.value"
          @change="setTextSize(size.value)"
        />
        <span class="text-size__face"><AppIcon v-if="textSize === size.value" name="check" /> {{ size.label }}</span>
      </label>
    </div>
  </fieldset>
</template>
