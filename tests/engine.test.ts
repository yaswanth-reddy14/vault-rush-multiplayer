import { describe, it, expect } from "vitest";
import { Engine, generateOutcomes, hint } from "../server/engine.js";
function setup() {
  const e = new Engine();
  const { room, player } = e.create("Ada", 0, 0, "a");
  const second = e.join(room, "Bea", 1, 1, "b");
  return { e, room, player, second };
}
describe("sealed game rules", () => {
  it("generates bounded outcomes with at least three safe and one risky vault", () => {
    for (let i = 0; i < 2000; i++) {
      const o = generateOutcomes();
      expect(o).toHaveLength(5);
      expect(
        o.filter((x) => x.kind === "credits").length,
      ).toBeGreaterThanOrEqual(3);
      expect(o.some((x) => x.kind === "trap")).toBe(true);
      o.forEach((x) => expect(x.amount).toBeGreaterThan(0));
    }
  });
  it("can replay generation with deterministic injected randomness", () => {
    expect(generateOutcomes(() => 0)).toEqual(generateOutcomes(() => 0));
  });
  it("intel is truthful for every player slot", () => {
    for (let j = 0; j < 50; j++) {
      const outcomes = generateOutcomes();
      const texts = new Set<string>();
      for (let i = 1; i <= 8; i++) {
        const text = hint(outcomes, i);
        texts.add(text);
        const match = text.match(/vaults (\d) and (\d)/);
        if (match) {
          const count = [Number(match[1]) - 1, Number(match[2]) - 1].filter(
            (n) => outcomes[n].kind === "credits",
          ).length;
          expect(count).toBe(
            text.includes("Both") ? 2 : text.includes("Exactly") ? 1 : 0,
          );
        } else {
          const m = text.match(
            /vault (\d) holds more credits than vault (\d)/,
          )!;
          expect(outcomes[Number(m[1]) - 1].kind).toBe("credits");
          expect(outcomes[Number(m[1]) - 1].amount).toBeGreaterThan(
            outcomes[Number(m[2]) - 1].amount,
          );
        }
      }
      expect(texts.size).toBe(8);
    }
  });
  it("rounds down split rewards and settles only once", () => {
    const { e, room, player, second } = setup();
    e.start(room, player.id, 100);
    e.tick(room, 4100);
    room.outcomes[0] = { kind: "credits", amount: 101 };
    e.choose(room, player, 0, true, 4200);
    e.choose(room, second, 0, true, 4200);
    expect(player.credits).toBe(50);
    expect(second.credits).toBe(50);
    e.settle(room, 4300);
    expect(player.credits).toBe(50);
    expect(room.phase).toBe("reveal");
  });
  it("caps traps at 35 and balance, missing picks earn zero", () => {
    const { e, room, player, second } = setup();
    e.start(room, player.id, 0);
    e.tick(room, 4000);
    room.outcomes[0] = { kind: "trap", amount: 100 };
    player.credits = 15;
    e.choose(room, player, 0, true, 4100);
    e.tick(room, 24000);
    expect(player.credits).toBe(0);
    expect(player.delta).toBe(-15);
    expect(second.credits).toBe(0);
  });
  it("rejects pre-phase, locked, expired and malformed moves", () => {
    const { e, room, player } = setup();
    expect(() => e.choose(room, player, 0, true)).toThrow();
    e.start(room, player.id, 0);
    e.tick(room, 4000);
    expect(() => e.choose(room, player, 8, true, 4100)).toThrow();
    e.choose(room, player, 1, false, 4100);
    e.choose(room, player, 2, true, 4200);
    expect(() => e.choose(room, player, 0, true, 4300)).toThrow();
    expect(() => e.choose(room, room.players[1], 0, true, 24000)).toThrow();
  });
  it("redacts hidden outcomes, tokens, intel and choices before reveal", () => {
    const { e, room, player } = setup();
    e.start(room, player.id, 0);
    e.tick(room, 4000);
    e.choose(room, player, 2, true, 4100);
    const s = e.public(room);
    expect(s).not.toHaveProperty("outcomes");
    s.players.forEach((p) => {
      for (const key of [
        "token",
        "socket",
        "intel",
        "choice",
        "choiceInternal",
      ])
        expect(p).not.toHaveProperty(key);
    });
  });
  it("runs six rounds, determines tied winners and resets cleanly", () => {
    const { e, room, player } = setup();
    e.start(room, player.id, 0);
    for (let r = 1; r <= 6; r++) {
      expect(room.round).toBe(r);
      e.tick(room, room.deadline);
      room.players.forEach((p) =>
        e.choose(room, p, 0, true, room.deadline - 1),
      );
      e.tick(room, room.deadline);
      e.tick(room, room.deadline);
    }
    expect(room.phase).toBe("finished");
    expect(room.players[0].credits).toBe(room.players[1].credits);
    e.rematch(room, player.id);
    expect(room.round).toBe(0);
    expect(room.outcomes).toEqual([]);
    room.players.forEach((p) =>
      expect([p.credits, p.wins, p.delta, p.locked, p.choiceInternal]).toEqual([
        0,
        0,
        0,
        false,
        null,
      ]),
    );
  });
  it("elects a connected host, retains the disconnected identity and enforces room limits", () => {
    const { e, room, player, second } = setup();
    e.disconnect(room, player);
    expect(room.host).toBe(second.id);
    expect(room.players[0].token).toBe(player.token);
    expect(() => e.start(room, second.id)).toThrow();
    for (let i = 0; i < 6; i++) e.join(room, "Crew", 0, 0, `c${i}`);
    expect(() => e.join(room, "Extra", 0, 0, "x")).toThrow();
  });
  it("finishes on deadlines when all players disconnect", () => {
    const { e, room, player, second } = setup();
    e.start(room, player.id, 0);
    e.disconnect(room, player);
    e.disconnect(room, second);
    for (let i = 0; i < 24; i++) e.tick(room, room.deadline);
    expect(room.phase).toBe("finished");
  });
});
