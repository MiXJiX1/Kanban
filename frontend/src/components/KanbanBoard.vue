<script setup lang="ts">
import draggable from "vuedraggable";
defineProps<{ columns: any[] }>();
</script>

<template>
  <div class="grid gap-4 grid-cols-3">
    <section v-for="col in columns" :key="col.id" class="bg-gray-100 rounded p-3">
      <header class="font-semibold mb-2">{{ col.title }}</header>
      <draggable v-model="col.tasks" group="tasks" item-key="id" @end="$emit('reorder', col)">
        <template #item="{ element }">
          <div class="bg-white rounded p-2 shadow mb-2">{{ element.title }}</div>
        </template>
      </draggable>
    </section>
  </div>
</template>
