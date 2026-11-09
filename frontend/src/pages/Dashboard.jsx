import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../contexts/AuthContext';
import PrishtinaMap from '../components/PrishtinaMap';
import client from '../api/client';
import { pipelineAPI } from '../api/pipeline';

import KPIRow from '../components/dashboard/KPIRow';
import AIRecommendations from '../components/dashboard/AIRecommendations';
import ResourceCapacity from '../components/dashboard/ResourceCapacity';
import AgeDistribution from '../components/dashboard/AgeDistribution';
import RecentReports from '../components/dashboard/RecentReports';
import ScenarioComparison from '../components/dashboard/ScenarioComparison';
import LiveSimulationPanel from '../components/dashboard/LiveSimulationPanel';

// ═══════════════════════════════════════════════════════════════════
// KONFIGURIMI
// ═══════════════════════════════════════════════════════════════════

const AUTO_REFRESH_MS = 60000; // 1 minutë

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { isAdmin, hasRole } = useAuth();
  const canOperate = hasRole(['admin', 'health_worker']);
  const [summary, setSummary] = useState(null);
  const [simulationSummary, setSimulationSummary] = useState(null);
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [strategyRecommendations, setStrategyRecommendations] = useState(null);
  const [pipelineRecommendation, setPipelineRecommendation] = useState(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { lastEvent, status, eventCount } = useWebSocket();

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const results = await Promise.allSettled([
        client.get('/dashboard/command-center'),
        client.get('/simulation/summary'),
        client.get('/simulation/history', { params: { limit: 30 } }),
        client.get('/simulation/strategy/recommendations'),
        pipelineAPI.getLatestRecommendation(),
      ]);
      const [commandResult, simResult, historyResult, strategyResult, pipelineResult] = results;
      const commandData = commandResult.status === 'fulfilled' ? commandResult.value.data : null;
      const simData = simResult.status === 'fulfilled' ? simResult.value.data : null;
      const histData = historyResult.status === 'fulfilled' ? historyResult.value.data : [];
      const stratData = strategyResult.status === 'fulfilled' ? strategyResult.value.data : null;
      const pipelineData = pipelineResult.status === 'fulfilled' ? pipelineResult.value : null;
      if (results.slice(0, 4).some((result) => result.status === 'rejected')) {
        setError('Disa burime të dashboard-it nuk janë të disponueshme; po shfaqen vetëm të dhënat e arritshme.');
      }

      setSummary(commandData);
      setSimulationSummary(simData);
      setSimulationHistory(Array.isArray(histData) ? histData : []);
      setStrategyRecommendations(stratData?.recommendations ?? null);
      setPipelineRecommendation(pipelineData);
      setLiveSnapshot(commandData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Dashboard-i nuk mund të ngarkohet.');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleLiveSimulation = async () => {
    setOperationLoading(true);
    setError(null);
    try {
      const snapshot = await pipelineAPI.setLive(!liveSnapshot?.running);
      setLiveSnapshot((current) => ({ ...(current || {}), ...snapshot }));
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setOperationLoading(false);
    }
  };

  const applyPipelineRecommendation = async () => {
    const recommendations = pipelineRecommendation?.recommendations || [];
    if (!canOperate || recommendations.length === 0) return;
    if (!window.confirm(`Apliko të gjitha ${recommendations.length} rekomandimet e fundit?`)) return;
    setOperationLoading(true);
    setError(null);
    try {
      await pipelineAPI.applyRecommendations(null, 30);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setOperationLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => { void loadData(); });
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if ([
      'report:created',
      'report:updated',
      'report:deleted',
      'resource:allocated',
      'routing:dispatch',
      'hotspot:updated',
    ].includes(lastEvent?.type)) {
      queueMicrotask(() => { void loadData(); });
    }
  }, [lastEvent, loadData]);

  useEffect(() => {
    if (lastEvent?.type !== 'simulation:update' || !lastEvent.data) return;
    queueMicrotask(() => {
      const { day, simulation_state: state, stats } = lastEvent.data;
      setSimulationSummary((current) => ({
        ...(current || {}),
        status: lastEvent.data.running ? 'running' : 'paused',
        final: {
          ...(current?.final || {}),
          day,
          active: stats?.active ?? 0,
          real_active: stats?.active ?? 0,
          dead: Math.round(state?.dead ?? 0),
          real_deaths: Math.round(state?.dead ?? 0),
        },
      }));
      setLiveSnapshot((current) => ({ ...(current || {}), ...lastEvent.data }));
    });
  }, [lastEvent]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          border: '4px solid #1e2655',
          borderTopColor: '#00d4ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
          Duke ngarkuar dashboard-in...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isLive = status === 'connected';
  const topDistrict = summary?.top_districts?.[0];

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════ */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: '#e8eaf6',
            marginBottom: '0.375rem',
            letterSpacing: '-0.02em',
          }}>
            📊 Dashboard Kryesor
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            Përmbledhje e situatës epidemiologjike ·{' '}
            {new Date().toLocaleDateString('sq-AL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.875rem',
            background: isLive ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 165, 2, 0.1)',
            border: `1px solid ${isLive ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 165, 2, 0.3)'}`,
            borderRadius: '0.5rem',
            fontSize: '0.7rem',
            color: isLive ? '#2ed573' : '#ffa502',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}>
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: isLive ? '#2ed573' : '#ffa502',
              boxShadow: `0 0 8px ${isLive ? '#2ed573' : '#ffa502'}`,
              animation: isLive ? 'pulse 2s infinite' : 'none',
            }} />
            {isLive ? 'LIVE' : status.toUpperCase()}
          </div>

          <button
            onClick={loadData}
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            ↻ Rifresko
          </button>
        </div>
      </header>

      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(255, 165, 2, 0.1)',
          border: '1px solid rgba(255, 165, 2, 0.3)',
          borderRadius: '0.5rem',
          color: '#ffa502',
          fontSize: '0.8rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          KPI ROW
          ═══════════════════════════════════════════════════════════ */}
      <KPIRow
        simulationSummary={simulationSummary}
        simulationHistory={simulationHistory}
      />

      <LiveSimulationPanel
        snapshot={liveSnapshot}
        history={simulationHistory}
        canOperate={canOperate}
        operationLoading={operationLoading}
        onToggleRunning={toggleLiveSimulation}
      />

      <CommandOperations
        recommendation={pipelineRecommendation}
        canOperate={canOperate}
        loading={operationLoading}
        onApply={applyPipelineRecommendation}
      />

      {/* ═══════════════════════════════════════════════════════════
          ROW 2: HARTA + AI
          ═══════════════════════════════════════════════════════════ */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 1fr)',
        gap: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        {/* Harta */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid #1e2655',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#e8eaf6',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              🗺️ Harta e Raporteve — Prishtinë
            </h2>
            <Link
              to="/admin/map"
              style={{
                fontSize: '0.7rem',
                color: '#00d4ff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Shiko detajet →
            </Link>
          </div>

          <div style={{ flex: 1, minHeight: '420px', overflow: 'hidden' }}>
            <PrishtinaMap mode="mini" refreshKey={eventCount} />
          </div>
        </div>

        {/* AI Recommendations */}
        <AIRecommendations
          recommendations={strategyRecommendations}
          topDistrict={topDistrict}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ROW 3: RESOURCES + AGE + REPORTS
          ═══════════════════════════════════════════════════════════ */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <ResourceCapacity data={liveSnapshot?.resources} />
        <AgeDistribution data={liveSnapshot?.age_distribution} />
        <RecentReports />
      </section>

      {/* ═══════════════════════════════════════════════════════════
          ROW 4: SCENARIO COMPARISON
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: '1.5rem' }}>
        <ScenarioComparison scenarios={liveSnapshot?.scenarios} />
      </section>

      {isAdmin && <AuditActivity />}

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════ */}
      <div style={{
        textAlign: 'center',
        fontSize: '0.7rem',
        color: '#6b7280',
        paddingTop: '0.5rem',
      }}>
        Përditësuar: {lastRefresh.toLocaleTimeString('sq-AL')} · Rifreskim automatik çdo {AUTO_REFRESH_MS / 1000}s
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function CommandOperations({ recommendation, canOperate, loading, onApply }) {
  const recommendations = recommendation?.recommendations || [];
  return (
    <section style={{
      background: '#131938',
      border: '1px solid #1e2655',
      borderRadius: '.75rem',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ color: '#e8eaf6', fontSize: '.95rem', margin: 0 }}>🎯 Veprimet e rekomanduara</h2>
          <p style={{ color: '#9ca3af', fontSize: '.72rem', margin: '.35rem 0 0' }}>
            Rekomandimi i fundit nga Pipeline-i, i sinkronizuar me simulimin live.
          </p>
        </div>
        <Link to="/admin/pipeline" style={{ color: '#00d4ff', fontSize: '.7rem', fontWeight: 700, textDecoration: 'none' }}>
          Hap Pipeline-in e plotë →
        </Link>
      </div>
      {recommendations.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '.78rem', margin: '1rem 0 0' }}>
          Nuk ka rekomandim të ruajtur. Gjeneroje nga Pipeline-i.
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <CommandBadge label="Rekomandime" value={recommendations.length} color="#00d4ff" />
            <CommandBadge label="Dita e modelit" value={recommendation.day ?? '—'} color="#a78bfa" />
            <CommandBadge label="Besueshmëria mesatare" value={averageConfidence(recommendations)} color="#2ed573" />
          </div>
          <button
            type="button"
            onClick={onApply}
            disabled={!canOperate || loading}
            title={!canOperate ? 'Vetëm admin ose health worker mund të aplikojë masa.' : undefined}
            style={{
              border: '1px solid rgba(46,213,115,.4)',
              borderRadius: '.45rem',
              background: canOperate ? 'rgba(46,213,115,.12)' : 'rgba(107,114,128,.12)',
              color: canOperate ? '#2ed573' : '#6b7280',
              padding: '.55rem .8rem',
              cursor: canOperate && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: '.75rem',
            }}
          >
            {loading ? 'Duke përpunuar...' : `Apliko ${recommendations.length} masa`}
          </button>
        </div>
      )}
    </section>
  );
}

function CommandBadge({ label, value, color }) {
  return (
    <div style={{ background: '#0a0e27', borderRadius: '.45rem', padding: '.5rem .65rem' }}>
      <div style={{ color: '#6b7280', fontSize: '.6rem', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ color, fontSize: '.9rem', fontWeight: 800, marginTop: '.2rem' }}>{value}</div>
    </div>
  );
}

function averageConfidence(recommendations) {
  const values = recommendations
    .map((item) => Number(item.confidence))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return '—';
  return `${Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100)}%`;
}

function AuditActivity() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const { data } = await client.get('/users/audit-log', { params: { limit: 8 } });
        setEntries(Array.isArray(data) ? data : []);
      } catch (reason) {
        setError(reason.response?.data?.detail || 'Audit-log nuk mund të ngarkohet.');
      }
    });
  }, []);

  return (
    <section style={{
      background: '#131938',
      border: '1px solid #1e2655',
      borderRadius: '.75rem',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#e8eaf6', fontSize: '.95rem' }}>Audit i veprimeve kritike</h2>
          <p style={{ color: '#9ca3af', fontSize: '.75rem', margin: '.3rem 0 0' }}>Vetëm admin-i mund ta shohë këtë historik.</p>
        </div>
        <span style={{ color: '#00d4ff', fontSize: '.75rem' }}>{entries.length} të fundit</span>
      </div>
      {error ? <p role="alert" style={{ color: '#ff7b86', fontSize: '.8rem' }}>{error}</p> : entries.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '.8rem' }}>Nuk ka veprime të regjistruara ende.</p>
      ) : <div style={{ display: 'grid', gap: '.5rem' }}>
        {entries.map((entry) => (
          <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '.55rem 0', borderBottom: '1px solid rgba(30,38,85,.65)' }}>
            <div>
              <strong style={{ color: '#e8eaf6', fontSize: '.78rem' }}>{formatAuditAction(entry.action)}</strong>
              <p style={{ color: '#9ca3af', fontSize: '.7rem', margin: '.2rem 0 0' }}>{entry.resource_type || 'system'} · {entry.resource_id || '—'}</p>
            </div>
            <time dateTime={entry.created_at} style={{ color: '#6b7280', fontSize: '.7rem', whiteSpace: 'nowrap' }}>
              {new Date(entry.created_at).toLocaleString('sq-AL')}
            </time>
          </div>
        ))}
      </div>}
    </section>
  );
}

function formatAuditAction(action) {
  return action
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}