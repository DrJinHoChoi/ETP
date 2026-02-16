import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTokenStore } from '../store/tokenStore';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io('/events', {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function useWebSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const fetchBalance = useTokenStore((s) => s.fetchBalance);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;

    const ws = getSocket();
    ws.connect();

    // Token balance updates
    ws.on('token:balance', (data: { userId: string; balance: number; lockedBalance: number }) => {
      if (data.userId === userId) {
        fetchBalance();
      }
    });

    // Emit to custom listeners
    const events = ['trade:matched', 'order:updated', 'meter:reading', 'settlement:completed', 'stats:update', 'price:update', 'rec:update'];
    for (const event of events) {
      ws.on(event, (data: any) => {
        const handlers = listenersRef.current.get(event);
        if (handlers) {
          handlers.forEach((h) => h(data));
        }
      });
    }

    return () => {
      ws.off('token:balance');
      for (const event of events) {
        ws.off(event);
      }
      ws.disconnect();
    };
  }, [isAuthenticated, userId, fetchBalance]);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return { on };
}
