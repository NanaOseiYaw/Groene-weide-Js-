<!-- "Moet verplaatst worden": guests whose spot was taken out of use. Bottom of the "Plekken" page. -->
<script setup>
import { formatShortDate } from '@groene-weide/shared/format';

defineProps({
  /** Rows from GET /api/admin/needs-move (or null while loading). */
  reservations: { type: Array, default: null },
});
</script>

<template>
  <section aria-labelledby="move-heading" class="needs-move">
    <h2 id="move-heading">Moet verplaatst worden</h2>
    <p v-if="!reservations?.length">Er zijn geen gasten die verplaatst moeten worden.</p>
    <template v-else>
      <p>De plek van deze gasten is uitgezet. Bel ze om een andere plek af te spreken.</p>
      <div class="table-scroll" role="region" aria-label="Gasten die verplaatst moeten worden" tabindex="0">
        <table class="table">
          <thead>
            <tr><th scope="col">Naam</th><th scope="col">Plek</th><th scope="col">Periode</th><th scope="col">Telefoon</th><th scope="col">E-mail</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in reservations" :key="r.id" class="table__row--warning">
              <td>{{ r.guestName }}</td>
              <td><strong>{{ r.spotName }}</strong></td>
              <td>{{ formatShortDate(r.start) }} t/m {{ formatShortDate(r.end) }} {{ r.end.slice(0, 4) }}</td>
              <td>{{ r.phone ?? '–' }}</td>
              <td>{{ r.email ?? '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
