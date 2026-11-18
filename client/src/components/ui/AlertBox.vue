<!--
  Message with colour + icon + text (never colour alone). Port of Alert.razor.
  kind: info, success, warning or error. Errors get role="alert" (read out straight away), the rest role="status".
-->
<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  kind: { type: String, default: 'info', validator: (value) => ['info', 'success', 'warning', 'error'].includes(value) },
  /** Optional bold first line. */
  title: { type: String, default: null },
});

const iconName = computed(() => ({ success: 'check-circle', warning: 'alert', error: 'ban' })[props.kind] ?? 'info');
</script>

<template>
  <div :class="['alert', `alert--${kind}`]" :role="kind === 'error' ? 'alert' : 'status'">
    <span class="alert__icon"><AppIcon :name="iconName" /></span>
    <div class="alert__body">
      <p v-if="title" class="alert__title">{{ title }}</p>
      <slot />
    </div>
  </div>
</template>
