import { afterEach, describe, it, expect, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createApp } from "../server/app.js";
import type { Reply, GameState } from "../shared/types.js";
import { readConfig, type ServerConfig } from "../server/config.js";
const sockets: Socket[] = [];
const apps: ReturnType<typeof createApp>[] = [];
afterEach(() => {
  sockets.forEach((s) => s.disconnect());
  sockets.length = 0;
  apps.forEach((a) => a.close());
  apps.length = 0;
});
async function setup(overrides: Partial<ServerConfig> = {}) {
  const app = createApp({ ...readConfig({}), ...overrides });
  apps.push(app);
  await new Promise<void>((r) => app.http.listen(0, "127.0.0.1", r));
  const address = app.http.address();
  if (!address || typeof address === "string") throw Error("No port");
  const url = `http://127.0.0.1:${address.port}`;
  async function client() {
    const socket = io(url, { transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    await new Promise<void>((r) => socket.on("connect", r));
    return socket;
  }
  return { app, client, url };
}
const send = (s: Socket, event: string, data: unknown = {}) =>
  new Promise<Reply>((r) => s.emit(event, data, r));
const snapshot = (s: Socket) =>
  new Promise<GameState>((r) => s.once("state", r));
describe("real socket transport", () => {
  it("accepts the configured HTTPS proxy origin and rejects foreign origins on both transports", async () => {
    const { url } = await setup({ publicOrigin: "https://play.example.com" });
    for (const transport of ["polling", "websocket"]) {
      const denied = io(url, {
        transports: [transport],
        forceNew: true,
        reconnection: false,
        extraHeaders: { Origin: "https://evil.example.com" },
      });
      sockets.push(denied);
      await new Promise<void>((resolve) =>
        denied.once("connect_error", () => resolve()),
      );
      expect(denied.connected).toBe(false);
      const accepted = io(url, {
        transports: [transport],
        forceNew: true,
        reconnection: false,
        extraHeaders: { Origin: "https://play.example.com" },
      });
      sockets.push(accepted);
      await new Promise<void>((resolve) =>
        accepted.once("connect", () => resolve()),
      );
      expect(accepted.connected).toBe(true);
    }
  });
  it("retains connected rooms and expires abandoned rooms on the cleanup timer", async () => {
    const { app, client } = await setup({ roomTtlMs: 100 });
    const a = await client();
    const created = await send(a, "create", { name: "A", avatar: 0, color: 0 });
    const room = app.engine.rooms.get(created.code!)!;
    room.touched = Date.now() - 1000;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(app.engine.rooms.has(room.code)).toBe(true);
    a.disconnect();
    await vi.waitFor(() => expect(room.players[0].connected).toBe(false));
    room.touched = Date.now() - 1000;
    await vi.waitFor(() => expect(app.engine.rooms.has(room.code)).toBe(false));
    const b = await client();
    expect(
      (await send(b, "recover", { code: created.code, token: created.token }))
        .ok,
    ).toBe(false);
  });
  it("shares roster, rejects malformed moves and preserves identity across recovery", async () => {
    const { app, client } = await setup();
    const a = await client(),
      b = await client(),
      c = await client();
    const created = await send(a, "create", {
      name: "Ada",
      avatar: 0,
      color: 0,
    });
    expect(created.ok).toBe(true);
    const room = app.engine.rooms.get(created.code!)!;
    const identity = room.players[0].id;
    let update = snapshot(a);
    await send(b, "join", {
      name: "Bea",
      avatar: 1,
      color: 1,
      code: created.code,
    });
    expect((await update).players.length).toBe(2);
    update = snapshot(a);
    await send(c, "join", {
      name: "Cy",
      avatar: 2,
      color: 2,
      code: created.code,
    });
    expect((await update).players.length).toBe(3);
    expect((await send(b, "start")).ok).toBe(false);
    expect((await send(a, "start")).ok).toBe(true);
    expect((await send(a, "choose", { vault: 0, lock: true })).ok).toBe(false);
    app.engine.tick(room, room.deadline);
    expect(
      (await send(a, "choose", { vault: 0, lock: true, credits: 9999 })).ok,
    ).toBe(false);
    expect((await send(a, "choose", { vault: 0, lock: true })).ok).toBe(true);
    expect((await send(a, "choose", { vault: 1, lock: true })).ok).toBe(false);
    const reconnect = await client();
    expect(
      (
        await send(reconnect, "recover", {
          code: created.code,
          token: created.token,
        })
      ).ok,
    ).toBe(true);
    expect(room.players).toHaveLength(3);
    expect(room.players[0].id).toBe(identity);
    expect(room.players[0].locked).toBe(true);
    expect(a.connected).toBe(false);
    expect(
      (await send(b, "recover", { code: created.code, token: "x".repeat(64) }))
        .ok,
    ).toBe(false);
  });
  it("rejects unknown rooms, invalid names and rate-limits message flooding", async () => {
    const { client } = await setup();
    const a = await client();
    expect(
      (
        await send(a, "join", {
          code: "AAAAAA",
          name: "A",
          avatar: 0,
          color: 0,
        })
      ).error,
    ).toContain("Room not found");
    expect(
      (await send(a, "create", { name: "<script>", avatar: 0, color: 0 })).ok,
    ).toBe(false);
    let last: Reply = { ok: true };
    for (let i = 0; i < 65; i++) last = await send(a, "start");
    expect(last.error).toContain("Too many");
  });
  it("sends distinct hints privately, synchronized deadlines, and hands off a departed host", async () => {
    const { app, client } = await setup();
    const a = await client(),
      b = await client();
    const created = await send(a, "create", { name: "A", avatar: 0, color: 0 });
    await send(b, "join", {
      code: created.code,
      name: "B",
      avatar: 1,
      color: 1,
    });
    const hintsA: unknown[] = [],
      hintsB: unknown[] = [];
    a.on("private", (p) => hintsA.push(p));
    b.on("private", (p) => hintsB.push(p));
    const sa = snapshot(a),
      sb = snapshot(b);
    await send(a, "start");
    const [one, two] = await Promise.all([sa, sb]);
    expect(one.deadline).toBe(two.deadline);
    expect(one.round).toBe(two.round);
    expect(one.outcomes).toBeUndefined();
    await new Promise((r) => setTimeout(r, 25));
    expect(hintsA).toHaveLength(1);
    expect(hintsB).toHaveLength(1);
    expect(hintsA[0]).not.toEqual(hintsB[0]);
    const room = app.engine.rooms.get(created.code!)!;
    room.players[0].credits = 123;
    const token = created.token;
    const update = snapshot(b);
    a.disconnect();
    expect((await update).host).toBe(room.players[1].id);
    const recovered = await client();
    expect(
      (await send(recovered, "recover", { code: created.code, token })).ok,
    ).toBe(true);
    expect(room.players[0].credits).toBe(123);
    expect(room.host).toBe(room.players[1].id);
  });
});
