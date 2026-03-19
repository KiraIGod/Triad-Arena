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
  const arenaStateRequestedRef = useRef(false);
  const matchNicknamesRequestedRef = useRef(false);

  useEffect(() => {
    // На некоторых переходах (например, рекконект по `matchId`) `arenaId` в URL может быть "unknown".
    // Сервер при этом умеет делать fallback по userId, поэтому не выходим здесь.
    if (!arenaId) return;
    if (!token) return;

    arenaStateRequestedRef.current = false;
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    socket.emit("join_game", arenaId);

    const updateOpponentFromPlayers = (players?: ArenaPlayer[]) => {
      if (!Array.isArray(players)) return;

      // При рекконекте сервер может вернуть players с частично заполненными полями.
      // Чтобы не перезаписывать корректное имя на "UNKNOWN" или на ник не того игрока,
      // обновляем opponentNickname только когда оппонент определён уверенно.
      const candidates = players.filter(
        (p): p is ArenaPlayer & { userId: string | number; nickname: string } =>
          p?.userId != null && typeof p.nickname === "string" && p.nickname.trim().length > 0,
      );

      if (candidates.length === 0) return;

      const opponent = candidates.find((player) => !isSameUser(player.userId));
      if (!opponent) return;

      const nextNickname = opponent.nickname.trim();
      // Не перезаписываем корректное имя на заглушку.
      if (nextNickname.toUpperCase() === "UNKNOWN") return;
      setOpponentNickname(nextNickname);
    };

    const requestArenaState = () => {
      console.log("[game-session] requesting arena:get-state", {
        arenaId,
        arenaMatchId,
      });

      const requestOpponentFromMatch = (matchId: string) => {
        if (matchNicknamesRequestedRef.current) return;
        socket.emit(
          "match:get-player-nicknames",
          { matchId },
          (res?: {
            error?: string;
            players?: Array<{ userId?: string | number; nickname?: string }>;
          }) => {
            if (res?.error) return;
            if (!Array.isArray(res?.players) || res.players.length === 0) return;

            const opponent = res.players.find((p) => !isSameUser(p.userId));
            const next = opponent?.nickname?.trim();
            if (!next) return;
            if (next.toUpperCase() === "UNKNOWN") return;
            matchNicknamesRequestedRef.current = true;
            setOpponentNickname(next);
          },
        );
      };

      socket.emit(
        "arena:get-state",
        { arenaId },
        (res?: { matchId?: string; players?: ArenaPlayer[]; error?: string }) => {
          console.log("[game-session] arena:get-state ack", res);
          if (res?.error) {
            if (arenaMatchId && !matchNicknamesRequestedRef.current) {
              requestOpponentFromMatch(arenaMatchId);
            }
            return;
          }

          if (res?.matchId) {
            requestOpponentFromMatch(res.matchId);
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

      // Если `arenaId` в URL "unknown" (рекконект по matchId), всё равно один раз запросим arena state,
      // чтобы корректно выставить opponentNickname из `players` (там есть nickname).
      if (!arenaMatchId || (arenaId === "unknown" && !arenaStateRequestedRef.current)) {
        if (arenaId === "unknown") arenaStateRequestedRef.current = true;
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

    // Важно: если сокет уже подключён (типичный сценарий при возврате/рекконекте),
    // обработчик `onConnect` не вызовется сам. Тогда opponentNickname так и останется "UNKNOWN".
    if (socket.connected) {
      onConnect();
    }

    return () => {
      window.clearInterval(pollId);
      socket.off("connect", onConnect);
      socket.off("arena:ready", onArenaReady);
    };
  }, [arenaId, arenaMatchId, isSameUser, setArenaMatchId, setOpponentNickname, token]);

  // Если страница открыта по `matchId` (после перезагрузки), `arena:get-state` может не
  // дать нужный nickname. Поэтому запрашиваем ники игроков по matchId напрямую.
  useEffect(() => {
    if (!token || !arenaMatchId) return;
    if (matchNicknamesRequestedRef.current) return;

    socket.auth = { token };
    if (!socket.connected) socket.connect();

    socket.emit(
      "match:get-player-nicknames",
      { matchId: arenaMatchId },
      (res?: {
        error?: string;
        players?: Array<{ userId?: string | number; nickname?: string }>;
      }) => {
        if (res?.error) return;
        if (!Array.isArray(res?.players) || res.players.length === 0) return;

        const opponent = res.players.find((p) => !isSameUser(p.userId));
        const next = opponent?.nickname?.trim();
        if (!next) return;
        if (next.toUpperCase() === "UNKNOWN") return;

        matchNicknamesRequestedRef.current = true;
        setOpponentNickname(next);
      },
    );
  }, [arenaMatchId, isSameUser, setOpponentNickname, token]);

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
