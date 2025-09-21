<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { api } from "../api/client";

type Noti = {
  id: string;
  title: string;
  body?: string | null;
  data?: any;
  read: boolean;
  createdAt: string;
};

const open = ref(false);
const items = ref<Noti[]>([]);
const unreadCount = ref(0);

let timer: any = null;

async function load(unreadOnly = true) {
  const { data } = await api.get("/notifications", { params: unreadOnly ? { unread: true } : {} });
  items.value = data;
  unreadCount.value = data.filter((x: Noti) => !x.read).length;
}
async function markRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
  await load();
}
async function readAll() {
  await api.post(`/notifications/read-all`);
  await load();
}

function toggle() {
  open.value = !open.value;
  if (open.value) load(false);
}

onMounted(() => {
  load();
  timer = setInterval(() => load(), 20_000); // poll ทุก 20 วินาที
});
onBeforeUnmount(() => timer && clearInterval(timer));
</script>

<template>
  <div class="relative">
    <button class="btn btn-ghost relative" @click="toggle" title="Notifications">
      <!-- bell icon -->
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-100 dark:text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      </svg>
      <span v-if="unreadCount" class="absolute -top-1 -right-1 rounded-full bg-fuchsia-500 text-white text-xs px-1.5 py-0.5">
        {{ unreadCount }}
      </span>
    </button>

    <div v-if="open" class="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50">
      <div class="flex items-center justify-between">
        <h4 class="font-semibold text-slate-900">Notifications</h4>
        <button class="btn btn-ghost text-sm" @click="readAll">Mark all as read</button>
      </div>
      <div class="mt-2 max-h-80 overflow-auto divide-y divide-slate-100">
        <div v-if="items.length === 0" class="py-6 text-center text-slate-500">No notifications.</div>

        <div v-for="n in items" :key="n.id" class="py-3">
          <div class="flex items-start gap-2">
            <div class="mt-0.5 h-2 w-2 rounded-full"
                 :class="n.read ? 'bg-slate-300' : 'bg-fuchsia-500'"></div>
            <div class="min-w-0 flex-1">
              <div class="text-slate-900 font-medium truncate">{{ n.title }}</div>
              <div v-if="n.body" class="text-sm text-slate-600 mt-0.5">{{ n.body }}</div>
              <div class="text-xs text-slate-400 mt-1">{{ new Date(n.createdAt).toLocaleString() }}</div>
            </div>
            <button v-if="!n.read" class="btn btn-outline text-xs" @click="markRead(n.id)">Read</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
