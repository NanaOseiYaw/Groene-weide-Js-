<!-- Yes/no in a table cell: an icon plus the word, never only an icon or a colour. -->
<script setup>
import AppIcon from './AppIcon.vue';

defineProps({ value: { type: Boolean, required: true } });
</script>

<template>
  <span class="yes-no">
    <AppIcon :name="value ? 'check' : 'minus'" />
    <span>{{ value ? 'Ja' : 'Nee' }}</span>
  </span>
</template>
