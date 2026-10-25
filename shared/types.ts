export type Phase =
  "lobby" | "preview" | "decision" | "reveal" | "summary" | "finished";
export interface Outcome {
  kind: "credits" | "trap";
  amount: number;
}
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: number;
  color: number;
  credits: number;
  connected: boolean;
  locked: boolean;
  choice?: number;
  delta: number;
  wins: number;
}
export interface GameState {
  code: string;
  host: string;
  phase: Phase;
  round: number;
  deadline: number;
  serverNow: number;
  players: PublicPlayer[];
  outcomes?: Outcome[];
}
export interface PrivateState {
  id: string;
  intel: string;
  choice: number | null;
}
export interface Reply {
  ok: boolean;
  error?: string;
  token?: string;
  code?: string;
}
