import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3001", {
  autoConnect: false
});


export function connectSocket(token: string) {
  socket.auth = { token };
  if (!socket.connected) socket.connect();
}

export default socket;