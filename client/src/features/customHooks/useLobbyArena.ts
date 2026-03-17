import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../../shared/socket/socket";

type CreateArenaResponse = {
  arenaId?: string;
  roomCode?: string | null;
  error?: string;
};

type JoinArenaResponse = {
  arenaId?: string;
  matchId?: string | null;
  opponentNickname?: string;
  error?: string;
};

type CheckActiveResponse = {
  hasActiveMatch: boolean;
  matchId: string | null;
};

const SEARCH_TIMEOUT_SEC = 60;
const SEARCH_RETRY_MS = 3000;

type GameMode = "normal" | "ranked" | "private";

type UseLobbyArenaResult = {
  isOnline: boolean;
  isCreatingArena: boolean;
  isJoiningArena: boolean;
  error: string | null;
  activeMatchId: string | null;
  searchTimeLeft: number;
  roomCode: string | null;
  privateArenaId: string | null;
  isWaitingPrivate: boolean;
  handleCreateArena: () => void;
  handleJoinArena: () => void;
  handleJoinByCode: (code: string) => void;
  handleReconnect: () => void;
  cancelSearch: () => void;
  cancelRoom: () => void;
  setError: (msg: string | null) => void;
};

export function useLobbyArena(token: string | null, gameMode: GameMode = "normal"): UseLobbyArenaResult {
  const navigate = useNavigate();
  const [isCreatingArena, setIsCreatingArena] = useState(false);
  const [isJoiningArena, setIsJoiningArena] = useState(false);
  const [isOnline, setIsOnline] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [searchTimeLeft, setSearchTimeLeft] = useState(0);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [privateArenaId, setPrivateArenaId] = useState<string | null>(null);
  const [isWaitingPrivate, setIsWaitingPrivate] = useState(false);

  const joinCancelledRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchDeadlineRef = useRef(0);

  const clearSearchTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setSearchTimeLeft(0);
  }, []);

  const checkActiveMatch = useCallback(() => {
    if (!socket.connected) return;
    socket.emit("match:check-active", (res?: CheckActiveResponse) => {
      console.log("[lobby] match:check-active response", res);
      if (res?.hasActiveMatch && res.matchId) {
        setActiveMatchId(res.matchId);
      } else {
        setActiveMatchId(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!token) return;

    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      console.log("[lobby] socket connected", { id: socket.id, gameMode });
      setIsOnline(true);
      checkActiveMatch();
    };
    const onDisconnect = (reason?: string) => {
      console.log("[lobby] socket disconnected", { reason });
      setIsOnline(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setIsOnline(true);
      checkActiveMatch();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      joinCancelledRef.current = true;
      clearSearchTimers();
    };
  }, [token, checkActiveMatch, clearSearchTimers]);

  const handleReconnect = () => {
    if (!activeMatchId) return;
    navigate(`/game?matchId=${encodeURIComponent(activeMatchId)}`);
  };

  const cancelSearch = () => {
    joinCancelledRef.current = true;
    clearSearchTimers();
    setIsJoiningArena(false);
    setError(null);
    socket.emit("match:cancel");
    socket.emit("arena:cancel-search");
  };

  useEffect(() => {
    if (!isJoiningArena) return;

    const onArenaReady = (payload?: {
      arenaId?: string;
      matchId?: string;
      players?: Array<{ userId?: string; nickname?: string }>;
    }) => {
      console.log("[lobby] arena:ready received during search", payload);
      if (!payload?.matchId || joinCancelledRef.current) return;

      joinCancelledRef.current = true;
      clearSearchTimers();
      setIsJoiningArena(false);

      const params = new URLSearchParams();
      if (payload.arenaId) params.set("arenaId", payload.arenaId);
      params.set("matchId", payload.matchId);
      navigate(`/game?${params.toString()}`);
    };

    socket.on("arena:ready", onArenaReady);
    return () => {
      socket.off("arena:ready", onArenaReady);
    };
  }, [isJoiningArena, navigate, clearSearchTimers]);

  const attemptJoin = useCallback(() => {
    if (joinCancelledRef.current) return;

    const now = Date.now();
    if (now >= searchDeadlineRef.current) {
      clearSearchTimers();
      setIsJoiningArena(false);
      setError("No available rooms found. Try again or create your own arena.");
      return;
    }

    socket.emit("match:check-active", (activeRes?: CheckActiveResponse) => {
      console.log("[lobby] pre-join active match response", activeRes);
      if (joinCancelledRef.current) return;

      if (activeRes?.hasActiveMatch && activeRes.matchId) {
        clearSearchTimers();
        setIsJoiningArena(false);
        navigate(`/game?matchId=${encodeURIComponent(activeRes.matchId)}`);
        return;
      }

      console.log("[lobby] emitting arena:join", { gameMode });
      socket.emit("arena:join", { gameMode }, (res?: JoinArenaResponse) => {
        console.log("[lobby] arena:join ack", res);
        if (joinCancelledRef.current) return;

        if (res?.arenaId) {
          clearSearchTimers();
          setIsJoiningArena(false);
          const opponent = encodeURIComponent(res.opponentNickname ?? "UNKNOWN");
          const matchIdPart = res.matchId ? `&matchId=${encodeURIComponent(res.matchId)}` : "";
          navigate(`/game?arenaId=${res.arenaId}&opponent=${opponent}${matchIdPart}`);
          return;
        }

        const isRetryable =
          !res?.error ||
          res.error === "No available arena found" ||
          res.error === "Arena is unavailable";

        if (isRetryable && Date.now() < searchDeadlineRef.current) {
          retryTimerRef.current = setTimeout(attemptJoin, SEARCH_RETRY_MS);
        } else {
          clearSearchTimers();
          setIsJoiningArena(false);
          setError(res?.error ?? "Failed to find a match");
        }
      });
    });
  }, [navigate, clearSearchTimers, gameMode]);

  const handleJoinArena = () => {
    if (isJoiningArena || activeMatchId) return;

    console.log("[lobby] handleJoinArena", { gameMode, activeMatchId, isJoiningArena });
    joinCancelledRef.current = false;
    setError(null);
    setIsJoiningArena(true);

    searchDeadlineRef.current = Date.now() + SEARCH_TIMEOUT_SEC * 1000;
    setSearchTimeLeft(SEARCH_TIMEOUT_SEC);

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((searchDeadlineRef.current - Date.now()) / 1000)
      );
      setSearchTimeLeft(remaining);
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }, 1000);

    attemptJoin();
  };

  const cancelRoom = useCallback(() => {
    if (privateArenaId) {
      socket.emit("arena:cancel-search");
    }
    setRoomCode(null);
    setPrivateArenaId(null);
    setIsWaitingPrivate(false);
    setIsCreatingArena(false);
    setError(null);
  }, [privateArenaId]);

  useEffect(() => {
    if (!isWaitingPrivate || !privateArenaId) return;

    const onArenaReady = (payload?: {
      arenaId?: string;
      matchId?: string;
      players?: Array<{ userId?: string; nickname?: string }>;
    }) => {
      console.log("[lobby] arena:ready received for private room", payload);
      if (!payload?.matchId) return;
      if (payload.arenaId && payload.arenaId !== privateArenaId) return;

      setRoomCode(null);
      setPrivateArenaId(null);
      setIsWaitingPrivate(false);
      setIsCreatingArena(false);

      const params = new URLSearchParams();
      if (payload.arenaId) params.set("arenaId", payload.arenaId);
      params.set("matchId", payload.matchId);
      navigate(`/game?${params.toString()}`);
    };

    socket.on("arena:ready", onArenaReady);
    return () => { socket.off("arena:ready", onArenaReady); };
  }, [isWaitingPrivate, privateArenaId, navigate]);

  const handleCreateArena = () => {
    if (isCreatingArena || activeMatchId) return;

    console.log("[lobby] handleCreateArena", { gameMode, activeMatchId, isCreatingArena });
    setError(null);
    setIsCreatingArena(true);

    const timeoutId = setTimeout(() => {
      setError("Failed to create arena. Please try again.");
      setIsCreatingArena(false);
    }, 7000);

    console.log("[lobby] emitting arena:create", { gameMode });
    socket.emit("arena:create", { gameMode }, (res?: CreateArenaResponse) => {
      console.log("[lobby] arena:create ack", res);
      clearTimeout(timeoutId);

      if (!res?.arenaId) {
        const message = res?.error ?? "Failed to create arena";
        setError(message);
        setIsCreatingArena(false);
        return;
      }

      if (gameMode === "private" && res.roomCode) {
        setRoomCode(res.roomCode);
        setPrivateArenaId(res.arenaId);
        setIsWaitingPrivate(true);
        setIsCreatingArena(false);
        return;
      }

      setIsCreatingArena(false);
      navigate(`/game?arenaId=${res.arenaId}`);
    });
  };

  const handleJoinByCode = (code: string) => {
    if (!code.trim() || isJoiningArena || activeMatchId) return;

    console.log("[lobby] handleJoinByCode", { code: code.trim().toUpperCase() });
    joinCancelledRef.current = false;
    setError(null);
    setIsJoiningArena(true);

    socket.emit("arena:join-by-code", { roomCode: code.trim() }, (res?: JoinArenaResponse) => {
      console.log("[lobby] arena:join-by-code ack", res);
      setIsJoiningArena(false);

      if (res?.error) {
        setError(res.error);
        return;
      }

      if (res?.arenaId) {
        const opponent = encodeURIComponent(res.opponentNickname ?? "UNKNOWN");
        const matchIdPart = res.matchId ? `&matchId=${encodeURIComponent(res.matchId)}` : "";
        navigate(`/game?arenaId=${res.arenaId}&opponent=${opponent}${matchIdPart}`);
      }
    });
  };

  return {
    isOnline,
    isCreatingArena,
    isJoiningArena,
    error,
    activeMatchId,
    searchTimeLeft,
    roomCode,
    privateArenaId,
    isWaitingPrivate,
    handleCreateArena,
    handleJoinArena,
    handleJoinByCode,
    handleReconnect,
    cancelSearch,
    cancelRoom,
    setError
  };
}
