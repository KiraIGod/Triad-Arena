import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../../shared/socket/socket";

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
  const [arenaId] = useState<string | null>(null);

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
    setError(null)
    setIsCreatingArena(true);
    socket.emit("arena:create", (res) => {
    if (!res?.matchId) {
      setError(res?.error ?? "Failed to create arena");
      setIsCreatingArena(false);
      return;
    }
    setIsCreatingArena(false);
    navigate(`/game?matchId=${res.matchId}`);
    });

  }

  const handleJoinArena = () => {
    // TODO: implement join random arena flow
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
