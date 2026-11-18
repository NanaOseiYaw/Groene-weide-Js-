<!--
  The field sign: the name of a field as a painted sign with a post, the recognisable element
  of the site (see docs/design-system.md). Port of FieldSign.razor.
  Usage: <FieldSign name="Kampeerveld" icon-name="tent" /> or with :small="true".
-->
<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  /** Field name as guests know it (Dutch). */
  name: { type: String, required: true },
  small: { type: Boolean, default: false },
  /** Optional icon: "tent", "camper" or "safari". */
  iconName: { type: String, default: null },
});
</script>

<template>
  <span :class="['field-sign', { 'field-sign--small': small }]">
    <span class="field-sign__board">
      <AppIcon v-if="iconName" :name="iconName" />
      {{ name }}
    </span>
  </span>
</template>
