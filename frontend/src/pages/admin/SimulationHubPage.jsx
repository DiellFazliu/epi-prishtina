import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PipelinePage from './PipelinePage';
import StrategyPage from './StrategyPage';
import client from '../../api/client';
import { pipelineAPI } from '../../api/pipeline';
import { useWebSocket } from '../../hooks/useWebSocket';
import LiveSimulationPanel from '../../components/dashboard/LiveSimulationPanel';

const tabs = [
  { id: 'overview', label: 'Pamja e simulimit', component: SimulationOverview },
  { id: 'pipeline', label: 'Pipeline AI', component: PipelinePage },
  { id: 'strategy', label: 'Masa & skenarë', component: StrategyPage },
];

export default function SimulationHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(
    () => tabs.some((tab) => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview',
    [searchParams],
  );
  const ActivePage = tabs.find((tab) => tab.id === activeTab).component;

  return (
    <div>
      <HubHeader
        title="Simulim & AI"
        description="Monitoro modelin epidemiologjik live dhe apliko masa që ndikojnë drejtpërdrejt në projeksion."
      />
      <HubTabs tabs={tabs} activeTab={activeTab} onChange={(tab) => setSearchParams({ tab })} />
      <ActivePage />
    </div>
  );
}

function SimulationOverview() {
  const navigate = useNavigate();
  const { lastEvent } = useWebSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [strategy, setStrategy] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [liveResponse, historyResponse, strategyResponse, recommendationsResponse] = await Promise.all([
        pipelineAPI.getLive(),
        client.get('/simulation/history', { params: { limit: 30 } }),
        client.get('/simulation/strategy/status'),
        client.get('/simulation/strategy/recommendations', { params: { days: 30 } }),
      ]);
      setSnapshot(liveResponse);
      setRunning(Boolean(liveResponse.running));
      setHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      setStrategy(strategyResponse.data);
      setRecommendations(recommendationsResponse.data);
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Gjendja e simulimit nuk mund të ngarkohet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  useEffect(() => {
    if (lastEvent?.type !== 'simulation:update' || !lastEvent.data) return;
    queueMicrotask(() => {
      setSnapshot((current) => ({ ...(current || {}), ...lastEvent.data }));
      setRunning(Boolean(lastEvent.data.running));
      load();
    });
  }, [lastEvent, load]);

  const toggleSimulation = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await pipelineAPI.setLive(!running);
      setRunning(Boolean(data.running));
      setSnapshot((current) => ({ ...(current || {}), ...data }));
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Simulimi nuk mund të ndryshohet.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p role="status" style={{ color: '#9ca3af' }}>Duke ngarkuar modelin epidemiologjik…</p>;

  const activeMeasures = snapshot?.active_measures || strategy?.measures || [];
  const topRecommendation = recommendations?.recommendations?.[0];
  const state = snapshot?.simulation_state || {};

  return (
    <main>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.sectionTitle}>Kontrolli i modelit</h2>
          <p style={styles.muted}>Përditësuar nga tick-u live dhe historiku i ruajtur në databazë.</p>
        </div>
        <button type="button" disabled={busy} onClick={toggleSimulation} style={{ ...styles.toggle, ...(running ? styles.pause : styles.start) }}>
          {busy ? '…' : running ? 'Pauzo simulimin' : 'Nis simulimin'}
        </button>
      </div>

      <LiveSimulationPanel snapshot={{ ...snapshot, running }} history={history} />

      <section style={styles.grid}>
        <article style={styles.panel}>
          <PanelHeader title="Gjendja e modelit" />
          <div style={styles.stats}>
            <Stat label="Të ndjeshëm" value={state.susceptible} />
            <Stat label="Ekspozuar" value={state.exposed} />
            <Stat label="Infektivë" value={(state.infectious_mild || 0) + (state.infectious_severe || 0)} />
            <Stat label="Të rikuperuar" value={state.recovered} />
          </div>
        </article>
        <article style={styles.panel}>
          <PanelHeader title="Masat aktive" actionLabel="Menaxho masat" onAction={() => navigate('/admin/simulation?tab=strategy')} />
          {activeMeasures.length === 0 ? (
            <p style={styles.muted}>Nuk ka masa aktive në këtë moment.</p>
          ) : (
            <div>{activeMeasures.map((measure, index) => (
              <div key={measure.type || measure.id || index} style={styles.listRow}>
                <span style={styles.primary}>{measure.type || measure.title}</span>
                <span style={styles.badge('#2ed573')}>aktive</span>
              </div>
            ))}</div>
          )}
        </article>
      </section>

      <section style={styles.panel}>
        <PanelHeader title="Rekomandimi i radhës nga modeli" actionLabel="Hap pipeline-in" onAction={() => navigate('/admin/simulation?tab=pipeline')} />
        {topRecommendation ? (
          <div style={styles.recommendation}>
            <div>
              <strong style={styles.primary}>{topRecommendation.type}</strong>
              <p style={styles.muted}>{Number(topRecommendation.estimated_additional_cases_avoided || 0).toLocaleString()} raste më pak të vlerësuara në 30 ditë.</p>
            </div>
            <span style={styles.badge('#00d4ff')}>{recommendations.model || 'model'}</span>
          </div>
        ) : (
          <p style={styles.muted}>Modeli nuk ka rekomandim shtesë me ndikim pozitiv për momentin.</p>
        )}
        {recommendations?.disclaimer && <p style={styles.disclaimer}>{recommendations.disclaimer}</p>}
      </section>
    </main>
  );
}

function HubHeader({ title, description }) {
  return <header style={{ marginBottom: '1.25rem' }}><h1 style={styles.title}>{title}</h1><p style={styles.muted}>{description}</p></header>;
}

function HubTabs({ tabs, activeTab, onChange }) {
  return <div style={styles.tabs}>{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => onChange(tab.id)} style={{ ...styles.tab, ...(activeTab === tab.id ? styles.activeTab : {}) }}>{tab.label}</button>)}</div>;
}

function PanelHeader({ title, actionLabel, onAction }) {
  return <div style={styles.panelHeader}><h2 style={styles.sectionTitle}>{title}</h2>{actionLabel && <button type="button" onClick={onAction} style={styles.linkButton}>{actionLabel}</button>}</div>;
}

function Stat({ label, value }) {
  return <div style={styles.stat}><span style={styles.muted}>{label}</span><strong style={styles.primary}>{Number(value || 0).toLocaleString()}</strong></div>;
}

const styles = {
  title: { margin: 0, color: '#f3f4f6', fontSize: '1.65rem' },
  sectionTitle: { margin: 0, color: '#e8eaf6', fontSize: '1rem' },
  muted: { margin: '.3rem 0 0', color: '#9ca3af', fontSize: '.8rem' },
  primary: { color: '#e8eaf6', fontSize: '.88rem' },
  error: { color: '#ff7b86', marginBottom: '1rem' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  tabs: { display: 'flex', gap: '.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #1e2655', paddingBottom: '.75rem', overflowX: 'auto' },
  tab: { padding: '.55rem .9rem', borderRadius: '.45rem', border: '1px solid #1e2655', background: '#131938', color: '#9ca3af', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  activeTab: { borderColor: '#00d4ff', background: 'rgba(0,212,255,.12)', color: '#00d4ff' },
  toggle: { borderRadius: '.45rem', padding: '.6rem .85rem', cursor: 'pointer', fontWeight: 700 },
  pause: { border: '1px solid #2ed573', color: '#2ed573', background: 'rgba(46,213,115,.12)' },
  start: { border: '1px solid #ffa502', color: '#ffa502', background: 'rgba(255,165,2,.12)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1.25rem' },
  panel: { background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem', marginBottom: '1.25rem' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', paddingBottom: '.75rem', borderBottom: '1px solid #1e2655', marginBottom: '.75rem' },
  linkButton: { background: 'none', border: 0, color: '#00d4ff', cursor: 'pointer', fontSize: '.78rem' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '.65rem' },
  stat: { background: '#0a0e27', borderRadius: '.45rem', padding: '.65rem', display: 'flex', flexDirection: 'column', gap: '.25rem' },
  listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', padding: '.55rem 0', borderBottom: '1px solid rgba(30,38,85,.65)' },
  recommendation: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' },
  badge: (color) => ({ color, background: `${color}22`, borderRadius: '.3rem', padding: '.25rem .45rem', fontSize: '.7rem', whiteSpace: 'nowrap' }),
  disclaimer: { color: '#ffa502', fontSize: '.72rem', margin: '.8rem 0 0' },
};
