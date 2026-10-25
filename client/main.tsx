import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Copy,
  Crown,
  Radio,
  ShieldCheck,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
  LockKeyhole,
  ChevronRight,
  LogOut,
  Trophy,
  Eye,
  Fingerprint,
} from "lucide-react";
import type { GameState, PrivateState, Reply } from "../shared/types";
import "./style.css";

const socket = io({ autoConnect: false });
const avatars = ["◈", "✦", "⌘", "◎", "♜", "△"];
const colors = [
  "#b5fc50",
  "#72ddff",
  "#b49aff",
  "#ff9bc5",
  "#ffc76b",
  "#94ffd5",
];
const names = ["GHOST", "CIPHER", "NOVA", "ECHO", "ONYX"];
function readSession(): { code: string; token: string } | null {
  try {
    const saved = JSON.parse(localStorage.getItem("vault-session") || "null");
    const invited = new URLSearchParams(location.search)
      .get("room")
      ?.toUpperCase();
    if (
      !saved ||
      typeof saved.code !== "string" ||
      typeof saved.token !== "string"
    )
      return null;
    return invited && invited !== saved.code ? null : saved;
  } catch {
    return null;
  }
}
function VaultArt({
  variant = 0,
  open = false,
}: {
  variant?: number;
  open?: boolean;
}) {
  return (
    <div
      className={`vault-art v${variant} ${open ? "opened" : ""}`}
      aria-hidden="true"
    >
      <div className="vault-top" />
      <div className="vault-body">
        <div className="vault-door">
          <div className="bolt b1" />
          <div className="bolt b2" />
          <div className="bolt b3" />
          <div className="bolt b4" />
          <div className="vault-dial">
            <span />
            <span />
            <i />
          </div>
          <div className="door-stripe" />
        </div>
        <div className="vault-led" />
      </div>
      <div className="vault-base" />
    </div>
  );
}
function App() {
  const [state, setState] = useState<GameState | null>(null),
    [priv, setPriv] = useState<PrivateState | null>(null),
    [connected, setConnected] = useState(false),
    [recovering, setRecovering] = useState(!!readSession()),
    [error, setError] = useState(""),
    [modal, setModal] = useState<"create" | "join" | "how" | null>(
      new URLSearchParams(location.search).has("room") && !readSession()
        ? "join"
        : null,
    ),
    [name, setName] = useState(""),
    [code, setCode] = useState(
      new URLSearchParams(location.search).get("room") || "",
    ),
    [avatar, setAvatar] = useState(0),
    [color, setColor] = useState(0),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [now, setNow] = useState(Date.now()),
    [muted, setMuted] = useState(true);
  const offset = useRef(0),
    audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const target = document.querySelector<HTMLElement>(
      ".modal input, .modal button",
    );
    target?.focus();
    return () => previous?.focus();
  }, [modal]);
  const request = (event: string, data: unknown) =>
    new Promise<Reply>((resolve) => {
      socket
        .timeout(6000)
        .emit(event, data, (err: Error | null, reply: Reply) =>
          resolve(
            err
              ? { ok: false, error: "Connection timed out. Please try again." }
              : reply,
          ),
        );
    });
  useEffect(() => {
    let alive = true;
    const connect = async () => {
      setConnected(true);
      const saved = readSession();
      if (saved) {
        setRecovering(true);
        const reply = await request("recover", saved);
        if (!alive) return;
        if (!reply.ok) {
          localStorage.removeItem("vault-session");
          setState(null);
          setPriv(null);
          setError(reply.error || "Could not recover room.");
        } else {
          setModal(null);
        }
      }
      setRecovering(false);
    };
    const receive = (s: GameState) => {
      offset.current = s.serverNow - Date.now();
      setState(s);
    };
    const privateReceive = (p: PrivateState) => setPriv(p);
    const disconnect = () => setConnected(false);
    const replaced = () => {
      // Tabs share storage: the replacement connection still needs this token.
      setState(null);
      setPriv(null);
      setRecovering(false);
      setError(
        "Your crew session opened in another tab. Refresh to connect again.",
      );
    };
    const failed = () => {
      setConnected(false);
      setRecovering(false);
    };
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("connect_error", failed);
    socket.on("state", receive);
    socket.on("private", privateReceive);
    socket.on("replaced", replaced);
    socket.connect();
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => {
      alive = false;
      clearInterval(interval);
      socket.off("connect", connect);
      socket.off("disconnect", disconnect);
      socket.off("connect_error", failed);
      socket.off("state", receive);
      socket.off("private", privateReceive);
      socket.off("replaced", replaced);
      socket.disconnect();
    };
  }, []);
  useEffect(() => {
    if (muted || !state || !audio.current) return;
    const a = audio.current;
    const osc = a.createOscillator(),
      gain = a.createGain();
    osc.connect(gain);
    gain.connect(a.destination);
    osc.frequency.setValueAtTime(
      state.phase === "reveal" ? 220 : 660,
      a.currentTime,
    );
    osc.frequency.exponentialRampToValueAtTime(110, a.currentTime + 0.2);
    gain.gain.setValueAtTime(0.07, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
    osc.start();
    osc.stop(a.currentTime + 0.25);
  }, [state?.phase, muted]);
  async function act(event: string, data: unknown = {}) {
    setBusy(true);
    setError("");
    const reply = await request(event, data);
    setBusy(false);
    if (!reply.ok) setError(reply.error || "Something went wrong.");
    return reply;
  }
  async function enter() {
    const r = await act(modal === "create" ? "create" : "join", {
      name,
      avatar,
      color,
      ...(modal === "join" ? { code: code.trim().toUpperCase() } : {}),
    });
    if (r.ok && r.token && r.code) {
      localStorage.setItem(
        "vault-session",
        JSON.stringify({ token: r.token, code: r.code }),
      );
      setModal(null);
      history.replaceState(null, "", `?room=${r.code}`);
    }
  }
  async function leave() {
    const r = await act("leave");
    if (r.ok) {
      localStorage.removeItem("vault-session");
      setState(null);
      setPriv(null);
      history.replaceState(null, "", "/");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${state?.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copy the room code and share it with your crew.");
    }
  }
  const me = state?.players.find((p) => p.id === priv?.id),
    host = state?.host === priv?.id,
    seconds = Math.max(
      0,
      Math.ceil(((state?.deadline || 0) - now - offset.current) / 1000),
    ),
    ranked = state?.players.toSorted((a, b) => b.credits - a.credits) || [];
  const sound = async () => {
    if (muted) {
      audio.current ??= new AudioContext();
      await audio.current.resume();
    }
    setMuted(!muted);
  };
  return (
    <>
      <div className="ambient" />
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            if (state) e.preventDefault();
          }}
          aria-label="Vault Rush home"
        >
          <span className="brand-icon">
            <Zap fill="currentColor" size={23} />
          </span>
          VAULT<span>RUSH</span>
          <i>®</i>
        </a>
        <nav>
          <span className={`connection ${connected ? "online" : ""}`}>
            <i />
            {connected ? "SYSTEM ONLINE" : "RECONNECTING"}
          </span>
          <button
            className="icon-button"
            onClick={sound}
            aria-label={muted ? "Enable sound" : "Mute sound"}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          {state && (
            <button
              className="icon-button"
              onClick={leave}
              aria-label="Leave room"
            >
              <LogOut size={18} />
            </button>
          )}
        </nav>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {recovering ? (
        <main className="recovery">
          <Radio className="pulse" size={40} />
          <h1>Reconnecting to your crew…</h1>
        </main>
      ) : !state ? (
        <>
          <main className="landing">
            <section className="hero-copy">
              <div className="eyebrow">
                <span />
                THE MULTIPLAYER HEIST EXPERIENCE
              </div>
              <h1>
                BIG VAULTS.
                <br />
                BIGGER <span>BETRAYALS.</span>
              </h1>
              <p className="hero-description">
                Five vaults. One crew. Everyone has a secret.
                <br />
                Trust your intel, make your move, and get out rich.
              </p>
              <div className="hero-actions">
                <button className="primary" onClick={() => setModal("create")}>
                  Create a crew <ArrowUpRight size={20} />
                </button>
                <button className="secondary" onClick={() => setModal("join")}>
                  Join with code <ArrowRight size={18} />
                </button>
              </div>
              <div className="hero-meta">
                <span>
                  <Users size={15} /> 2–8 players
                </span>
                <i />
                <span>
                  <Zap size={15} /> ~4 min per heist
                </span>
                <i />
                <span>No downloads. Just friends.</span>
              </div>
            </section>
            <section
              className="hero-scene"
              aria-label="Illustration of a futuristic neon vault"
            >
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="scene-cross c1">+</div>
              <div className="scene-cross c2">+</div>
              <div className="scene-label">
                <i /> SECURE FACILITY // SECTOR 07
              </div>
              <div className="hero-vault">
                <VaultArt variant={0} />
              </div>
              <div className="loot-chip">
                <span className="chip-icon">
                  <Zap size={18} />
                </span>
                <div>
                  <small>POTENTIAL PAYOUT</small>
                  <b>
                    400 <em>CR</em>
                  </b>
                </div>
                <span className="chip-spark">↗</span>
              </div>
              <div className="intel-chip">
                <Fingerprint size={22} />
                <div>
                  <small>CLASSIFIED INTEL</small>
                  <b>Trust no one.</b>
                </div>
                <LockKeyhole size={13} />
              </div>
              <div className="scene-bottom">
                <span>ENCRYPTION ACTIVE</span>
                <b>
                  ••••• <em>LEVEL 05</em>
                </b>
              </div>
            </section>
          </main>
          <section className="briefing">
            <div>
              <span className="eyebrow">THE BRIEFING</span>
              <h2>Your friends. Your rivals.</h2>
            </div>
            <p>
              A little luck. A little strategy. A lot of “I knew you’d pick
              that.”
            </p>
            <button onClick={() => setModal("how")} className="text-button">
              How to play <ArrowUpRight size={17} />
            </button>
          </section>
          <section className="steps">
            {[
              {
                icon: <Eye />,
                n: "01",
                title: "Read between the lies.",
                text: "Get private intel. Share it, hide it, or bluff your way to a bigger haul.",
              },
              {
                icon: <LockKeyhole />,
                n: "02",
                title: "Pick your payday.",
                text: "Choose one of five vaults. Share the loot with anyone who follows you.",
              },
              {
                icon: <Trophy />,
                n: "03",
                title: "Make a clean getaway.",
                text: "Dodge traps, stack credits. The richest thief after six rounds wins.",
              },
            ].map((x) => (
              <article key={x.n}>
                <div className="step-top">
                  {x.icon}
                  <span>{x.n} /</span>
                </div>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </article>
            ))}
          </section>
          <footer>
            <span>BUILT FOR GOOD COMPANY & QUESTIONABLE DECISIONS.</span>
            <span>
              6 ROUNDS. ZERO TRUST. <i>∞ POSSIBILITIES.</i>
            </span>
          </footer>
        </>
      ) : (
        <main className="game-shell">
          <div className="game-heading">
            <div className="eyebrow">
              <span />
              {state.phase === "lobby"
                ? "CREW ASSEMBLY"
                : `HEIST IN PROGRESS // ROUND ${state.round} OF 6`}
            </div>
            <button className="room-pill" onClick={copy}>
              ROOM <b>{state.code}</b>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          {!connected && (
            <div className="notice" role="status">
              Connection lost. Your seat is saved; reconnecting automatically…
            </div>
          )}
          {state.phase === "lobby" ? (
            <>
              <section className="lobby-title">
                <span className="tag">PRIVATE LOBBY</span>
                <h1>
                  Assemble your <em>crew.</em>
                </h1>
                <p>
                  The vaults are ready. Bring a friend. Leave your trust at the
                  door.
                </p>
              </section>
              <div className="lobby-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>The usual suspects</h2>
                    <span>{state.players.length}/8 AGENTS</span>
                  </div>
                  <div className="roster">
                    {state.players.map((p) => (
                      <div className="player" key={p.id}>
                        <span
                          className="avatar"
                          style={
                            {
                              "--player-color": colors[p.color],
                            } as React.CSSProperties
                          }
                        >
                          {avatars[p.avatar]}
                        </span>
                        <div>
                          <b>
                            {p.name}
                            {p.id === priv?.id ? " (you)" : ""}
                          </b>
                          <small>
                            {p.connected
                              ? "Ready for the heist"
                              : "Reconnecting…"}
                          </small>
                        </div>
                        {p.id === state.host ? (
                          <Crown size={18} className="gold" />
                        ) : (
                          <span
                            className={`presence ${p.connected ? "active" : ""}`}
                          />
                        )}
                      </div>
                    ))}
                    {state.players.length < 8 && (
                      <div className="empty-seat">
                        <Users size={18} /> Waiting for your partners in crime…
                      </div>
                    )}
                  </div>
                </section>
                <aside className="panel invite">
                  <Radio size={28} />
                  <h2>Good heists need company.</h2>
                  <p>Send your crew the invite link or share this room code.</p>
                  <div className="room-code">{state.code}</div>
                  <button className="secondary full" onClick={copy}>
                    {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                    {copied ? "Link copied" : "Copy invite link"}
                  </button>
                  <button
                    className="primary full"
                    disabled={
                      !host ||
                      state.players.filter((p) => p.connected).length < 2 ||
                      busy ||
                      !connected
                    }
                    onClick={() => act("start")}
                  >
                    {host ? "Start the heist" : "Waiting for the host"}
                    <ArrowRight size={18} />
                  </button>
                  <small>
                    {state.players.filter((p) => p.connected).length < 2
                      ? "At least 2 connected agents required."
                      : "Six rounds. One richest thief."}
                  </small>
                </aside>
              </div>
            </>
          ) : (
            <>
              <section className="round-title">
                <div>
                  <span className="tag">
                    {state.phase === "finished"
                      ? "HEIST COMPLETE"
                      : state.phase === "summary"
                        ? "THE DAMAGE REPORT"
                        : state.phase === "reveal"
                          ? "SECURITY BREACHED"
                          : state.phase === "preview"
                            ? "INTEL INCOMING"
                            : "MAKE YOUR MOVE"}
                  </span>
                  <h1>
                    {state.phase === "finished"
                      ? "Crime pays."
                      : state.phase === "summary"
                        ? "Count your credits."
                        : state.phase === "reveal"
                          ? "The truth comes out."
                          : state.phase === "preview"
                            ? "Study the signals."
                            : "Which vault is yours?"}
                  </h1>
                  <p>
                    {state.phase === "finished"
                      ? "The crew made it out. Someone made it out richer."
                      : state.phase === "decision"
                        ? "Pick a vault. Read the room. Lock in when you’re ready."
                        : state.phase === "preview"
                          ? "Your private intel is below. Outcomes are already sealed."
                          : state.phase === "reveal"
                            ? "Same vault? Same share. Traps take up to 35 credits."
                            : "A new round begins automatically. Fresh vaults. Fresh secrets."}
                  </p>
                </div>
                {state.phase !== "finished" && (
                  <div
                    className={`timer ${seconds <= 5 ? "urgent" : ""}`}
                    role="timer"
                    aria-label={`${seconds} seconds remaining`}
                  >
                    <strong>{String(seconds).padStart(2, "0")}</strong>
                    <span>
                      {state.phase === "decision" ? "TO LOCK IN" : "SECONDS"}
                    </span>
                  </div>
                )}
              </section>
              {state.phase === "finished" ? (
                <section className="results panel">
                  <Trophy size={48} className="gold" />
                  <span className="eyebrow">
                    {ranked.filter((p) => p.credits === ranked[0].credits)
                      .length > 1
                      ? "SHARED VICTORY"
                      : "TOP AGENT"}
                  </span>
                  <h2>
                    {ranked
                      .filter((p) => p.credits === ranked[0].credits)
                      .map((p) => p.name)
                      .join(" & ")}
                  </h2>
                  <p>
                    <b>{ranked[0]?.credits} CR</b> extracted from the vaults
                  </p>
                  <div className="final-stats">
                    Your haul: <b>{me?.credits} CR</b> · Successful vaults:{" "}
                    <b>{me?.wins}/6</b>
                  </div>
                  <button
                    className="primary"
                    disabled={!host || busy || !connected}
                    onClick={() => act("rematch")}
                  >
                    {host ? "Run it back" : "Waiting for host to rematch"}{" "}
                    <ArrowRight size={18} />
                  </button>
                  <button className="text-button" onClick={copy}>
                    {copied ? "Invite copied" : "Share crew invite"}{" "}
                    <Copy size={16} />
                  </button>
                </section>
              ) : (
                <>
                  <div className="intel-banner">
                    <div className="intel-icon">
                      <Fingerprint size={26} />
                    </div>
                    <div>
                      <span>YOUR EYES ONLY // PRIVATE INTEL</span>
                      <p>{priv?.intel || "Decrypting your intel…"}</p>
                    </div>
                    <ShieldCheck size={22} />
                  </div>
                  <div className="vault-grid">
                    {names.map((n, i) => {
                      const o = state.outcomes?.[i],
                        selected = priv?.choice === i;
                      return (
                        <button
                          key={n}
                          className={`vault-card ${selected ? "selected" : ""} ${o?.kind === "trap" ? "trap" : ""} ${o ? "revealed" : ""}`}
                          disabled={
                            state.phase !== "decision" ||
                            me?.locked ||
                            !connected ||
                            busy
                          }
                          onClick={() =>
                            act("choose", { vault: i, lock: false })
                          }
                          aria-label={`Select vault ${i + 1} ${n}`}
                          aria-pressed={selected}
                        >
                          <div className="vault-card-top">
                            <span>0{i + 1}</span>
                            {selected ? (
                              <span className="selected-label">
                                {me?.locked ? "LOCKED" : "SELECTED"}{" "}
                                <Check size={12} />
                              </span>
                            ) : (
                              <LockKeyhole size={14} />
                            )}
                          </div>
                          <VaultArt variant={i} open={!!o} />
                          <h3>{n}</h3>
                          <div className="vault-status">
                            {o
                              ? o.kind === "trap"
                                ? `TRAP · −${o.amount} CR`
                                : `${o.amount} CR POOL`
                              : state.phase === "preview"
                                ? "ENCRYPTED"
                                : "CONTENTS UNKNOWN"}
                          </div>
                          {o && (
                            <div className="occupants">
                              {state.players
                                .filter((p) => p.choice === i)
                                .map((p) => (
                                  <span
                                    key={p.id}
                                    title={p.name}
                                    style={{ color: colors[p.color] }}
                                  >
                                    {avatars[p.avatar]}
                                  </span>
                                ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="selection-bar">
                    <span>
                      {me?.locked ? (
                        <>
                          <ShieldCheck size={18} /> Locked. Your move is sealed.
                        </>
                      ) : priv?.choice != null ? (
                        <>
                          Vault {priv.choice + 1} selected. Change it or seal
                          the deal.
                        </>
                      ) : state.phase === "decision" ? (
                        "Select a vault to make your move."
                      ) : (
                        "No speed bonus. Every agent gets the same deadline."
                      )}
                    </span>
                    {state.phase === "decision" && (
                      <button
                        className="primary"
                        disabled={
                          priv?.choice == null ||
                          me?.locked ||
                          !connected ||
                          busy
                        }
                        onClick={() =>
                          act("choose", { vault: priv?.choice, lock: true })
                        }
                      >
                        {me?.locked ? "Locked in" : "Lock my choice"}
                        <LockKeyhole size={17} />
                      </button>
                    )}
                  </div>
                </>
              )}
              <section className="scoreboard panel">
                <div className="panel-heading">
                  <h2>
                    {state.phase === "finished"
                      ? "The final cut"
                      : "Crew standings"}
                  </h2>
                  <span>
                    {state.players.filter((p) => p.locked).length}/
                    {state.players.length} LOCKED
                  </span>
                </div>
                {ranked.map((p, i) => (
                  <div
                    key={p.id}
                    className={`score-row ${p.id === me?.id ? "is-me" : ""}`}
                  >
                    <span className="rank">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="mini-avatar"
                      style={{ color: colors[p.color] }}
                    >
                      {avatars[p.avatar]}
                    </span>
                    <b>
                      {p.name} {p.id === me?.id && <small>YOU</small>}
                    </b>
                    <span className="player-status">
                      {!p.connected
                        ? "OFFLINE"
                        : p.locked
                          ? "LOCKED"
                          : "IN THE FIELD"}
                    </span>
                    {["reveal", "summary", "finished"].includes(
                      state.phase,
                    ) && (
                      <span className={p.delta < 0 ? "loss" : "gain"}>
                        {p.delta >= 0 ? "+" : ""}
                        {p.delta}
                      </span>
                    )}
                    <strong>
                      {p.credits}
                      <small> CR</small>
                    </strong>
                  </div>
                ))}
              </section>
            </>
          )}
          <div className="game-foot">
            <ShieldCheck size={14} /> SERVER-SEALED OUTCOMES{" "}
            <span>NO ACCOUNTS. NO BUY-INS. JUST THE HEIST.</span>
          </div>
        </main>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(null);
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input",
                );
                const first = items[0],
                  last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
            <span className="eyebrow">
              {modal === "how" ? "THE INSIDE JOB" : "YOUR NEXT BIG SCORE"}
            </span>
            <h2 id="modal-title">
              {modal === "how"
                ? "Get in. Get rich."
                : modal === "create"
                  ? "Build your crew."
                  : "You’re expected."}
            </h2>
            {modal === "how" ? (
              <>
                <ol className="how-list">
                  <li>
                    <b>Read your private intel.</b>
                    <p>
                      Hints are truthful. Your friends’ stories might not be.
                    </p>
                  </li>
                  <li>
                    <b>Pick one of five vaults.</b>
                    <p>
                      You have 20 seconds. Change your pick until you lock.
                      Unlocked picks still count at the deadline.
                    </p>
                  </li>
                  <li>
                    <b>Split the loot. Dodge the traps.</b>
                    <p>
                      Credits divide evenly, rounded down. Traps take up to 35
                      credits; balances never go below zero.
                    </p>
                  </li>
                  <li>
                    <b>Six rounds. One winner.</b>
                    <p>
                      Most credits wins. Ties share victory. Miss a pick and
                      earn zero that round.
                    </p>
                  </li>
                </ol>
                <button
                  className="primary full"
                  onClick={() => setModal("create")}
                >
                  I’m in <ArrowRight size={18} />
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enter();
                }}
              >
                <label htmlFor="nickname">AGENT NAME</label>
                <input
                  autoFocus
                  id="nickname"
                  maxLength={18}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your alias"
                  autoComplete="nickname"
                />
                {modal === "join" && (
                  <>
                    <label htmlFor="room-input">ROOM CODE</label>
                    <input
                      id="room-input"
                      required
                      maxLength={6}
                      minLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ABC234"
                      autoComplete="off"
                    />
                  </>
                )}
                <label>CHOOSE YOUR SIGNATURE</label>
                <div className="avatar-options">
                  {avatars.map((a, i) => (
                    <button
                      key={a}
                      type="button"
                      aria-label={`Avatar ${i + 1}`}
                      aria-pressed={avatar === i}
                      className={avatar === i ? "chosen" : ""}
                      onClick={() => setAvatar(i)}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <div className="color-options">
                  {colors.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      style={{ background: c }}
                      aria-label={`Color ${i + 1}`}
                      aria-pressed={color === i}
                      onClick={() => setColor(i)}
                    >
                      {color === i && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <button
                  className="primary full"
                  disabled={busy || !connected || !name.trim()}
                  type="submit"
                >
                  {busy
                    ? "Connecting…"
                    : modal === "create"
                      ? "Create room"
                      : "Join crew"}
                  <ChevronRight size={18} />
                </button>
                <p className="form-note">
                  <ShieldCheck size={13} /> Private rooms. Real friends. No
                  account needed.
                </p>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="recovery">
        <h1>The signal broke.</h1>
        <p>Reload to recover your crew session.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reconnect
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
