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

type UseLobbyArenaResult = {
  isOnline: boolean;
  isCreatingArena: boolean;
  isJoiningArena: boolean;
  error: string | null;
  activeMatchId: string | null;
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

  const joinCancelledRef = useRef(false);

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
    };
  }, [token, checkActiveMatch]);

  const handleReconnect = () => {
    if (!activeMatchId) return;
    navigate(`/game?matchId=${encodeURIComponent(activeMatchId)}`);
  };

  const cancelSearch = () => {
    joinCancelledRef.current = true;
    setIsJoiningArena(false);
    setError(null);
  };

  const handleCreateArena = () => {
    if (isCreatingArena || activeMatchId) return;

    setError(null);
    setIsCreatingArena(true);

    const timeoutId = setTimeout(() => {
      setError("Failed to create arena. Please try again.");
      setIsCreatingArena(false);
      console.error("arena:create timeout");
    }, 7000);

    socket.emit("arena:create", (res?: CreateArenaResponse) => {
      clearTimeout(timeoutId);

      if (!res?.arenaId) {
        const message = res?.error ?? "Failed to create arena";
        setError(message);
        setIsCreatingArena(false);
        console.error("arena:create failed:", message);
        return;
      }

      setIsCreatingArena(false);
      console.log("arena:create success:", res.arenaId);
      navigate(`/game?arenaId=${res.arenaId}`);
    });
  };

  const handleJoinArena = () => {
    if (isJoiningArena || activeMatchId) return;

    joinCancelledRef.current = false;
    setError(null);
    setIsJoiningArena(true);

    const timeoutId = setTimeout(() => {
      if (joinCancelledRef.current) return;
      setError("Failed to join arena. Please try again.");
      setIsJoiningArena(false);
      console.error("arena:join-random timeout");
    }, 7000);

    socket.emit("arena:join", (res?: JoinArenaResponse) => {
      clearTimeout(timeoutId);

      if (joinCancelledRef.current) return;

      if (!res?.arenaId) {
        const message = res?.error ?? "Failed to join arena";
        setError(message);
        setIsJoiningArena(false);
        console.error("arena:join failed:", message);
        return;
      }

      setIsJoiningArena(false);
      console.log("arena:join success:", res.arenaId);
      const opponent = encodeURIComponent(res.opponentNickname ?? "UNKNOWN");
      const matchIdPart = res.matchId ? `&matchId=${encodeURIComponent(res.matchId)}` : "";
      navigate(`/game?arenaId=${res.arenaId}&opponent=${opponent}${matchIdPart}`);
    });
  };

  return {
    isOnline,
    isCreatingArena,
    isJoiningArena,
    error,
    activeMatchId,
    handleCreateArena,
    handleJoinArena,
    handleReconnect,
    cancelSearch
  };
}
