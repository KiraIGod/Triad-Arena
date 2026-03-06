import matchSocket from "./socket";

export type MatchStatePayload = {
  matchId: string;
  players: string[];
  state: {
    version: number;
    turn: number;
    activePlayer: string;
    players: {
      player1: { hp: number; shield: number; energy: number };
      player2: { hp: number; shield: number; energy: number };
    };
    turnActions: Array<{ actionId: string; cardId: string; playerId: string }>;
    finished: boolean;
  };
};

export type MatchErrorPayload = {
  type: string;
  message: string;
};

export function queueForMatch(): void {
  if (!matchSocket.connected) {
    matchSocket.connect();
  }
  matchSocket.emit("match:queue");
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
