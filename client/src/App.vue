<!-- The page frame: the layout of the current page (guest site or staff section) around the page itself. -->
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AdminLayout from './layouts/AdminLayout.vue';
import SiteLayout from './layouts/SiteLayout.vue';

const route = useRoute();
const layout = computed(() => (route.meta.layout === 'admin' ? AdminLayout : SiteLayout));
</script>

<template>
  <component :is="layout">
    <RouterView />
  </component>
</template>
