import { useState, useEffect, useCallback } from 'react';
import PrishtinaMap from '../../components/PrishtinaMap';
import { useWebSocket } from '../../hooks/useWebSocket';
import client from '../../api/client';

export default function MapPage() {
  const { status, lastEvent, eventCount } = useWebSocket();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [{ data: summary }, { data: districts }] = await Promise.all([
        client.get('/map/summary'),
        client.get('/map/districts'),
      ]);
      setStats({
        ...summary,
        critical_districts: districts.filter((d) => d.severity === 'critical').length,
      });
      setStatsError(false);
    } catch {
      setStatsError(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void loadStats(); });
  }, [loadStats]);

  useEffect(() => {
    if ([
      'report:created',
      'report:updated',
      'report:deleted',
      'simulation:update',
      'hotspot:updated',
      'resource:allocated',
      'routing:dispatch',
    ].includes(lastEvent?.type)) {
      queueMicrotask(() => { void loadStats(); });
    }
  }, [lastEvent, loadStats]);

  const live = status === 'connected';

  return (
    <div>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#e8eaf6',
            marginBottom: '0.375rem',
            letterSpacing: '-0.02em',
          }}>
            🗺️ Harta e Raporteve — Prishtinë
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Raporte të qytetarëve sipas lagjes · të verifikuara dhe në pritje
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.5rem',
          padding: '.5rem .875rem',
          background: live ? 'rgba(46,213,115,.1)' : 'rgba(255,165,2,.1)',
          border: `1px solid ${live ? 'rgba(46,213,115,.3)' : 'rgba(255,165,2,.3)'}`,
          borderRadius: '.5rem',
          fontSize: '.7rem',
          fontWeight: 700,
          letterSpacing: '.05em',
          color: live ? '#2ed573' : '#ffa502',
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: live ? '#2ed573' : '#ffa502',
            boxShadow: `0 0 8px ${live ? '#2ed573' : '#ffa502'}`,
          }} />
          {live ? 'LIVE' : status.toUpperCase()}
        </div>
      </header>

      {statsError && (
        <p role="status" style={{ color: '#ffa502', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          Statistikat nuk mund të rifreskohen. Harta vazhdon të shfaqet me të dhënat e disponueshme.
        </p>
      )}

      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        <StatPill icon="📊" label="Raporte · 7 ditët e fundit" value={stats?.total_reports?.toLocaleString() ?? '—'} color="#00d4ff" />
        <StatPill icon="✓" label="Raporte të verifikuara" value={stats?.total_validated?.toLocaleString() ?? '—'} color="#2ed573" />
        <StatPill icon="⏳" label="Në pritje" value={stats?.total_pending?.toLocaleString() ?? '—'} color="#ffa502" />
        <StatPill icon="📍" label="Zona me rrezik kritik" value={stats?.critical_districts ?? '—'} color="#ff4757" />
      </section>

      <div style={{
        height: 'min(76vh, 900px)',
        minHeight: '520px',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #1e2655',
        borderRadius: '.75rem',
        background: '#131938',
      }}>
        <PrishtinaMap mode="full" refreshKey={eventCount} />
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, color }) {
  return (
    <div style={{
      background: '#131938',
      border: '1px solid #1e2655',
      borderRadius: '.625rem',
      padding: '.75rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '.75rem',
      minWidth: 0,
    }}>
      <div style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: '.5rem',
        background: `${color}15`,
        border: `1px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontSize: '.65rem',
          color: '#9ca3af',
          textTransform: 'uppercase',
          fontWeight: 700,
          letterSpacing: '.05em',
          marginBottom: '.125rem',
        }}>{label}</p>
        <p style={{ fontSize: '1.125rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      </div>
    </div>
  );
}