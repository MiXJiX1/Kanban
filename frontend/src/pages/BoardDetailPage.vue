<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api/client";
import draggable from "vuedraggable";

/* ---------- Types ---------- */
type Tag   = { id: string; name: string; color: string };
type User  = { id: string; email: string };
type Member = { user: User };
type Assignee = { user: User };
type Task  = {
  id: string; title: string; position: number;
  taskTags: { tag: Tag }[];
  assignees?: Assignee[];
};
type Column= { id: string; title: string; position: number; tasks: Task[] };
type Board = { id: string; title: string; columns: Column[]; tags: Tag[]; memberships: Member[] };

/* ---------- State ---------- */
const route = useRoute();
const router = useRouter();

function goBack() {
  if (window.history.length > 1) router.back();
  else router.push("/boards");
}

const board = ref<Board|null>(null);
const tags  = ref<Tag[]>([]);

const newColTitle   = ref("");
const newTaskTitle  = ref<Record<string,string>>({});
const inviteEmail   = ref("");
const inviteLink    = ref("");
const newTagName    = ref("");

const renaming  = ref(false);
const boardTitle= ref("");

const editing   = ref<{type:"task"|"col"; id:string}|null>(null);
const editText  = ref("");

/* ---------- Load ---------- */
async function load(){
  const data: Board = (await api.get(`/boards/${route.params.id}`)).data;
  board.value = data;
  tags.value  = data.tags ?? [];
}
onMounted(load);

const members = computed<User[]>(() =>
  board.value?.memberships?.map(m => m.user) ?? []
);

/* ---------- Columns / Tasks ---------- */
async function addColumn(){
  if(!board.value || !newColTitle.value.trim()) return;
  await api.post(`/boards/${board.value.id}/columns`, {
    title: newColTitle.value.trim(),
    position: board.value.columns.length
  });
  newColTitle.value = "";
  await load();
}

async function deleteCurrentBoard(){
  if(!board.value) return;
  if(!confirm(`Delete "${board.value.title}" and all data?`)) return;
  await api.delete(`/boards/${board.value.id}`);
  router.push("/boards");
}

function startRenameBoard(){
  if(!board.value) return;
  renaming.value  = true;
  boardTitle.value= board.value.title;
}
async function saveBoardTitle(){
  if(!board.value) return;
  const title = boardTitle.value.trim();
  if(!title){ renaming.value=false; return; }
  const { data } = await api.patch(`/boards/${board.value.id}`, { title });
  board.value.title = data.title;
  renaming.value=false;
}

async function addTask(col: Column){
  const title = (newTaskTitle.value[col.id] || "").trim();
  if(!title) return;
  await api.post(`/columns/${col.id}/tasks`, { title, position: col.tasks.length });
  newTaskTitle.value[col.id] = "";
  await load();
}

/* Drag & drop */
async function saveAllTaskOrders(){
  if(!board.value) return;
  await Promise.all(
    board.value.columns.map(c =>
      api.patch("/tasks/reorder", {
        columnId: c.id,
        items: c.tasks.map((t,i)=>({ id:t.id, position:i }))
      })
    )
  );
}
async function onTasksChange(){ await nextTick(); await saveAllTaskOrders(); }
async function onColsChange(){
  if(!board.value) return;
  await api.patch("/columns/reorder", {
    items: board.value.columns.map((c,i)=>({ id:c.id, position:i }))
  });
}

/* edit / delete */
function startEditCol(c:Column){ editing.value={type:"col", id:c.id}; editText.value=c.title; }
function startEditTask(t:Task){  editing.value={type:"task",id:t.id}; editText.value=t.title; }
async function saveEdit(){
  if(!editing.value) return;
  if(editing.value.type==="col")
    await api.patch(`/columns/${editing.value.id}`, { title: editText.value.trim() });
  else
    await api.patch(`/tasks/${editing.value.id}`,   { title: editText.value.trim() });
  editing.value=null; editText.value=""; await load();
}
async function delCol(c:Column){ if(confirm("Delete column and its tasks?")){ await api.delete(`/columns/${c.id}`); await load(); } }
async function delTask(t:Task){ if(confirm("Delete task?")){ await api.delete(`/tasks/${t.id}`); await load(); } }

/* Invites */
async function createInvite(){
  const { data } = await api.post(`/boards/${route.params.id}/invites`, {
    email: inviteEmail.value || undefined
  });
  inviteLink.value = data.inviteUrl;
}

/* Tags */
async function addTag(){
  if(!newTagName.value.trim()) return;
  const t: Tag = (await api.post(`/boards/${route.params.id}/tags`, { name: newTagName.value.trim() })).data;
  tags.value.push(t); newTagName.value="";
}
async function toggleTag(taskId:string, tagId:string, on:boolean){
  if(on) await api.post(`/tasks/${taskId}/tags/${tagId}`);
  else   await api.delete(`/tasks/${taskId}/tags/${tagId}`);
  await load();
}

/* Assignees */
function isAssigned(t: Task, userId: string){
  return !!t.assignees?.some(a => a.user.id === userId);
}
async function toggleAssignee(taskId: string, userId: string, on: boolean){
  if(on) await api.post(`/tasks/${taskId}/assignees/${userId}`);
  else   await api.delete(`/tasks/${taskId}/assignees/${userId}`);
  await load();
}
</script>

<template>
  <section v-if="board" class="space-y-6 p-4">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3">
      <template v-if="!renaming">
        <!-- ปุ่มย้อนกลับ -->
        <button class="btn btn-ghost" @click="goBack" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.828 12l4.95-4.95-1.414-1.414L8 12l6.364 6.364 1.414-1.414z"/>
          </svg>
          <span class="hidden sm:inline">Back</span>
        </button>

        <h2 class="text-2xl font-semibold text-white">{{ board.title }}</h2>
        <button class="btn btn-outline" @click="startRenameBoard">Rename</button>
        <button class="btn btn-danger"  @click="deleteCurrentBoard">Delete</button>
      </template>
      <template v-else>
        <input
          v-model="boardTitle"
          class="input w-72 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
          placeholder="Board title"
          @keyup.enter="saveBoardTitle"
        />
        <button class="btn btn-primary" @click="saveBoardTitle">Save</button>
        <button class="btn btn-ghost"    @click="renaming=false">Cancel</button>
      </template>
    </div>

    <!-- Create Tag -->
    <div class="card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          v-model="newTagName"
          class="input flex-1 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
          placeholder="New tag name"
        />
        <button class="btn btn-primary" @click="addTag">Add tag</button>
      </div>
    </div>

    <!-- Invite -->
    <div class="card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          v-model="inviteEmail"
          class="input flex-1 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
          placeholder="Invite email (optional)"
        />
        <button class="btn btn-primary" @click="createInvite">Create invite</button>
        <input
          v-if="inviteLink"
          :value="inviteLink"
          readonly
          class="input sm:w-[360px] bg-white text-slate-900 border-slate-300"
        />
      </div>
    </div>

    <!-- Add Column -->
    <div class="card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          v-model="newColTitle"
          class="input flex-1 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
          placeholder="New column name"
          @keyup.enter="addColumn"
        />
        <button class="btn btn-primary" @click="addColumn">Add column</button>
      </div>
    </div>

    <!-- Columns (draggable) -->
    <draggable
      v-model="board.columns"
      group="columns"
      item-key="id"
      class="grid gap-4 md:grid-cols-3"
      @change="onColsChange"
    >
      <template #item="{ element: col }">
        <div class="rounded-2xl border border-slate-200 bg-white text-slate-900 p-4 shadow">
          <div class="flex items-center gap-2">
            <strong v-if="!(editing && editing.type==='col' && editing.id===col.id)" class="truncate">
              {{ col.title }}
            </strong>
            <template v-else>
              <input
                v-model="editText"
                class="input bg-white text-slate-900 placeholder-slate-400 border-slate-300"
                @keyup.enter="saveEdit"
              />
              <button class="btn btn-primary" @click="saveEdit">Save</button>
            </template>
            <div class="ml-auto flex gap-2">
              <button class="btn btn-outline" @click="startEditCol(col)">Rename</button>
              <button class="btn btn-danger"  @click="delCol(col)">Delete</button>
            </div>
          </div>

          <!-- Tasks -->
          <draggable
            v-model="col.tasks"
            group="tasks"
            item-key="id"
            class="mt-3"
            @change="onTasksChange"
          >
            <template #item="{ element: t }">
              <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm mt-2">
                <div class="flex items-start gap-2">
                  <span v-if="!(editing && editing.type==='task' && editing.id===t.id)" class="flex-1">
                    {{ t.title }}
                  </span>
                  <template v-else>
                    <input
                      v-model="editText"
                      class="input bg-white text-slate-900 placeholder-slate-400 border-slate-300"
                      @keyup.enter="saveEdit"
                    />
                    <button class="btn btn-primary" @click="saveEdit">Save</button>
                  </template>
                  <div class="ml-auto flex gap-2">
                    <button class="btn btn-ghost"  @click="startEditTask(t)">Edit</button>
                    <button class="btn btn-danger" @click="delTask(t)">Del</button>
                  </div>
                </div>

                <!-- current tags -->
                <div class="mt-2">
                  <span
                    v-for="tt in t.taskTags"
                    :key="tt.tag.id"
                    class="mr-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                    :style="{ background: tt.tag.color }"
                  >
                    {{ tt.tag.name }}
                  </span>
                </div>

                <!-- current assignees -->
                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    v-for="a in t.assignees || []"
                    :key="a.user.id"
                    class="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 border border-slate-200"
                    title="Assignee"
                  >
                    {{ a.user.email }}
                  </span>
                </div>

                <!-- tag selector -->
                <details class="mt-2">
                  <summary class="cursor-pointer text-sm text-slate-700">Tags</summary>
                  <div class="mt-2 space-y-1">
                    <label v-for="tg in tags" :key="tg.id" class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        :checked="t.taskTags?.some((x)=>x.tag.id===tg.id)"
                        @change="toggleTag(t.id, tg.id, ($event.target as HTMLInputElement).checked)"
                      />
                      <span
                        class="inline-flex items-center rounded px-1.5 py-0.5 text-white text-xs"
                        :style="{ background: tg.color }"
                      >
                        {{ tg.name }}
                      </span>
                    </label>
                  </div>
                </details>

                <!-- assignee selector -->
                <details class="mt-2">
                  <summary class="cursor-pointer text-sm text-slate-700">Assignees</summary>
                  <div class="mt-2 space-y-1">
                    <label
                      v-for="u in members"
                      :key="u.id"
                      class="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        :checked="isAssigned(t, u.id)"
                        @change="toggleAssignee(t.id, u.id, ($event.target as HTMLInputElement).checked)"
                      />
                      <span class="text-slate-800">{{ u.email }}</span>
                    </label>
                  </div>
                </details>
              </div>
            </template>
          </draggable>

          <div class="mt-3 flex items-center gap-2">
            <input
              v-model="newTaskTitle[col.id]"
              class="input flex-1 bg-white text-slate-900 placeholder-slate-400 border-slate-300"
              placeholder="New task..."
            />
            <button class="btn btn-primary" @click="addTask(col)">Add</button>
          </div>
        </div>
      </template>
    </draggable>
  </section>

  <div v-else class="p-4 text-slate-500">Loading…</div>
</template>
