<template>
  <div class="min-h-screen bg-slate-900">
    <TopBar />
    <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <RouterView v-slot="{ Component }">
        <transition
          name="fade"
          mode="out-in"
          appear
        >
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import TopBar from "./components/TopBar.vue";
import { api, setToken } from "./api/client";

onMounted(() => {
  const token = localStorage.getItem("token");
  if (token) setToken(token);

  const FLAG = "__api_interceptor_installed__";
  if (!(api as any)[FLAG]) {
    api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) {
          localStorage.removeItem("token");
          if (!location.pathname.includes("/login")) {
            location.href = "/login";
          }
        }
        return Promise.reject(err);
      }
    );
    (api as any)[FLAG] = true;
  }

  if (!document.title) document.title = "Kanban Board";
});
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
