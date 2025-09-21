import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("123456", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@local" },
    update: {},
    create: { email: "demo@local", password }
  });

  const board = await prisma.board.create({
    data: { title: "Demo Board", ownerId: user.id }
  });

  const todo = await prisma.column.create({
    data: { title: "Todo", position: 0, boardId: board.id }
  });

  await prisma.task.create({
    data: { title: "First task", position: 0, columnId: todo.id }
  });

  console.log("Seeded:", { user: user.email, board: board.title });
}
main().finally(() => prisma.$disconnect());
