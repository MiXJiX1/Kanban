<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api/client";

const route = useRoute(); const router = useRouter();

onMounted(async () => {
  const token = String(route.query.token ?? "");
  if (!token) { alert("Missing token"); return router.replace("/boards"); }

  try {
    const { data } = await api.post("/invites/accept", { token });
    router.replace(`/boards/${data.boardId}`);
  } catch (e:any) {
    const msg = e?.response?.data?.message ?? e.message ?? "Accept failed";
    alert(msg);                 // จะเห็นข้อความ "Invalid invite" ชัด ๆ
    router.replace("/boards");
  }
});
</script>
<template>Accepting invite…</template>
