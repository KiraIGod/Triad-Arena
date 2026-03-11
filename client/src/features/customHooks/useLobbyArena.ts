import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../../shared/socket/socket";

type CreateArenaResponse = {
  arenaId?: string;
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

type UseLobbyArenaResult = {
  isOnline: boolean;
  isCreatingArena: boolean;
  isJoiningArena: boolean;
  error: string | null;
  activeMatchId: string | null;
  searchTimeLeft: number;
  handleCreateArena: () => void;
  handleJoinArena: () => void;
  handleReconnect: () => void;
  cancelSearch: () => void;
};

export function useLobbyArena(token: string | null): UseLobbyArenaResult {
  const navigate = useNavigate();
  const [isCreatingArena, setIsCreatingArena] = useState(false);
  const [isJoiningArena, setIsJoiningArena] = useState(false);
  const [isOnline, setIsOnline] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [searchTimeLeft, setSearchTimeLeft] = useState(0);

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
      if (res?.hasActiveMatch && res.matchId) {
        setActiveMatchId(res.matchId);
      } else {
        setActiveMatchId(null);
      }
    });
  }, []);

  useEffect(() => {
    if (token) {
      socket.auth = { token };
      if (socket.connected) {
        socket.disconnect();
      }
    }
    socket.connect();

    const onConnect = () => {
      setIsOnline(true);
      checkActiveMatch();
    };
    const onDisconnect = () => setIsOnline(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      checkActiveMatch();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
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
  };

  const attemptJoin = useCallback(() => {
    if (joinCancelledRef.current) return;

    const now = Date.now();
    if (now >= searchDeadlineRef.current) {
      clearSearchTimers();
      setIsJoiningArena(false);
      setError("No available rooms found. Try again or create your own arena.");
      return;
    }

    socket.emit("arena:join", (res?: JoinArenaResponse) => {
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
  }, [navigate, clearSearchTimers]);

  const handleJoinArena = () => {
    if (isJoiningArena || activeMatchId) return;

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

  const handleCreateArena = () => {
    if (isCreatingArena || activeMatchId) return;

    setError(null);
    setIsCreatingArena(true);

    const timeoutId = setTimeout(() => {
      setError("Failed to create arena. Please try again.");
      setIsCreatingArena(false);
    }, 7000);

    socket.emit("arena:create", (res?: CreateArenaResponse) => {
      clearTimeout(timeoutId);

      if (!res?.arenaId) {
        const message = res?.error ?? "Failed to create arena";
        setError(message);
        setIsCreatingArena(false);
        return;
      }

      setIsCreatingArena(false);
      navigate(`/game?arenaId=${res.arenaId}`);
    });
  };

  return {
    isOnline,
    isCreatingArena,
    isJoiningArena,
    error,
    activeMatchId,
    searchTimeLeft,
    handleCreateArena,
    handleJoinArena,
    handleReconnect,
    cancelSearch
  };
}
