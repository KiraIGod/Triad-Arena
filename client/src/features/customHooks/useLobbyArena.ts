import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../../shared/socket/socket";

type CreateArenaResponse = {
  arenaId?: string;
  error?: string;
};

type JoinArenaResponse = {
  arenaId?: string;
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
};

export function useLobbyArena(): UseLobbyArenaResult {
  const navigate = useNavigate();
const [isCreatingArena, setIsCreatingArena] = useState(false);
const [isJoiningArena, setIsJoiningArena] = useState(false);
  const [isOnline, setIsOnline] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    socket.connect();
    const onConnect = () => setIsOnline(true);
    const onDisconnect = () => setIsOnline(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, []);

  const handleCreateArena = () => {
    if (isCreatingArena) return;

    setError(null)
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
    console.log("arena:create success:", res.arenaId)
    navigate(`/game?arenaId=${res.arenaId}`);
    });

  }

  const handleJoinArena = () => {
    if (isJoiningArena) return;

    setError(null);
    setIsJoiningArena(true);

    const timeoutId = setTimeout(() => {
      setError("Failed to join arena. Please try again.");
      setIsJoiningArena(false);
      console.error("arena:join-random timeout");
    }, 7000);

    socket.emit("arena:join", (res?: JoinArenaResponse) => {
      clearTimeout(timeoutId);

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
      navigate(`/game?arenaId=${res.arenaId}&opponent=${opponent}`);
    });
  };

  return {
    isOnline,
    isCreatingArena,
    isJoiningArena,
    error,
    handleCreateArena,
    handleJoinArena
  };
}
