import { createRouter, createWebHistory } from "vue-router";
import BoardsPage from "../pages/BoardsPage.vue";
import BoardDetailPage from "../pages/BoardDetailPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import RegisterPage from "../pages/RegisterPage.vue";
import AcceptInvitePage from "../pages/AcceptInvitePage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/boards" },
    { path: "/login", component: LoginPage },
    { path: "/register", component: RegisterPage },
    { path: "/boards", component: BoardsPage },
    { path: "/boards/:id", component: BoardDetailPage, props: true },
    { path: "/accept-invite", component: AcceptInvitePage }
  ],
});

router.beforeEach((to) => {
  const t = localStorage.getItem("token");
  if (!t && to.path.startsWith("/boards")) return "/login";
});
export default router;
