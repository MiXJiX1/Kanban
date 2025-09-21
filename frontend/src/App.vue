<template>
  <div class="min-h-screen bg-slate-900">
    <!-- Top navigation -->
    <TopBar />

    <!-- Page container + transition -->
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

// โหลด token ครั้งแรก และตั้ง interceptor จัดการ 401 -> กลับไปหน้า login
onMounted(() => {
  const token = localStorage.getItem("token");
  if (token) setToken(token);

  // ป้องกันเพิ่มซ้ำเมื่อ HMR
  const FLAG = "__api_interceptor_installed__";
  // @ts-ignore
  if (!(api as any)[FLAG]) {
    api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) {
          localStorage.removeItem("token");
          // กัน loop: ถ้าอยู่ที่ /login อยู่แล้วก็ไม่ต้อง redirect ซ้ำ
          if (!location.pathname.includes("/login")) {
            location.href = "/login";
          }
        }
        return Promise.reject(err);
      }
    );
    // @ts-ignore
    (api as any)[FLAG] = true;
  }

  // ตั้ง title เริ่มต้น
  if (!document.title) document.title = "Kanban Board";
});
</script>

<style>
/* page transition */
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
