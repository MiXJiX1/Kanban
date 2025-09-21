import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

/* ------------------------------ CORS / JSON ------------------------------ */
const allowedOrigins =
  process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true;

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get("/health", (_: Request, res: Response) => res.json({ ok: true }));

/* ------------------------------- Helpers -------------------------------- */
const normalizeEmail = (e?: string | null) => (e ?? "").trim().toLowerCase();

/** สร้างแจ้งเตือนให้ผู้ใช้หนึ่งคน (ไม่ทำให้รีเควสหลักพังถ้า error) */
async function notify(userId: string, title: string, body?: string, data?: any) {
  try {
    await prisma.notification.create({
      data: { userId, title, body, data: (data ?? {}) as any },
    });
  } catch (e) {
    console.error("notify() failed", e);
  }
}

/* --------------------------------- Auth --------------------------------- */
app.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail((req.body as any).email);
    const password = (req.body as any).password as string;
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hash } });
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ message: "Email already used" });
    return res.status(500).json({ message: "Register failed" });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const email = normalizeEmail((req.body as any).email);
  const password = (req.body as any).password as string;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid" });
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

function auth(req: Request & { userId?: string }, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.userId = (jwt.verify(h.slice(7), JWT_SECRET) as any).sub as string;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

/* ---------------------------- Helpers / ACL ----------------------------- */
async function isBoardMember(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  if (!board) return false;
  if (board.ownerId === userId) return true;
  const m = await prisma.membership.findUnique({ where: { boardId_userId: { boardId, userId } } });
  return !!m;
}
async function isBoardOwner(boardId: string, userId: string) {
  const b = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  return !!b && b.ownerId === userId;
}
async function getBoardIdByColumn(colId: string) {
  const col = await prisma.column.findUnique({ where: { id: colId }, select: { boardId: true } });
  return col?.boardId;
}
async function getBoardIdByTask(taskId: string) {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  return t?.column.boardId;
}

/* -------------------------------- Boards -------------------------------- */
// GET boards (เจ้าของ + สมาชิก ไม่ซ้ำ)
app.get("/boards", auth, async (req: any, res) => {
  const userId = req.userId as string;
  const [owned, member] = await Promise.all([
    prisma.board.findMany({ where: { ownerId: userId } }),
    prisma.membership.findMany({
      where: { userId, board: { ownerId: { not: userId } } },
      select: { board: true },
    }),
  ]);
  res.json([...owned, ...member.map((m) => m.board)]);
});

// POST สร้างบอร์ด + ลงทะเบียน OWNER
app.post("/boards", auth, async (req: any, res) => {
  const userId = req.userId as string;
  const { title } = req.body as { title: string };
  const board = await prisma.board.create({ data: { title, ownerId: userId } });
  await prisma.membership.create({ data: { boardId: board.id, userId, role: "OWNER" } });
  res.json(board);
});

// PATCH เปลี่ยนชื่อบอร์ด
app.patch("/boards/:id", auth, async (req: any, res) => {
  const { id } = req.params as { id: string };
  const { title } = req.body as { title: string };
  if (!title?.trim()) return res.status(400).json({ message: "Title required" });
  if (!(await isBoardMember(id, req.userId))) return res.status(403).json({ message: "Forbidden" });
  const updated = await prisma.board.update({ where: { id }, data: { title: title.trim() } });
  res.json(updated);
});

// GET บอร์ดเดียว (columns+tasks+tags+memberships)
app.get("/boards/:id", auth, async (req: any, res) => {
  const { id } = req.params;
  if (!(await isBoardMember(id, req.userId))) return res.status(403).json({ message: "Forbidden" });
  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            orderBy: { position: "asc" },
            include: {
              taskTags: { include: { tag: true } },
              // 👇 include ผู้รับผิดชอบ
              assignees: { include: { user: { select: { id: true, email: true } } } },
            },
          },
        },
      },
      tags: true,
      memberships: { include: { user: { select: { id: true, email: true } } } },
    },
  });
  if (!board) return res.status(404).json({ message: "Board not found" });
  res.json(board);
});

// DELETE ลบบอร์ด (OWNER เท่านั้น)
app.delete("/boards/:id", auth, async (req: any, res) => {
  const { id } = req.params as { id: string };
  if (!(await isBoardOwner(id, req.userId))) return res.status(403).json({ message: "Only board owner can delete" });

  await prisma.$transaction(async (tx) => {
    const cols = await tx.column.findMany({ where: { boardId: id }, select: { id: true } });
    const colIds = cols.map((c) => c.id);

    if (colIds.length) {
      const tasks = await tx.task.findMany({ where: { columnId: { in: colIds } }, select: { id: true } });
      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length) {
        await tx.taskTag.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }
      await tx.column.deleteMany({ where: { id: { in: colIds } } });
    }

    await tx.membership.deleteMany({ where: { boardId: id } });
    await tx.tag.deleteMany({ where: { boardId: id } });
    await tx.invitation.deleteMany({ where: { boardId: id } });
    await tx.board.delete({ where: { id } });
  });

  res.json({ ok: true });
});

/* -------------------------------- Columns ------------------------------- */
app.post("/boards/:boardId/columns", auth, async (req: any, res) => {
  const { boardId } = req.params;
  if (!(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  const { title, position } = req.body as { title: string; position: number };
  res.json(await prisma.column.create({ data: { title, boardId, position } }));
});

app.patch("/columns/:colId", auth, async (req: any, res) => {
  const { colId } = req.params;
  const boardId = await getBoardIdByColumn(colId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  const { title } = req.body as { title: string };
  res.json(await prisma.column.update({ where: { id: colId }, data: { title } }));
});

app.patch("/columns/reorder", auth, async (req: any, res) => {
  const { items } = req.body as { items: { id: string; position: number }[] };
  const first = items[0];
  const boardId = first ? await getBoardIdByColumn(first.id) : undefined;
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });

  await Promise.all(items.map((i) => prisma.column.update({ where: { id: i.id }, data: { position: i.position } })));
  res.json({ ok: true });
});

app.delete("/columns/:colId", auth, async (req: any, res) => {
  const { colId } = req.params;
  const boardId = await getBoardIdByColumn(colId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  await prisma.task.deleteMany({ where: { columnId: colId } });
  await prisma.column.delete({ where: { id: colId } });
  res.json({ ok: true });
});

/* --------------------------------- Tasks -------------------------------- */
app.post("/columns/:colId/tasks", auth, async (req: any, res) => {
  const { colId } = req.params;
  const boardId = await getBoardIdByColumn(colId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  const { title, position } = req.body as { title: string; position: number };
  res.json(await prisma.task.create({ data: { title, columnId: colId, position } }));
});

app.patch("/tasks/:id", auth, async (req: any, res) => {
  const { id } = req.params;
  const boardId = await getBoardIdByTask(id);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  const { title } = req.body as { title: string };
  res.json(await prisma.task.update({ where: { id }, data: { title } }));
});

app.delete("/tasks/:id", auth, async (req: any, res) => {
  const { id } = req.params;
  const boardId = await getBoardIdByTask(id);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  await prisma.task.delete({ where: { id } });
  res.json({ ok: true });
});

// drag & drop (ย้ายคอลัมน์ + จัดลำดับ)
app.patch("/tasks/reorder", auth, async (req: any, res) => {
  const { columnId, items } = req.body as { columnId: string; items: { id: string; position: number }[] };
  const boardId = await getBoardIdByColumn(columnId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  await Promise.all(
    items.map((it) => prisma.task.update({ where: { id: it.id }, data: { columnId, position: it.position } }))
  );
  res.json({ ok: true });
});

/* --------------------- Task Assignees (มอบหมายผู้รับผิดชอบ) -------------------- */
app.post("/tasks/:taskId/assignees/:userId", auth, async (req: any, res) => {
  const { taskId, userId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });

  // ผู้ถูกมอบหมายต้องเป็นสมาชิกบอร์ด
  const target = await prisma.membership.findUnique({ where: { boardId_userId: { boardId, userId } } });
  if (!target) return res.status(400).json({ message: "User is not a member of this board" });

  await prisma.taskAssignee.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: {},
    create: { taskId, userId },
  });

  // แจ้งเตือนผู้ถูกมอบหมาย
  if (userId !== req.userId) {
    const [task, board] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }),
      prisma.board.findUnique({ where: { id: boardId }, select: { title: true } }),
    ]);
    await notify(
      userId,
      "Assigned to a task",
      `คุณถูกมอบหมายงาน "${task?.title ?? ""}" ในบอร์ด "${board?.title ?? ""}"`,
      { boardId, taskId }
    );
  }

  res.json({ ok: true });
});

app.delete("/tasks/:taskId/assignees/:userId", auth, async (req: any, res) => {
  const { taskId, userId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });

  await prisma.taskAssignee
    .delete({ where: { taskId_userId: { taskId, userId } } })
    .catch(() => void 0);

  res.json({ ok: true });
});

/* ------------------------------- Invites -------------------------------- */
app.post("/boards/:boardId/invites", auth, async (req: any, res) => {
  const { boardId } = req.params;
  if (!(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });

  const token = crypto.randomBytes(16).toString("hex");
  const inviteEmail = req.body?.email ? normalizeEmail(req.body.email) : undefined;

  const inv = await prisma.invitation.create({
    data: {
      token,
      boardId,
      email: inviteEmail,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 วัน
    },
  });

  // ถ้ามีบัญชีอีเมลนี้อยู่แล้ว => ส่งแจ้งเตือนทันที
  if (inviteEmail) {
    const user = await prisma.user.findUnique({ where: { email: inviteEmail } });
    if (user) {
      const board = await prisma.board.findUnique({ where: { id: boardId }, select: { title: true } });
      await notify(user.id, "Board invitation", `คุณถูกเชิญให้เข้าร่วมบอร์ด "${board?.title ?? ""}"`, {
        boardId,
        token: inv.token,
      });
    }
  }

  res.json({
    inviteUrl: `${process.env.APP_ORIGIN ?? "http://localhost:5173"}/accept-invite?token=${inv.token}`,
  });
});

app.post("/invites/accept", auth, async (req: any, res) => {
  const { token } = req.body as { token: string };
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.accepted || inv.expiresAt < new Date()) return res.status(400).json({ message: "Invalid invite" });

  await prisma.membership.upsert({
    where: { boardId_userId: { boardId: inv.boardId, userId: req.userId } },
    update: {},
    create: { boardId: inv.boardId, userId: req.userId, role: "MEMBER" },
  });
  await prisma.invitation.update({ where: { token }, data: { accepted: true } });

  const board = await prisma.board.findUnique({ where: { id: inv.boardId }, select: { title: true, ownerId: true } });

  // แจ้งเตือนผู้ที่เข้าร่วม
  await notify(req.userId, "Joined the board", `คุณเข้าร่วมบอร์ด "${board?.title ?? ""}" แล้ว`, {
    boardId: inv.boardId,
  });

  // แจ้งเตือนเจ้าของบอร์ดว่ามีสมาชิกใหม่
  if (board?.ownerId && board.ownerId !== req.userId) {
    await notify(board.ownerId, "Member joined", "มีสมาชิกใหม่เข้าร่วมบอร์ดของคุณ", {
      boardId: inv.boardId,
    });
  }

  res.json({ ok: true, boardId: inv.boardId });
});

/* ---------------------------------- Tags -------------------------------- */
app.get("/boards/:boardId/tags", auth, async (req: any, res) => {
  const { boardId } = req.params;
  if (!(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  res.json(await prisma.tag.findMany({ where: { boardId } }));
});

app.post("/boards/:boardId/tags", auth, async (req: any, res) => {
  const { boardId } = req.params;
  const { name, color } = req.body as { name: string; color?: string };
  if (!(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  res.json(await prisma.tag.create({ data: { boardId, name, color: color ?? "#3b82f6" } }));
});

app.post("/tasks/:taskId/tags/:tagId", auth, async (req: any, res) => {
  const { taskId, tagId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  await prisma.taskTag.upsert({ where: { taskId_tagId: { taskId, tagId } }, update: {}, create: { taskId, tagId } });
  res.json({ ok: true });
});

app.delete("/tasks/:taskId/tags/:tagId", auth, async (req: any, res) => {
  const { taskId, tagId } = req.params;
  const boardId = await getBoardIdByTask(taskId);
  if (!boardId || !(await isBoardMember(boardId, req.userId))) return res.status(403).json({ message: "Forbidden" });
  await prisma.taskTag.delete({ where: { taskId_tagId: { taskId, tagId } } });
  res.json({ ok: true });
});

/* ---------------------------- Notifications API ------------------------- */
app.get("/notifications", auth, async (req: any, res) => {
  const unread = (req.query.unread ?? "").toString() === "true";
  const items = await prisma.notification.findMany({
    where: { userId: req.userId, ...(unread ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(items);
});

app.patch("/notifications/:id/read", auth, async (req: any, res) => {
  const { id } = req.params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== req.userId) return res.status(404).json({ message: "Not found" });
  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json(updated);
});

app.post("/notifications/read-all", auth, async (req: any, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
  res.json({ ok: true });
});

/* --------------------------------- Start -------------------------------- */
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
