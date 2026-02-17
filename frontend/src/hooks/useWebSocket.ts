import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTokenStore } from '../store/tokenStore';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io('/events', {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export type WebSocketEvent =
  | 'trade:matched'
  | 'order:updated'
  | 'meter:reading'
  | 'settlement:completed'
  | 'stats:update'
  | 'price:update'
  | 'rec:update';

const WS_EVENTS: WebSocketEvent[] = [
  'trade:matched',
  'order:updated',
  'meter:reading',
  'settlement:completed',
  'stats:update',
  'price:update',
  'rec:update',
];

export function useWebSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const fetchBalance = useTokenStore((s) => s.fetchBalance);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const ws = getSocket();
    ws.connect();

    ws.on('connect', () => setConnected(true));
    ws.on('disconnect', () => setConnected(false));
    ws.on('reconnect', () => setConnected(true));

    // Token balance updates
    ws.on('token:balance', (data: { userId: string; balance: number; lockedBalance: number }) => {
      if (data.userId === userId) {
        fetchBalance();
      }
    });

    // Emit to custom listeners
    for (const event of WS_EVENTS) {
      ws.on(event, (data: any) => {
        const handlers = listenersRef.current.get(event);
        if (handlers) {
          handlers.forEach((h) => h(data));
        }
      });
    }

    return () => {
      ws.off('connect');
      ws.off('disconnect');
      ws.off('reconnect');
      ws.off('token:balance');
      for (const event of WS_EVENTS) {
        ws.off(event);
      }
      ws.disconnect();
      setConnected(false);
    };
  }, [isAuthenticated, userId, fetchBalance]);

  const on = useCallback((event: WebSocketEvent, handler: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return { on, connected };
}

/**
 * 특정 WebSocket 이벤트를 구독하는 편의 훅.
 * 컴포넌트 마운트 시 자동 구독, 언마운트 시 자동 해제.
 */
export function useSocketEvent(event: WebSocketEvent, handler: (data: any) => void) {
  const { on } = useWebSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = (data: any) => handlerRef.current(data);
    const unsub = on(event, stableHandler);
    return unsub;
  }, [on, event]);
}
