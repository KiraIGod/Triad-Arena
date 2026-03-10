import { useEffect, useRef, useState } from "react";
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

type UseLobbyArenaResult = {
  isOnline: boolean;
  isCreatingArena: boolean;
  isJoiningArena: boolean;
  error: string | null;
  handleCreateArena: () => void;
  handleJoinArena: () => void;
  cancelSearch: () => void;
};

export function useLobbyArena(token: string | null): UseLobbyArenaResult {
  const navigate = useNavigate();
  const [isCreatingArena, setIsCreatingArena] = useState(false);
  const [isJoiningArena, setIsJoiningArena] = useState(false);
  const [isOnline, setIsOnline] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  const joinCancelledRef = useRef(false);

  useEffect(() => {
    if (token) {
      socket.auth = { token };
      if (socket.connected) {
        socket.disconnect();
      }
    }
    socket.connect();
    const onConnect = () => setIsOnline(true);
    const onDisconnect = () => setIsOnline(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [token]);

  const cancelSearch = () => {
    joinCancelledRef.current = true;
    setIsJoiningArena(false);
    setError(null);
  };

  const handleCreateArena = () => {
    if (isCreatingArena) return;

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
    if (isJoiningArena) return;

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
    handleCreateArena,
    handleJoinArena,
    cancelSearch
  };
}
