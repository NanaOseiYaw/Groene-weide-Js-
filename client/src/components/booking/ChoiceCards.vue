<!--
  A group of large radio buttons styled as cards (booking steps 2 and 3).
  Real radio inputs inside labels, so keyboard (arrow keys) and screen readers work as usual.
-->
<script setup>
import AppIcon from '../ui/AppIcon.vue';

defineProps({
  /** Group name for the radio buttons. */
  name: { type: String, required: true },
  /** Screen reader name of the group (the step heading already says it visually). */
  legend: { type: String, required: true },
  /** [{ value, icon, title, text?, price? }] */
  options: { type: Array, required: true },
  /** Extra class, e.g. "choices--two". */
  variant: { type: String, default: '' },
});
const selected = defineModel({ type: String, default: null });
</script>

<template>
  <fieldset :class="['choices', variant]">
    <legend class="visually-hidden">{{ legend }}</legend>
    <label v-for="option in options" :key="option.value" :class="['choice', { 'choice--selected': selected === option.value }]">
      <input v-model="selected" type="radio" :name="name" :value="option.value" />
      <span class="choice__icon"><AppIcon :name="option.icon" /></span>
      <span class="choice__body">
        <span class="choice__title">{{ option.title }}</span>
        <span v-if="option.text" class="choice__text">{{ option.text }}</span>
        <span v-if="option.price" class="choice__price">{{ option.price }}</span>
      </span>
      <span v-if="selected === option.value" class="choice__chosen"><AppIcon name="check" /> Gekozen</span>
    </label>
  </fieldset>
</template>
