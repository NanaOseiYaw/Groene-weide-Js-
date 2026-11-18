<!-- PLACEHOLDER behind sign-in: the daily overview and the other staff pages are ported in phase 6. -->
<script setup>
import AlertBox from '../../components/ui/AlertBox.vue';
import { useAuth } from '../../stores/auth.js';

const { staff } = useAuth();
</script>

<template>
  <h1>Dagoverzicht</h1>
  <AlertBox kind="info" :title="`Welkom, ${staff?.name ?? ''}`">
    <p>Je bent ingelogd. Het dagoverzicht, de reserveringen en de andere schermen worden op dit moment overgezet.</p>
  </AlertBox>
</template>
