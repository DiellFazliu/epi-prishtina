import { useWebSocket } from '../hooks/useWebSocket';

export default function WebSocketStatus() {
  const { status, eventCount } = useWebSocket();
  const statusConfig = {
    connected: { color: '#2ed573', label: 'Live' },
    connecting: { color: '#ffa502', label: 'Lidhje...' },
    disconnected: { color: '#ff4757', label: 'Shkëputur' },
    error: { color: '#ff4757', label: 'Gabim' },
  };
  const config = statusConfig[status] || statusConfig.disconnected;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem 0.75rem', background: '#0a0e27', borderRadius: '0.5rem' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.color, boxShadow: `0 0 8px ${config.color}`, animation: status === 'connected' ? 'pulse 2s infinite' : 'none' }} />
      <span>{config.label}</span>
      {eventCount > 0 && <span style={{ marginLeft: 'auto', background: 'rgba(0, 212, 255, 0.2)', color: '#00d4ff', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: '600' }}>{eventCount}</span>}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}
