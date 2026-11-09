import { useContext } from 'react';
import { WebSocketContext } from './WebSocketContext.js';

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket duhet të përdoret brenda WebSocketProvider');
  }
  return context;
}
