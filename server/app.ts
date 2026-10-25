import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { Engine, type Player, type Room } from "./engine.js";
import type { Reply } from "../shared/types.js";
import { readConfig } from "./config.js";

const profile = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(18)
    .regex(/^[\p{L}\p{N} _.-]+$/u, "Use letters, numbers, spaces, . _ or -"),
  avatar: z.number().int().min(0).max(5),
  color: z.number().int().min(0).max(5),
});
const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/);
export function createApp(config = readConfig()) {
  const app = express();
  app.disable("x-powered-by");
  const http = createServer(app);
  const engine = new Engine();
  const io = new Server(http, {
    maxHttpBufferSize: 4096,
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      done(
        null,
        !origin ||
          origin === (config.publicOrigin || `http://${req.headers.host}`),
      );
    },
  });
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-inline'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'`,
    );
    next();
  });
  app.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });
  const broadcast = (room: Room) => {
    io.to(room.code).emit("state", engine.public(room));
    for (const p of room.players)
      if (p.socket)
        io.to(p.socket).emit("private", {
          id: p.id,
          intel: p.intel,
          choice: p.choiceInternal,
        });
  };
  const ipLimits = new Map<string, { count: number; until: number }>();
  io.on("connection", (socket) => {
    let session: { room: Room; player: Player } | null = null;
    let count = 0;
    let window = Date.now();
    function handle(
      event: string,
      schema: z.ZodType,
      action: (data: unknown) => Partial<Reply> | void,
    ) {
      socket.on(event, (raw: unknown, ack?: (reply: Reply) => void) => {
        if (typeof ack !== "function") return;
        try {
          if (Date.now() - window > 10000) {
            window = Date.now();
            count = 0;
          }
          if (++count > 60) throw Error("Too many requests. Wait a moment.");
          const parsed = schema.safeParse(raw);
          if (!parsed.success)
            throw Error(
              "Check your input: nickname 1–18 characters and a valid six-character room code.",
            );
          const result = action(parsed.data);
          ack({ ok: true, ...result });
        } catch (error) {
          ack({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Unexpected error. Try again.",
          });
        }
      });
    }
    const requireSession = () => {
      if (!session || session.player.socket !== socket.id)
        throw Error("Reconnect to your crew first.");
      return session;
    };
    const attach = (room: Room, player: Player) => {
      session = { room, player };
      if (!room.players.some((p) => p.id === room.host && p.connected))
        room.host = player.id;
      socket.join(room.code);
      broadcast(room);
      return { token: player.token, code: room.code };
    };
    const guardEntry = () => {
      if (session) throw Error("Leave your current crew first.");
      const ip = socket.handshake.address;
      const item = ipLimits.get(ip) ?? { count: 0, until: Date.now() + 60000 };
      if (Date.now() > item.until) {
        item.count = 0;
        item.until = Date.now() + 60000;
      }
      item.count++;
      ipLimits.set(ip, item);
      if (item.count > 30)
        throw Error("Too many room requests. Try again in a minute.");
    };
    handle("create", profile, (data) => {
      guardEntry();
      const p = profile.parse(data);
      const { room, player } = engine.create(
        p.name,
        p.avatar,
        p.color,
        socket.id,
      );
      return attach(room, player);
    });
    const joinSchema = profile.extend({ code: codeSchema });
    handle("join", joinSchema, (data) => {
      guardEntry();
      const p = joinSchema.parse(data);
      const room = engine.rooms.get(p.code);
      if (!room)
        throw Error("Room not found. Check the code or create a new crew.");
      return attach(
        room,
        engine.join(room, p.name, p.avatar, p.color, socket.id),
      );
    });
    const recoverSchema = z.object({
      code: codeSchema,
      token: z.string().regex(/^[a-f0-9]{64}$/),
    });
    handle("recover", recoverSchema, (data) => {
      guardEntry();
      const { code, token } = recoverSchema.parse(data);
      const room = engine.rooms.get(code);
      const player = room?.players.find((p) => p.token === token);
      if (!room || !player)
        throw Error("This crew has expired. Create or join a new room.");
      if (player.socket) {
        const old = io.sockets.sockets.get(player.socket);
        old?.emit("replaced");
        old?.disconnect(true);
      }
      player.socket = socket.id;
      player.connected = true;
      room.touched = Date.now();
      if (!room.players.some((p) => p.id === room.host && p.connected))
        room.host = player.id;
      return attach(room, player);
    });
    handle("start", z.object({}).strict(), () => {
      const { room, player } = requireSession();
      engine.start(room, player.id);
      broadcast(room);
    });
    const choiceSchema = z
      .object({ vault: z.number().int().min(0).max(4), lock: z.boolean() })
      .strict();
    handle("choose", choiceSchema, (data) => {
      const { room, player } = requireSession();
      const p = choiceSchema.parse(data);
      engine.choose(room, player, p.vault, p.lock);
      broadcast(room);
    });
    handle("rematch", z.object({}).strict(), () => {
      const { room, player } = requireSession();
      engine.rematch(room, player.id);
      broadcast(room);
    });
    handle("leave", z.object({}).strict(), () => {
      const { room, player } = requireSession();
      engine.disconnect(room, player);
      if (room.phase === "lobby")
        room.players = room.players.filter((p) => p !== player);
      socket.leave(room.code);
      session = null;
      broadcast(room);
    });
    socket.on("disconnect", () => {
      if (session && session.player.socket === socket.id) {
        engine.disconnect(session.room, session.player);
        broadcast(session.room);
      }
    });
  });
  const ttl = config.roomTtlMs;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const room of engine.rooms.values()) {
      if (!room.players.some((p) => p.connected) && now - room.touched > ttl) {
        engine.rooms.delete(room.code);
        continue;
      }
      if (engine.tick(room, now)) broadcast(room);
    }
    for (const [key, value] of ipLimits)
      if (value.until < now) ipLimits.delete(key);
  }, 100);
  timer.unref();
  return {
    app,
    http,
    io,
    engine,
    close: () => {
      clearInterval(timer);
      io.close();
    },
  };
}
