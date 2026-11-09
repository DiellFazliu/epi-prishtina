import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketContext } from './WebSocketContext.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getWebSocketUrl() {
  const apiUrl = new URL(API_URL, window.location.origin);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return new URL('/ws', `${protocol}//${apiUrl.host}`).toString();
}

export function WebSocketProvider({ children }) {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer;
    let pingTimer;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token || !['admin', 'health_worker', 'analyst'].includes(user?.role)) {
        setStatus('disconnected');
        return;
      }

      const socket = new WebSocket(getWebSocketUrl());
      wsRef.current = socket;
      socket.onopen = () => {
        setStatus('connected');
        socket.send(JSON.stringify({ action: 'authenticate', token }));
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'ping', timestamp: new Date().toISOString() }));
          }
        }, 30000);
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (['connected', 'subscribed', 'unsubscribed', 'pong'].includes(data.type)) return;
          setLastEvent(data);
          setEventCount((count) => count + 1);
        } catch (error) {
          console.error('WebSocket message parse failed:', error);
        }
      };
      socket.onerror = () => setStatus('error');
      socket.onclose = () => {
        clearInterval(pingTimer);
        setStatus('disconnected');
        if (!disposed) reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [user?.id, user?.role]);

  return (
    <WebSocketContext.Provider value={{ lastEvent, status, eventCount }}>
      {children}
    </WebSocketContext.Provider>
  );
}
