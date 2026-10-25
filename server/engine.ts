import { randomBytes, randomInt } from "node:crypto";
import type {
  GameState,
  Outcome,
  Phase,
  PublicPlayer,
} from "../shared/types.js";
export interface Player extends PublicPlayer {
  token: string;
  socket: string | null;
  choiceInternal: number | null;
  intel: string;
}
export interface Room {
  code: string;
  host: string;
  phase: Phase;
  round: number;
  deadline: number;
  players: Player[];
  outcomes: Outcome[];
  touched: number;
}
export const durations = {
  preview: 4000,
  decision: 20000,
  reveal: 5000,
  summary: 5000,
};
export function generateOutcomes(
  rng: (max: number) => number = randomInt,
): Outcome[] {
  const a: Outcome[] = [
    { kind: "credits", amount: 90 + rng(61) },
    { kind: "credits", amount: 150 + rng(81) },
    { kind: "credits", amount: 240 + rng(81) },
    { kind: "trap", amount: 20 + rng(16) },
    { kind: rng(2) ? "credits" : "trap", amount: 0 },
  ];
  a[4].amount = a[4].kind === "credits" ? 330 + rng(71) : 35;
  for (let i = 4; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function hint(outcomes: Outcome[], index: number): string {
  const safe = outcomes.flatMap((o, i) => (o.kind === "credits" ? [i] : []));
  const a = index % 5,
    b = (a + 1 + (Math.floor(index / 5) % 4)) % 5;
  const pair = [a, b];
  const count = pair.filter((i) => outcomes[i].kind === "credits").length;
  if (index % 3 !== 0)
    return `Scanner ${index + 1}: ${count === 2 ? "Both" : count === 1 ? "Exactly one of" : "Neither of"} vaults ${a + 1} and ${b + 1} ${count === 2 ? "contain" : count === 1 ? "contains" : "contain"} credits. Crowds split the haul.`;
  const ranked = safe.toSorted(
    (a, b) => outcomes[b].amount - outcomes[a].amount,
  );
  return `Intercept ${index + 1}: vault ${ranked[0] + 1} holds more credits than vault ${ranked[ranked.length - 1] + 1}. Expect competition.`;
}
export class Engine {
  rooms = new Map<string, Room>();
  create(name: string, avatar: number, color: number, socket: string) {
    if (this.rooms.size >= 1000)
      throw Error("Server is full. Try again shortly.");
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
      ).join("");
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      host: "",
      phase: "lobby",
      round: 0,
      deadline: 0,
      players: [],
      outcomes: [],
      touched: Date.now(),
    };
    this.rooms.set(code, room);
    const player = this.join(room, name, avatar, color, socket);
    room.host = player.id;
    return { room, player };
  }
  join(
    room: Room,
    name: string,
    avatar: number,
    color: number,
    socket: string,
  ) {
    if (room.phase !== "lobby")
      throw Error("This heist is already in progress. Join after the rematch.");
    if (room.players.length >= 8) throw Error("Crew is full (8 players).");
    const player: Player = {
      id: randomBytes(10).toString("hex"),
      token: randomBytes(32).toString("hex"),
      name,
      avatar,
      color,
      socket,
      credits: 0,
      connected: true,
      locked: false,
      choiceInternal: null,
      intel: "",
      delta: 0,
      wins: 0,
    };
    room.players.push(player);
    room.touched = Date.now();
    return player;
  }
  start(room: Room, id: string, now = Date.now()) {
    if (room.host !== id || room.phase !== "lobby")
      throw Error("Only the host can start from the lobby.");
    if (room.players.filter((p) => p.connected).length < 2)
      throw Error("Bring at least one friend to start.");
    room.players = room.players.filter((p) => p.connected);
    this.nextRound(room, now);
  }
  nextRound(room: Room, now: number) {
    room.round++;
    room.outcomes = generateOutcomes();
    room.players.forEach((p, i) => {
      p.choiceInternal = null;
      p.locked = false;
      p.delta = 0;
      p.intel = hint(room.outcomes, i + room.round);
    });
    this.phase(room, "preview", now);
  }
  phase(room: Room, phase: Phase, now: number) {
    room.phase = phase;
    room.deadline =
      phase in durations ? now + durations[phase as keyof typeof durations] : 0;
    room.touched = now;
  }
  choose(
    room: Room,
    p: Player,
    vault: number,
    lock: boolean,
    now = Date.now(),
  ) {
    if (room.phase !== "decision" || now >= room.deadline || p.locked)
      throw Error("Selection is closed.");
    if (!Number.isInteger(vault) || vault < 0 || vault > 4)
      throw Error("Unknown vault.");
    p.choiceInternal = vault;
    p.locked = lock;
    if (room.players.filter((x) => x.connected).every((x) => x.locked))
      this.settle(room, now);
  }
  settle(room: Room, now: number) {
    if (room.phase !== "decision") return;
    room.players.forEach((p) => {
      p.locked = true;
      if (p.choiceInternal === null) {
        p.delta = 0;
        return;
      }
      const o = room.outcomes[p.choiceInternal];
      const count = room.players.filter(
        (x) => x.choiceInternal === p.choiceInternal,
      ).length;
      p.delta =
        o.kind === "credits"
          ? Math.floor(o.amount / count)
          : -Math.min(p.credits, o.amount, 35);
      p.credits += p.delta;
      if (p.delta > 0) p.wins++;
    });
    this.phase(room, "reveal", now);
  }
  tick(room: Room, now = Date.now()) {
    if (!room.deadline || now < room.deadline) return false;
    if (room.phase === "preview") this.phase(room, "decision", now);
    else if (room.phase === "decision") this.settle(room, now);
    else if (room.phase === "reveal") this.phase(room, "summary", now);
    else if (room.phase === "summary") {
      if (room.round === 6) this.phase(room, "finished", now);
      else this.nextRound(room, now);
    }
    return true;
  }
  disconnect(room: Room, p: Player) {
    p.connected = false;
    p.socket = null;
    if (room.host === p.id)
      room.host = room.players.find((x) => x.connected)?.id ?? p.id;
    room.touched = Date.now();
  }
  rematch(room: Room, id: string) {
    if (room.host !== id || room.phase !== "finished")
      throw Error("Only the host can launch a rematch after results.");
    room.players = room.players.filter((p) => p.connected);
    room.players.forEach((p) => {
      p.credits = 0;
      p.wins = 0;
      p.delta = 0;
      p.locked = false;
      p.choiceInternal = null;
      p.intel = "";
    });
    room.round = 0;
    room.outcomes = [];
    this.phase(room, "lobby", Date.now());
  }
  public(room: Room): GameState {
    const revealed = ["reveal", "summary", "finished"].includes(room.phase);
    return {
      code: room.code,
      host: room.host,
      phase: room.phase,
      round: room.round,
      deadline: room.deadline,
      serverNow: Date.now(),
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        credits: p.credits,
        connected: p.connected,
        locked: p.locked,
        delta: p.delta,
        wins: p.wins,
        ...(revealed && p.choiceInternal !== null
          ? { choice: p.choiceInternal }
          : {}),
      })),
      ...(revealed ? { outcomes: room.outcomes } : {}),
    };
  }
}
