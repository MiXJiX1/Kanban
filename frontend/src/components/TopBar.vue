<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import {
  api,
  getNotifications,
  readNotification,
  readAllNotifications,
} from "../api/client";

type Noti = {
  id: string;
  title: string;
  body?: string;
  data?: any;         // { boardId?: string; token?: string; ... }
  read: boolean;
  createdAt: string;
};

const router = useRouter();

const open = ref(false);
const items = ref<Noti[]>([]);
const unreadCount = ref(0);
let timer: any = null;

/* ---- fetch / poll ---- */
async function fetchNoti() {
  const { data } = await getNotifications(true); // unread only
  items.value = data;
  unreadCount.value = data.length;
}
function startPolling() {
  stopPolling();
  timer = setInterval(fetchNoti, 5000);
}
function stopPolling() {
  if (timer) clearInterval(timer);
}

/* ---- actions ---- */
async function markOne(id: string) {
  await readNotification(id);
  await fetchNoti();
}
async function markAll() {
  await readAllNotifications();
  await fetchNoti();
}
function openBoard(boardId: string) {
  open.value = false;
  router.push(`/boards/${boardId}`);
}
async function acceptInvite(n: Noti) {
  try {
    const token = n.data?.token as string | undefined;
    if (!token) return;
    const { data } = await api.post("/invites/accept", { token });
    await markOne(n.id);         // mark this noti as read
    open.value = false;          // close dropdown
    router.push(`/boards/${data.boardId}`);
  } catch (e: any) {
    alert(e?.response?.data?.message || "Accept invite failed");
  }
}

onMounted(() => { fetchNoti(); startPolling(); });
onBeforeUnmount(stopPolling);
</script>

<template>
  <header class="border-b border-slate-200/20 bg-slate-900/60 backdrop-blur">
    <div class="container flex h-14 items-center justify-between">
      <!-- Left -->
      <div class="flex items-center gap-2">
        <div class="grid h-7 w-7 place-items-center rounded-lg bg-violet-600 font-semibold text-white">K</div>
        <span class="font-semibold text-white">Kanban Board</span>
      </div>

      <!-- Right -->
      <div class="flex items-center gap-3">
        <!-- Notifications -->
        <div class="relative">
          <button
            class="relative rounded-full p-2 text-white hover:bg-white/10"
            @click="open = !open"
            aria-label="Notifications"
          >
            <!-- bell icon -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 14h12a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zM8 16a4 4 0 008 0H8z" />
            </svg>
            <span
              v-if="unreadCount"
              class="absolute -right-1 -top-1 rounded-full bg-fuchsia-500 px-1.5 text-[10px] leading-4 text-white"
            >{{ unreadCount }}</span>
          </button>

          <!-- dropdown -->
          <div
            v-if="open"
            class="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-xl"
          >
            <div class="flex items-center justify-between px-2 py-1">
              <span class="text-sm text-white/80">Notifications</span>
              <button class="text-xs text-violet-300 hover:text-violet-200" @click="markAll">Mark all read</button>
            </div>

            <div v-if="!items.length" class="px-3 py-6 text-center text-sm text-slate-400">
              No new notifications
            </div>

            <ul v-else class="max-h-96 overflow-auto">
              <li v-for="n in items" :key="n.id" class="rounded-lg p-3 hover:bg-white/5">
                <div class="text-sm font-medium text-white">{{ n.title }}</div>
                <div v-if="n.body" class="mt-0.5 text-xs text-slate-300">{{ n.body }}</div>

                <div class="mt-2 flex items-center justify-end gap-3">
                  <!-- ปุ่มเปิดบอร์ด -->
                  <button
                    v-if="n.data?.boardId"
                    class="text-xs text-violet-300 hover:text-violet-200"
                    @click="openBoard(n.data.boardId)"
                  >
                    Open board
                  </button>

                  <!-- ปุ่มรับคำเชิญ -->
                  <button
                    v-if="n.data?.token"
                    class="text-xs text-fuchsia-300 hover:text-fuchsia-200"
                    @click="acceptInvite(n)"
                  >
                    Accept
                  </button>

                  <button class="text-xs text-slate-300 hover:text-slate-200" @click="markOne(n.id)">
                    Mark read
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- ที่เหลือของปุ่มอื่น ๆ (ธีม ฯลฯ) คงไว้ตามเดิม -->
      </div>
    </div>
  </header>
</template>
