import matchSocket from "./socket";

export type MatchStatePayload = {
  matchId: string;
  players: string[];
  state: {
    version: number;
    turn: number;
    activePlayer: string;
    players: {
      player1: {
        hp: number;
        shield: number;
        energy: number;
        statuses?: Array<{ type: string; turns?: number; amount?: number }>;
        hand?: Array<{
          id: string;
          name: string;
          type: string;
          triad_type: string;
          mana_cost: number;
          attack: number | null;
          hp: number | null;
          description: string;
          created_at: string;
        }>;
        deckCount?: number;
      };
      player2: {
        hp: number;
        shield: number;
        energy: number;
        statuses?: Array<{ type: string; turns?: number; amount?: number }>;
        hand?: Array<{
          id: string;
          name: string;
          type: string;
          triad_type: string;
          mana_cost: number;
          attack: number | null;
          hp: number | null;
          description: string;
          created_at: string;
        }>;
        deckCount?: number;
      };
    };
    turnActions: Array<{ actionId: string; cardId: string; playerId: string }>;
    finished: boolean;
  };
  events?: Array<{
    eventId: number;
    turn: number | null;
    type: string;
    timestamp: number;
    payload: {
      playerId?: string;
      cardId?: string;
      actionId?: string | null;
      card?: {
        id: string;
        name: string;
        type: string;
        triad_type: string;
        mana_cost: number;
        attack: number | null;
        hp: number | null;
        description: string;
        image?: string;
        created_at: string;
      };
      [key: string]: unknown;
    };
  }>;
};

export type MatchErrorPayload = {
  type: string;
  message: string;
};

export type MatchFinishPayload = {
  winnerId: string | null;
  reason?: string;
  message?: string;
};

export function syncMatch(): void {
  if (!matchSocket.connected) {
    matchSocket.connect();
  }
  matchSocket.emit("match:sync");
}

export function joinMatch(matchId: string): void {
  if (!matchSocket.connected) {
    matchSocket.connect();
  }
  matchSocket.emit("match:join", { matchId });
}

export function leaveMatch(matchId: string): void {
  if (!matchSocket.connected) {
    return;
  }
  matchSocket.emit("match:leave", { matchId });
}

export function playMatchCard(payload: {
  matchId: string;
  cardId: string;
  actionId: string;
  version: number;
}): void {
  matchSocket.emit("match:playCard", payload);
}

export function endMatchTurn(payload: { matchId: string; version: number }): void {
  matchSocket.emit("match:endTurn", payload);
}

export function onMatchState(handler: (payload: MatchStatePayload) => void): void {
  matchSocket.on("match:state", handler);
}

export function onMatchUpdate(handler: (payload: MatchStatePayload) => void): void {
  matchSocket.on("match:update", handler);
}

export function onMatchError(handler: (payload: MatchErrorPayload) => void): void {
  matchSocket.on("match:error", handler);
}

export function offMatchState(handler: (payload: MatchStatePayload) => void): void {
  matchSocket.off("match:state", handler);
}

export function offMatchUpdate(handler: (payload: MatchStatePayload) => void): void {
  matchSocket.off("match:update", handler);
}

export function offMatchError(handler: (payload: MatchErrorPayload) => void): void {
  matchSocket.off("match:error", handler);
}

export function onMatchFinish(
  handler: (payload: MatchFinishPayload) => void
): void {
  matchSocket.on("match:finish", handler);
}

export function offMatchFinish(
  handler: (payload: MatchFinishPayload) => void
): void {
  matchSocket.off("match:finish", handler);
}
