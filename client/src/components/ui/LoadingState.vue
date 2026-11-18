<!-- Loading: a calmly turning icon and a sentence that says what is happening. Port of LoadingState.razor. -->
<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  /** Dutch text for the user, e.g. "Even geduld, we zoeken de vrije plekken." */
  text: { type: String, default: 'Even geduld, de gegevens worden opgehaald.' },
});
</script>

<template>
  <p class="loading" role="status">
    <AppIcon name="loader" />
    <span>{{ text }}</span>
  </p>
</template>
