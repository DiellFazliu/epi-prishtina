import { useState, useEffect } from 'react';
import { pipelineAPI } from '../../api/pipeline';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../contexts/AuthContext';

export default function PipelinePage() {
  const { hasRole } = useAuth();
  const canOperate = hasRole(['admin', 'health_worker']);
  const [state, setState] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [bundle, setBundle] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistoryId, setLoadingHistoryId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState({
    state: false,
    refresh: false,
    recommend: false,
    apply: false,
    simulate: false,
  });
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);
  const [liveRunning, setLiveRunning] = useState(false);
  const { lastEvent } = useWebSocket();

  // ═══ HAPI 1: LEXO GJENDJEN ═══
  const loadState = async () => {
    setLoading((l) => ({ ...l, state: true }));
    setError(null);
    try {
      const data = await pipelineAPI.getState();
      setState(data);
      setHotspots(data.hotspots || []);
      setStep((s) => Math.max(s, 1));
    } catch (err) {
      console.error('loadState error:', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading((l) => ({ ...l, state: false }));
    }
  };

  // ═══ HAPI 2: RIFRESKO HOTSPOTS ═══
  const refreshHotspots = async () => {
    setLoading((l) => ({ ...l, refresh: true }));
    setError(null);
    try {
      const data = await pipelineAPI.refreshHotspots();
      setHotspots(data.hotspots || []);
      setStep((s) => Math.max(s, 2));
      await loadState();
    } catch (err) {
      console.error('refreshHotspots error:', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading((l) => ({ ...l, refresh: false }));
    }
  };

  // ═══ HAPI 3: GJENERO REKOMANDIMET ═══
  const generateRecommendations = async () => {
    setLoading((l) => ({ ...l, recommend: true }));
    setError(null);
    try {
      const data = await pipelineAPI.generateRecommendations();
      setBundle(data);
      const recs = data.recommendations || [];
      setSelectedIds(new Set(recs.map((r) => r.id)));
      setStep((s) => Math.max(s, 3));
    } catch (err) {
      console.error('generateRecommendations error:', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading((l) => ({ ...l, recommend: false }));
    }
  };

  // ═══ HAPI 4: APLIKO ═══
  const applyRecommendations = async () => {
    setLoading((l) => ({ ...l, apply: true }));
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      await pipelineAPI.applyRecommendations(ids.length > 0 ? ids : null, 30);
      await loadState();
      await refreshHistory();
      setStep((s) => Math.max(s, 4));
    } catch (err) {
      console.error('applyRecommendations error:', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading((l) => ({ ...l, apply: false }));
    }
  };

  // ═══ HAPI 5: SIMULO PËRPARA ═══
  const simulateForward = async () => {
    setLoading((l) => ({ ...l, simulate: true }));
    setError(null);
    try {
      const data = await pipelineAPI.simulateForward(30);
      setComparison(data);
      setStep((s) => Math.max(s, 5));
    } catch (err) {
      console.error('simulateForward error:', err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading((l) => ({ ...l, simulate: false }));
    }
  };

  const toggleRecommendation = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    queueMicrotask(() => {
      Promise.allSettled([
        loadState(),
        pipelineAPI.getLive(),
        pipelineAPI.getLatestRecommendation(),
        pipelineAPI.getComparison(),
        pipelineAPI.getHistory(),
      ]).then(([stateResult, liveResult, recommendationResult, comparisonResult, historyResult]) => {
        if (liveResult.status === 'fulfilled') {
          setLiveRunning(Boolean(liveResult.value.running));
        }
        if (recommendationResult.status === 'fulfilled') {
          const savedBundle = recommendationResult.value;
          setBundle(savedBundle);
          setSelectedIds(new Set((savedBundle.recommendations || []).map((item) => item.id)));
          setStep((current) => Math.max(current, 3));
        }
        if (comparisonResult.status === 'fulfilled') {
          setComparison(comparisonResult.value);
          setStep((current) => Math.max(current, 5));
        }
        if (historyResult.status === 'fulfilled') {
          setHistory(Array.isArray(historyResult.value) ? historyResult.value : []);
        }
        if (stateResult.status === 'rejected') {
          setError(stateResult.reason?.response?.data?.detail || stateResult.reason?.message);
        }
      });
    });
  }, []);

  useEffect(() => {
    if (lastEvent?.type !== 'simulation:update' || !lastEvent.data) return;
    queueMicrotask(() => {
      const { day, simulation_state: simulationState, active_measures: measures, running } = lastEvent.data;
      setState((current) => current ? {
        ...current,
        day,
        simulation_state: simulationState,
        active_measures: measures || current.active_measures,
        last_updated: lastEvent.timestamp,
      } : current);
      setLiveRunning(Boolean(running));
    });
  }, [lastEvent]);

  const toggleLiveSimulation = async () => {
    try {
      const data = await pipelineAPI.setLive(!liveRunning);
      setLiveRunning(Boolean(data.running));
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const refreshHistory = async () => {
    try {
      const data = await pipelineAPI.getHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const openHistoryRun = async (run) => {
    setLoadingHistoryId(run.id);
    setError(null);
    try {
      const payload = await pipelineAPI.getHistorySnapshot(run.id);
      if (run.type === 'recommendation') {
        setBundle(payload);
        setSelectedIds(new Set((payload.recommendations || []).map((item) => item.id)));
        setStep(3);
      } else {
        setComparison(payload);
        setStep(5);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoadingHistoryId(null);
    }
  };

  // ═══ HELPERS ═══
  const sim = state?.simulation_state || {};
  const active = (sim.exposed || 0) + (sim.infectious_mild || 0) + (sim.infectious_severe || 0);
  const rt = sim.population
    ? (0.32 * 7 * (sim.susceptible || 0) / sim.population).toFixed(2)
    : '0.00';

  return (
    <div style={{ maxWidth: '1400px' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: 800,
              color: '#e8eaf6',
              marginBottom: '0.375rem',
              letterSpacing: '-0.02em',
            }}>
              🧠 Pipeline i Vendimmarrjes
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Nga raportet live → analiza ML → rekomandimet → aplikimi → krahasimi
            </p>
          </div>
          {canOperate && <button
            type="button"
            onClick={toggleLiveSimulation}
            style={{
              padding: '.65rem .9rem',
              borderRadius: '.5rem',
              border: `1px solid ${liveRunning ? '#2ed573' : '#ffa502'}`,
              background: liveRunning ? 'rgba(46,213,115,.12)' : 'rgba(255,165,2,.12)',
              color: liveRunning ? '#2ed573' : '#ffa502',
              cursor: 'pointer',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {liveRunning ? 'Pauzo simulimin' : 'Nis simulimin'}
          </button>}
        </div>
      </header>

      {error && (
        <div style={{
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          color: '#ff4757',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
        }}>
          ⚠ {error}
        </div>
      )}

      <PipelineHistory
        history={history}
        onRefresh={refreshHistory}
        onOpen={openHistoryRun}
        loadingHistoryId={loadingHistoryId}
      />

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* HAPI 1 */}
        <StepCard
          number={1}
          title="Gjendja Aktuale"
          description="Lexo gjendjen e sistemit nga simulimi, raportet dhe hotspot-et"
          active={step === 1}
          done={step > 1}
          loading={loading.state}
          onAction={loadState}
          actionLabel="🔄 Rifresko Gjendjen"
        >
          {state && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              marginTop: '1rem',
            }}>
              <StatBox label="Dita" value={state.day || 0} color="#00d4ff" />
              <StatBox label="Aktivë" value={active} color="#ffa502" />
              <StatBox label="R(t)" value={rt} color="#7b2ff7" />
              <StatBox label="Vdekje" value={Math.round(sim.dead || 0)} color="#ff4757" />
            </div>
          )}
        </StepCard>

        {/* HAPI 2 */}
        <StepCard
          number={2}
          title="Analiza ML e Hotspot-eve"
          description="Trajno modelin XGBoost dhe parashiko zonat e rrezikut"
          active={step === 2}
          done={step > 2}
          loading={loading.refresh}
          onAction={canOperate ? refreshHotspots : undefined}
          actionLabel="🔮 Rifresko Hotspots"
          disabled={!canOperate}
        >
          {hotspots.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
                Top 5 Hotspots
              </p>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {hotspots.slice(0, 5).map((h) => {
                  const prob = h.hotspot_probability || 0;
                  return (
                    <div
                      key={h.district}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.625rem 0.875rem',
                        background: '#0a0e27',
                        border: `1px solid ${prob > 0.7 ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 165, 2, 0.3)'}`,
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ color: '#e8eaf6', fontWeight: 600 }}>
                        {h.district}
                      </span>
                      <span style={{
                        color: prob > 0.7 ? '#ff4757' : '#ffa502',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                      }}>
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </StepCard>

        {/* HAPI 3 */}
        <StepCard
          number={3}
          title="Rekomandimet"
          description="Gjenero masat, burimet dhe rrugët e optimizuara"
          active={step === 3}
          done={step > 3}
          loading={loading.recommend}
          onAction={canOperate ? generateRecommendations : undefined}
          actionLabel="💡 Gjenero Rekomandimet"
          disabled={!canOperate}
        >
          {bundle && bundle.recommendations && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                marginBottom: '1rem',
                padding: '0.875rem',
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: '0.5rem',
              }}>
                <ImpactBox
                  label="Raste të shmangura"
                  value={(bundle.total_expected_impact?.cases_avoided || 0).toLocaleString()}
                  color="#2ed573"
                />
                <ImpactBox
                  label="Vdekje të shmangura"
                  value={(bundle.total_expected_impact?.deaths_avoided || 0).toLocaleString()}
                  color="#2ed573"
                />
                <ImpactBox
                  label="Kosto totale"
                  value={(bundle.total_expected_impact?.total_cost || 0).toFixed(2)}
                  color="#ffa502"
                />
              </div>

              {bundle.recommendations.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                  Nuk ka rekomandime aktualisht.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {bundle.recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      selected={selectedIds.has(rec.id)}
                      onToggle={() => toggleRecommendation(rec.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </StepCard>

        {/* HAPI 4 */}
        <StepCard
          number={4}
          title="Apliko Rekomandimet"
          description="Zgjidh rekomandimet dhe apliko ato në sistem"
          active={step === 4}
          done={step > 4}
          loading={loading.apply}
          onAction={canOperate ? applyRecommendations : undefined}
          actionLabel={`✅ Apliko ${selectedIds.size} të Zgjedhura`}
          disabled={!canOperate || step < 3 || selectedIds.size === 0}
        >
          {step >= 4 && (
            <p style={{
              marginTop: '1rem',
              color: '#2ed573',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}>
              ✓ Rekomandimet u aplikuan
            </p>
          )}
        </StepCard>

        {/* HAPI 5 */}
        <StepCard
          number={5}
          title="Krahasimi Para/Pas"
          description="Simulo 30 ditë përpara dhe shiko efektin e masave"
          active={step === 5}
          done={step > 5}
          loading={loading.simulate}
          onAction={simulateForward}
          actionLabel="📊 Simulo 30 Ditë Përpara"
          disabled={step < 4}
        >
          {comparison && comparison.comparison && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}>
                <ComparisonBox
                  label="Raste të shmangura"
                  value={(comparison.comparison.cases_avoided || 0).toLocaleString()}
                />
                <ComparisonBox
                  label="Vdekje të shmangura"
                  value={(comparison.comparison.deaths_avoided || 0).toLocaleString()}
                />
                <ComparisonBox
                  label="Reduktim piku"
                  value={(comparison.comparison.peak_reduction || 0).toLocaleString()}
                />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginTop: '1rem',
              }}>
                <ForecastCard
                  title="Pa Masa (Baseline)"
                  color="#ff4757"
                  forecast={comparison.baseline || {}}
                />
                <ForecastCard
                  title="Me Masa"
                  color="#2ed573"
                  forecast={comparison.with_measures || {}}
                />
              </div>
            </div>
          )}
        </StepCard>
      </div>
    </div>
  );
}

function PipelineHistory({ history, onRefresh, onOpen, loadingHistoryId }) {
  return (
    <section style={{
      background: '#131938',
      border: '1px solid #1e2655',
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#e8eaf6', fontSize: '0.95rem', marginBottom: '.25rem' }}>Historiku i Pipeline-it</h2>
          <p style={{ color: '#9ca3af', fontSize: '.75rem' }}>Run-et e ruajtura në PostgreSQL</p>
        </div>
        <button type="button" onClick={onRefresh} style={historyButtonStyle}>Rifresko</button>
      </div>
      {history.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '.8rem', marginTop: '1rem' }}>Ende nuk ka run-e të ruajtura.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
            <thead><tr>{['Lloji', 'Dita', 'Koha', 'Rekomandime', 'Raste të shmangura', 'Vdekje të shmangura', 'Aplikimi', 'Veprim'].map((heading) => <th key={heading} style={historyThStyle}>{heading}</th>)}</tr></thead>
            <tbody>{history.map((run) => (
              <tr key={run.id}>
                <td style={historyTdStyle}><span style={{ color: run.type === 'recommendation' ? '#00d4ff' : '#2ed573', fontWeight: 700 }}>{run.type === 'recommendation' ? 'Rekomandim' : 'Comparison'}</span></td>
                <td style={historyTdStyle}>{run.pipeline_day}</td>
                <td style={historyTdStyle}>{new Date(run.created_at).toLocaleString('sq-AL')}</td>
                <td style={historyTdStyle}>{run.recommendation_count}</td>
                <td style={historyTdStyle}>{Number(run.cases_avoided || 0).toLocaleString()}</td>
                <td style={historyTdStyle}>{Number(run.deaths_avoided || 0).toLocaleString()}</td>
                <td style={historyTdStyle}>
                  {run.application ? (
                    <div>
                      <span style={{ color: '#2ed573', fontWeight: 700 }}>Aplikuar</span>
                      <div style={{ color: '#9ca3af', fontSize: '.68rem', marginTop: '.2rem' }}>
                        {run.application.resource_allocation_count || 0} alok. · {run.application.dispatch_count || 0} dispatch
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>Pa aplikuar</span>
                  )}
                </td>
                <td style={historyTdStyle}>
                  <button
                    type="button"
                    onClick={() => onOpen(run)}
                    disabled={loadingHistoryId === run.id}
                    style={historyOpenButtonStyle}
                  >
                    {loadingHistoryId === run.id ? 'Duke hapur…' : 'Hap'}
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const historyButtonStyle = {
  border: '1px solid #1e2655',
  borderRadius: '.4rem',
  background: '#0a0e27',
  color: '#00d4ff',
  padding: '.45rem .7rem',
  cursor: 'pointer',
};

const historyThStyle = {
  textAlign: 'left',
  color: '#6b7280',
  padding: '.5rem',
  borderBottom: '1px solid #1e2655',
  whiteSpace: 'nowrap',
};

const historyTdStyle = {
  color: '#d1d5db',
  padding: '.6rem .5rem',
  borderBottom: '1px solid rgba(30,38,85,.5)',
  whiteSpace: 'nowrap',
};

const historyOpenButtonStyle = {
  border: '1px solid rgba(0,212,255,.35)',
  borderRadius: '.35rem',
  background: 'rgba(0,212,255,.08)',
  color: '#00d4ff',
  padding: '.35rem .6rem',
  cursor: 'pointer',
  fontSize: '.72rem',
};

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function StepCard({
  number,
  title,
  description,
  active,
  done,
  loading,
  onAction,
  actionLabel,
  disabled,
  children,
}) {
  return (
    <div style={{
      background: '#131938',
      border: `1px solid ${active ? 'rgba(0, 212, 255, 0.4)' : done ? 'rgba(46, 213, 115, 0.3)' : '#1e2655'}`,
      borderLeft: `3px solid ${done ? '#2ed573' : active ? '#00d4ff' : '#1e2655'}`,
      borderRadius: '0.75rem',
      padding: '1.25rem',
      transition: 'all 0.3s',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        marginBottom: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: done ? '#2ed573' : active ? '#00d4ff' : '#1e2655',
            color: done || active ? '#0a0e27' : '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
            flexShrink: 0,
          }}>
            {done ? '✓' : number}
          </div>
          <div>
            <h2 style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#e8eaf6',
              marginBottom: '0.125rem',
            }}>
              {title}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              {description}
            </p>
          </div>
        </div>

        <button
          onClick={onAction}
          disabled={disabled || loading}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: disabled
              ? '#1e2655'
              : 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            color: disabled ? '#6b7280' : 'white',
            border: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: disabled || loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {loading ? '⏳ Duke procesuar...' : actionLabel}
        </button>
      </div>

      {children}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: '#0a0e27',
      border: '1px solid #1e2655',
      borderRadius: '0.5rem',
      padding: '0.75rem',
    }}>
      <p style={{
        fontSize: '0.65rem',
        color: '#9ca3af',
        textTransform: 'uppercase',
        fontWeight: 700,
        letterSpacing: '0.05em',
        marginBottom: '0.25rem',
      }}>{label}</p>
      <p style={{ fontSize: '1.25rem', fontWeight: 800, color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function ImpactBox({ label, value, color }) {
  return (
    <div>
      <p style={{
        fontSize: '0.65rem',
        color: '#9ca3af',
        textTransform: 'uppercase',
        fontWeight: 700,
        letterSpacing: '0.05em',
        marginBottom: '0.25rem',
      }}>{label}</p>
      <p style={{ fontSize: '1.125rem', fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

function RecommendationCard({ rec, selected, onToggle }) {
  const categoryColors = {
    measure: '#00d4ff',
    resource: '#7b2ff7',
    routing: '#ffa502',
  };
  const color = categoryColors[rec.category] || '#9ca3af';
  const impact = rec.expected_impact || {};

  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        gap: '0.75rem',
        padding: '0.875rem',
        background: selected ? 'rgba(0, 212, 255, 0.08)' : '#0a0e27',
        border: `1px solid ${selected ? 'rgba(0, 212, 255, 0.4)' : '#1e2655'}`,
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        style={{ marginTop: '0.25rem', cursor: 'pointer' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.25rem',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#e8eaf6' }}>
            {rec.title}
          </span>
          <span style={{
            fontSize: '0.65rem',
            padding: '0.125rem 0.5rem',
            borderRadius: '0.25rem',
            background: `${color}20`,
            color,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>{rec.category}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
          {rec.description}
        </p>
        <div style={{
          display: 'flex',
          gap: '0.875rem',
          fontSize: '0.7rem',
          color: '#6b7280',
          flexWrap: 'wrap',
        }}>
          {(impact.cases_avoided || 0) > 0 && (
            <span>Raste: <strong style={{ color: '#2ed573' }}>
              {(impact.cases_avoided || 0).toLocaleString()}
            </strong></span>
          )}
          {(impact.deaths_avoided || 0) > 0 && (
            <span>Vdekje: <strong style={{ color: '#2ed573' }}>
              {(impact.deaths_avoided || 0).toLocaleString()}
            </strong></span>
          )}
          <span>Kosto: <strong style={{ color: '#ffa502' }}>
            {(impact.cost || 0).toFixed(2)}
          </strong></span>
          <span>Besueshmëria: <strong style={{ color: '#00d4ff' }}>
            {((rec.confidence || 0) * 100).toFixed(0)}%
          </strong></span>
        </div>
      </div>
    </div>
  );
}

function ComparisonBox({ label, value }) {
  return (
    <div style={{
      padding: '0.875rem',
      background: 'rgba(46, 213, 115, 0.05)',
      border: '1px solid rgba(46, 213, 115, 0.2)',
      borderRadius: '0.5rem',
      textAlign: 'center',
    }}>
      <p style={{
        fontSize: '0.65rem',
        color: '#9ca3af',
        textTransform: 'uppercase',
        fontWeight: 700,
        letterSpacing: '0.05em',
        marginBottom: '0.25rem',
      }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2ed573' }}>{value}</p>
    </div>
  );
}

function ForecastCard({ title, color, forecast }) {
  const data = forecast || {};
  return (
    <div style={{
      padding: '1rem',
      background: '#0a0e27',
      border: `1px solid ${color}40`,
      borderRadius: '0.5rem',
    }}>
      <p style={{
        fontSize: '0.75rem',
        color,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.75rem',
      }}>{title}</p>
      <div style={{ display: 'grid', gap: '0.375rem', fontSize: '0.8rem' }}>
        <Row label="Raste të reja" value={(data.new_cases || 0).toLocaleString()} />
        <Row label="Piku aktiv" value={(data.peak_active || 0).toLocaleString()} />
        <Row label="Vdekje totale" value={(data.deaths_at_end || 0).toLocaleString()} />
        <Row label="R(t) fundit" value={(data.rt_at_end || 0).toFixed(2)} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ color: '#e8eaf6', fontWeight: 600 }}>{value}</span>
    </div>
  );
}