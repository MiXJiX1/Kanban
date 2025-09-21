<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";

const router = useRouter();

const email = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");

async function register() {
  if (!email.value.trim() || !password.value.trim()) {
    errorMsg.value = "Please fill in email and password";
    return;
  }

  loading.value = true;
  errorMsg.value = "";

  try {
    await api.post("/auth/register", {
      email: email.value,
      password: password.value,
    });
    router.push("/login");
  } catch (e: any) {
    errorMsg.value =
      e?.response?.data?.message ||
      (e?.response?.status === 409
        ? "This email is already registered"
        : "Register failed");
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
          Create your account
        </h1>
        <p class="text-slate-600 dark:text-slate-300 text-sm">
          Join Kanban Board in seconds
        </p>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
            Email
          </label>
          <input
            v-model="email"
            class="input w-full bg-white text-slate-900 placeholder-slate-400 border-slate-300"
            type="email"
            placeholder="you@example.com"
            @keyup.enter="register"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
            Password
          </label>
          <input
            v-model="password"
            class="input w-full bg-white text-slate-900 placeholder-slate-400 border-slate-300"
            type="password"
            placeholder="••••••••"
            @keyup.enter="register"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-500">
          {{ errorMsg }}
        </p>

        <button
          class="btn btn-primary w-full"
          :disabled="loading"
          @click="register"
        >
          <span v-if="!loading">Create account</span>
          <span v-else>Creating…</span>
        </button>

        <p class="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?
          <router-link class="text-violet-400 hover:underline" to="/login">
            Sign in
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>
