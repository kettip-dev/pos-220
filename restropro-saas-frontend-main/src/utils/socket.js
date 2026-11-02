import io from 'socket.io-client';
import { VITE_BACKEND_SOCKET_IO } from '../config/config';

// In browser production environments, if VITE_BACKEND_SOCKET_IO is not set, or references internal/localhost hostnames
// while browsing from a real domain, fallback to relative origin so Nginx reverse-proxies /socket.io/ cleanly.
const resolveSocketUrl = () => {
  if (typeof window !== "undefined") {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!VITE_BACKEND_SOCKET_IO || (!isLocalhost && (VITE_BACKEND_SOCKET_IO.includes("localhost") || VITE_BACKEND_SOCKET_IO.includes("backend")))) {
      return undefined;
    }
  }
  return VITE_BACKEND_SOCKET_IO || undefined;
};

const socket = io(resolveSocketUrl(), {
  autoConnect: false, // Prevent automatic connection until explicit initialization
  rejectUnauthorized: false,
});

export const initSocket = () => {
  // if (!socket.connected) {
  //   socket.connect();
  // }
  socket.connect();
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;
