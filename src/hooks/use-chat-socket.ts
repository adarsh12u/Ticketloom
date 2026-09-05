"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { SOCKET_EVENTS, type SocketAck } from "@/lib/chat/socket-events";

const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

export function useChatSocket(enabled = true) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const instance = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
      autoConnect: true,
    });

    socketRef.current = instance;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);

    // Defer React state sync so connection setup stays outside the render cascade.
    const frame = requestAnimationFrame(() => {
      setSocket(instance);
      setConnected(instance.connected);
    });

    return () => {
      cancelAnimationFrame(frame);
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [enabled]);

  return { socket, connected, socketUrl };
}

export function emitWithAck<TPayload, TResult>(
  socket: Socket,
  event: string,
  payload: TPayload,
  timeoutMs = 10_000,
): Promise<SocketAck<TResult>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        ok: false,
        code: "INTERNAL_ERROR",
        message: "Request timed out.",
      });
    }, timeoutMs);

    socket
      .timeout(timeoutMs)
      .emit(event, payload, (err: Error | null, response: SocketAck<TResult>) => {
        clearTimeout(timer);
        if (err) {
          resolve({
            ok: false,
            code: "INTERNAL_ERROR",
            message: err.message || "Socket acknowledgement failed.",
          });
          return;
        }
        resolve(response);
      });
  });
}

export { SOCKET_EVENTS };
