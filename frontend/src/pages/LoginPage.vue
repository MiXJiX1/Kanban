<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api, setToken } from "../api/client";

const router = useRouter();

const email = ref("demo@local");
const password = ref("123456");
const loading = ref(false);
const errorMsg = ref("");

async function login() {
  if (!email.value.trim() || !password.value.trim()) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const { data } = await api.post("/auth/login", {
      email: email.value,
      password: password.value,
    });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    router.push("/boards");
  } catch {
    errorMsg.value = "Invalid email or password";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-72px)] grid place-items-center">
    <div class="card w-full max-w-md p-6">
      <div class="mb-5 text-center">
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          Welcome back
        </h1>
        <p class="text-slate-600 dark:text-slate-300 text-sm">
          Sign in to your Kanban Board
        </p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
            >Email</label
          >
          <input
            v-model="email"
            class="input w-full bg-white text-slate-900 placeholder-slate-400 border-slate-300"
            type="email"
            placeholder="you@example.com"
            @keyup.enter="login"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1"
            >Password</label
          >
          <input
            v-model="password"
            class="input w-full bg-white text-slate-900 placeholder-slate-400 border-slate-300"
            type="password"
            placeholder="••••••••"
            @keyup.enter="login"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-500">{{ errorMsg }}</p>

        <button
          class="btn btn-primary w-full"
          :disabled="loading"
          @click="login"
        >
          <span v-if="!loading">Login</span>
          <span v-else>Signing in…</span>
        </button>

        <p class="text-center text-sm text-slate-500 dark:text-slate-400">
          Don’t have an account?
          <router-link class="text-violet-400 hover:underline" to="/register">
            Register
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
