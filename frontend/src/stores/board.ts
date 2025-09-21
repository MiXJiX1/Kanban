import { defineStore } from "pinia";
import { api } from "../api/client";

export const useBoard = defineStore("board", {
  state: () => ({ boards: [] as any[], board: null as any, columns: [] as any[] }),
  actions: {
    async fetchBoards() { this.boards = (await api.get("/boards")).data; },
    async createBoard(title: string) { const {data}=await api.post("/boards",{title}); this.boards.push(data); },
    async fetchBoard(id: string) {
    },
    async reorder(columnId: string, items: {id:string,position:number}[]) {
      await api.patch("/tasks/reorder", { columnId, items });
    }
  }
});
