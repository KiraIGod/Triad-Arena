import { useEffect, useRef } from "react";
import socket from "../../shared/socket/socket";
import {
  joinMatch,
  offMatchError,
  offMatchFinish,
  offMatchState,
  offMatchTimer,
  offMatchUpdate,
  onMatchError,
  onMatchFinish,
  onMatchState,
  onMatchTimer,
  onMatchUpdate,
  syncMatch,
  type MatchErrorPayload,
  type MatchFinishPayload,
  type MatchStatePayload,
  type MatchTimerPayload,
} from "../../shared/socket/matchSocket";

type ArenaPlayer = { userId?: string | number; nickname?: string };

type UseGameMatchSessionParams = {
  arenaId: string;
  token: string | null;
  userIdStr: string | null;
  arenaMatchId: string | null;
  currentMatchId: string | null;
  isSameUser: (value: string | number | null | undefined) => boolean;
  setArenaMatchId: (matchId: string | null) => void;
  setOpponentNickname: (nickname: string) => void;
  onSetReconnecting: (value: boolean) => void;
  onResetJoinState: () => void;
  onMatchStatePayload: (payload: MatchStatePayload) => void;
  onMatchUpdatePayload: (payload: MatchStatePayload) => void;
  onMatchErrorPayload: (payload: MatchErrorPayload) => void;
  onMatchFinishPayload: (payload: MatchFinishPayload) => void;
  onMatchTimerPayload: (payload: MatchTimerPayload) => void;
};

export function useGameMatchSession({
  arenaId,
  token,
  userIdStr,
  arenaMatchId,
  currentMatchId,
  isSameUser,
  setArenaMatchId,
  setOpponentNickname,
  onSetReconnecting,
  onResetJoinState,
  onMatchStatePayload,
  onMatchUpdatePayload,
  onMatchErrorPayload,
  onMatchFinishPayload,
  onMatchTimerPayload,
}: UseGameMatchSessionParams): void {
  const joinedMatchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!arenaId || arenaId === "unknown") return;
    if (!token) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const updateOpponentFromPlayers = (players?: ArenaPlayer[]) => {
      if (!Array.isArray(players)) return;
      const opponent = players.find((player) => !isSameUser(player?.userId));
      setOpponentNickname(opponent?.nickname || "UNKNOWN");
    };

    const requestArenaState = () => {
      console.log("[game-session] requesting arena:get-state", {
        arenaId,
        arenaMatchId,
      });
      socket.emit(
        "arena:get-state",
        { arenaId },
        (res?: { matchId?: string; players?: ArenaPlayer[]; error?: string }) => {
          console.log("[game-session] arena:get-state ack", res);
          if (res?.error) {
            if (arenaMatchId) return;
            return;
          }
          updateOpponentFromPlayers(res?.players);
          if (res?.matchId) setArenaMatchId(res.matchId);
        }
      );
    };

    if (!arenaMatchId) {
      requestArenaState();
    }

    const onArenaReady = (payload?: { arenaId?: string; matchId?: string; players?: ArenaPlayer[] }) => {
      console.log("[game-session] arena:ready received", payload);
      if (!payload?.arenaId || payload.arenaId !== arenaId) return;
      updateOpponentFromPlayers(payload.players);
      if (payload.matchId) setArenaMatchId(payload.matchId);
    };

    const onConnect = () => {
      console.log("[game-session] socket connected for arena session", {
        socketId: socket.id,
        arenaId,
        arenaMatchId,
      });
      socket.emit("join_game", arenaId);
      if (!arenaMatchId) {
        requestArenaState();
      }
    };

    const pollId = window.setInterval(() => {
      if (!arenaMatchId) {
        requestArenaState();
      }
    }, 1500);

    socket.on("connect", onConnect);
    socket.on("arena:ready", onArenaReady);

    return () => {
      window.clearInterval(pollId);
      socket.off("connect", onConnect);
      socket.off("arena:ready", onArenaReady);
    };
  }, [arenaId, arenaMatchId, isSameUser, setArenaMatchId, setOpponentNickname, token]);

  useEffect(() => {
    if (!token || !userIdStr) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    const onConnect = () => {
      console.log("[game-session] socket connected for match sync", {
        socketId: socket.id,
        arenaMatchId,
      });
      onSetReconnecting(false);
      syncMatch();
    };

    const onDisconnect = () => {
      console.log("[game-session] socket disconnected during match session");
      onSetReconnecting(true);
    };

    // If the socket is already connected (e.g. navigated from lobby),
    // call syncMatch() immediately to cancel the defeat timer on the server.
    if (socket.connected) {
      syncMatch();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    onMatchState(onMatchStatePayload);
    onMatchUpdate(onMatchUpdatePayload);
    onMatchError(onMatchErrorPayload);
    onMatchFinish(onMatchFinishPayload);
    onMatchTimer(onMatchTimerPayload);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      offMatchState(onMatchStatePayload);
      offMatchUpdate(onMatchUpdatePayload);
      offMatchError(onMatchErrorPayload);
      offMatchFinish(onMatchFinishPayload);
      offMatchTimer(onMatchTimerPayload);
    };
  }, [
    onMatchErrorPayload,
    onMatchFinishPayload,
    onMatchStatePayload,
    onMatchTimerPayload,
    onMatchUpdatePayload,
    onSetReconnecting,
    token,
    userIdStr,
  ]);

  useEffect(() => {
    if (!arenaMatchId || !token || !userIdStr) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    if (joinedMatchRef.current !== arenaMatchId) {
      console.log("[game-session] switching to arenaMatchId", {
        from: joinedMatchRef.current,
        to: arenaMatchId,
      });
      joinedMatchRef.current = arenaMatchId;
      onResetJoinState();
    }

    if (currentMatchId !== arenaMatchId) {
      console.log("[game-session] joinMatch emit", {
        arenaMatchId,
        currentMatchId,
      });
      joinMatch(arenaMatchId);
    }

    const retryId = window.setTimeout(() => {
      if (currentMatchId !== arenaMatchId) {
        syncMatch();
        joinMatch(arenaMatchId);
      }
    }, 1200);

    return () => {
      window.clearTimeout(retryId);
    };
  }, [arenaMatchId, currentMatchId, onResetJoinState, token, userIdStr]);
}
