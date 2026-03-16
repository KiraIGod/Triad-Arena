import { useEffect, useState, useCallback } from "react";
import socket from "../../shared/socket/socket";

export type GameInvite = {
  arenaId: string;
  roomCode: string | null;
  hostNickname: string;
  hostUserId: string;
  receivedAt: number;
};

type UseGameInvitesResult = {
  invite: GameInvite | null;
  acceptInvite: () => void;
  declineInvite: () => void;
  sendInvite: (arenaId: string, targetUserId: string) => Promise<{ error?: string }>;
};

export function useGameInvites(onAccept?: (roomCode: string) => void): UseGameInvitesResult {
  const [invite, setInvite] = useState<GameInvite | null>(null);

  useEffect(() => {
    const onInvitation = (payload?: {
      arenaId?: string;
      roomCode?: string | null;
      hostNickname?: string;
      hostUserId?: string;
    }) => {
      if (!payload?.arenaId) return;

      setInvite({
        arenaId: payload.arenaId,
        roomCode: payload.roomCode ?? null,
        hostNickname: payload.hostNickname ?? "UNKNOWN",
        hostUserId: payload.hostUserId ?? "",
        receivedAt: Date.now(),
      });
    };

    socket.on("arena:invitation", onInvitation);
    return () => { socket.off("arena:invitation", onInvitation); };
  }, []);

  const acceptInvite = useCallback(() => {
    if (!invite?.roomCode) return;
    onAccept?.(invite.roomCode);
    setInvite(null);
  }, [invite, onAccept]);

  const declineInvite = useCallback(() => {
    setInvite(null);
  }, []);

  const sendInvite = useCallback((arenaId: string, targetUserId: string): Promise<{ error?: string }> => {
    return new Promise((resolve) => {
      socket.emit("arena:invite", { arenaId, targetUserId }, (res?: { error?: string; success?: boolean }) => {
        resolve({ error: res?.error });
      });
    });
  }, []);

  return { invite, acceptInvite, declineInvite, sendInvite };
}
