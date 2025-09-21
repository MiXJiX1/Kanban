<script setup lang="ts">
import { onMounted, ref, computed, nextTick } from "vue";
import { api } from "../api/client";
import { useRouter } from "vue-router";

type Board = { id: string; title: string };

const router = useRouter();

const boards = ref<Board[]>([]);
const isLoading = ref(false);

const title = ref("");
const q = ref("");

const editingId = ref<string | null>(null);
const editTitle = ref("");

async function fetchBoards() {
  try {
    isLoading.value = true;
    boards.value = (await api.get("/boards")).data;
  } finally {
    isLoading.value = false;
  }
}

async function addBoard() {
  const t = title.value.trim();
  if (!t) return;
  const { data } = await api.post("/boards", { title: t });
  title.value = "";
  boards.value.unshift(data);
}

function startEdit(b: Board) {
  editingId.value = b.id;
  editTitle.value = b.title;
  nextTick(() => {
    const el = document.getElementById("rename-input");
    el?.focus();
    (el as HTMLInputElement)?.select?.();
  });
}

async function saveEdit(b: Board) {
  const t = editTitle.value.trim();
  if (!t) { editingId.value = null; return; }
  const { data } = await api.patch(`/boards/${b.id}`, { title: t });
  const idx = boards.value.findIndex(x => x.id === b.id);
  if (idx >= 0) boards.value[idx] = data;
  editingId.value = null; editTitle.value = "";
}

async function removeBoard(b: Board) {
  if (!confirm(`Delete board "${b.title}" ?`)) return;
  await api.delete(`/boards/${b.id}`);
  boards.value = boards.value.filter(x => x.id !== b.id);
}

function openBoard(b: Board) {
  router.push(`/boards/${b.id}`);
}

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return boards.value;
  return boards.value.filter(b => b.title.toLowerCase().includes(s));
});

onMounted(fetchBoards);
</script>

<template>
  <section class="space-y-6">
    <!-- Create & Search -->
    <div class="card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          v-model="title"
          class="input flex-1"
          placeholder="New board title"
          @keyup.enter="addBoard"
        />
        <div class="flex gap-3 sm:min-w-[320px]">
          <input v-model="q" class="input flex-1" placeholder="Search boards…" />
          <button
            class="btn btn-primary"
            :disabled="!title.trim()"
            @click="addBoard"
            title="Create board"
          >
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div v-for="i in 6" :key="i" class="card p-4 animate-pulse">
        <div class="h-5 w-2/3 rounded bg-slate-700/40"></div>
        <div class="mt-3 h-3 w-1/2 rounded bg-slate-700/30"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!filtered.length" class="card p-8 text-center">
      <p class="text-slate-900">No boards found.</p>
      <p class="text-slate-700 text-sm mt-1">Try creating a new board above.</p>
    </div>

    <!-- Boards grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="b in filtered"
        :key="b.id"
        class="group card p-4 text-slate-900 cursor-pointer select-none transition hover:-translate-y-0.5"
        @click="openBoard(b)"
        role="button"
        :aria-label="`Open ${b.title}`"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold !text-slate-900">
              {{ b.title || "Untitled" }}
            </h3>
            <p class="mt-1 text-sm !text-slate-700">
              Click to open the board.
            </p>
          </div>

          <!-- action buttons -->
          <div class="opacity-0 transition group-hover:opacity-100" @click.stop>
            <button class="btn btn-outline" @click="startEdit(b)">Rename</button>
            <button class="btn btn-danger ml-2" @click="removeBoard(b)">Delete</button>
          </div>
        </div>

        <!-- Inline rename -->
        <div v-if="editingId === b.id" class="mt-3 flex gap-2" @click.stop>
          <input
            id="rename-input"
            v-model="editTitle"
            class="input flex-1"
            placeholder="Board title"
            @keyup.enter="saveEdit(b)"
            @keyup.esc="editingId = null"
          />
          <button class="btn btn-primary" @click="saveEdit(b)">Save</button>
          <button class="btn btn-ghost" @click="editingId = null">Cancel</button>
        </div>

        <div class="mt-4 h-1 w-16 rounded-full bg-gradient-to-r from-violet-400/70 to-fuchsia-400/70"></div>
      </div>
    </div>
  </section>
</template>
