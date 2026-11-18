<!--
  Empty state: what this is, why it is empty, and what you can do now (put that in the slot, e.g. a button).
  The image is decorative (alt=""). Port of EmptyState.razor.
-->
<script setup>
defineProps({
  title: { type: String, required: true },
  /** Path of an illustration in public/img. Pass null for none (the staff pages have none). */
  image: { type: String, default: '/img/empty-meadow.webp' },
});
</script>

<template>
  <div class="empty-state">
    <img v-if="image" class="empty-state__image" :src="image" alt="" width="960" height="720" loading="lazy" />
    <div class="empty-state__body">
      <h3 class="empty-state__title">{{ title }}</h3>
      <slot />
    </div>
  </div>
</template>
