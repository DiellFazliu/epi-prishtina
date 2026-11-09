import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AnalyticsPage from './AnalyticsPage';
import PredictionsPage from './PredictionsPage';
import RLEmergencyPage from './RLEmergencyPage';
import client from '../../api/client';
import { reportsAPI } from '../../api/reports';
import { useWebSocket } from '../../hooks/useWebSocket';

const tabs = [
  { id: 'overview', label: 'Pamja e inteligjencës', component: IntelligenceOverview },
  { id: 'analytics', label: 'Trendet', component: AnalyticsPage },
  { id: 'predictions', label: 'Parashikimet ML', component: PredictionsPage },
  { id: 'rl', label: 'AI emergjencash', component: RLEmergencyPage },
];

export default function IntelligenceHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(
    () => tabs.some((tab) => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview',
    [searchParams],
  );
  const ActivePage = tabs.find((tab) => tab.id === activeTab).component;

  return (
    <div>
      <HubHeader
        title="Analiza & ML"
        description="Krahaso sinjalet reale me parashikimet, trendet dhe performancën e modeleve."
      />
      <HubTabs tabs={tabs} activeTab={activeTab} onChange={(tab) => setSearchParams({ tab })} />
      <ActivePage />
    </div>
  );
}

function IntelligenceOverview() {
  const navigate = useNavigate();
  const { lastEvent } = useWebSocket();
  const [predictions, setPredictions] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [predictionsResponse, statsResponse, historyResponse] = await Promise.all([
        client.get('/hotspots'),
        reportsAPI.getStatistics(),
        client.get('/simulation/history', { params: { limit: 30 } }),
      ]);
      setPredictions(Array.isArray(predictionsResponse.data) ? predictionsResponse.data : []);
      setReportStats(statsResponse);
      setHistory(Array.isArray(historyResponse.data) ? historyResponse.data : []);
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Të dhënat analitike nuk mund të ngarkohen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  useEffect(() => {
    if (['report:created', 'report:updated', 'report:deleted', 'hotspot:updated', 'simulation:update'].includes(lastEvent?.type)) {
      queueMicrotask(load);
    }
  }, [lastEvent, load]);

  if (loading) return <p role="status" style={{ color: '#9ca3af' }}>Duke ngarkuar sinjalet dhe modelet…</p>;

  const sortedPredictions = [...predictions].sort((a, b) => b.probability - a.probability);
  const critical = predictions.filter((item) => ['critical', 'CRITICAL'].includes(item.risk_level)).length;
  const high = predictions.filter((item) => ['high', 'HIGH'].includes(item.risk_level)).length;
  const latest = history[history.length - 1] || {};

  return (
    <main>
      {error && <p role="alert" style={styles.error}>{error}</p>}
      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.sectionTitle}>Sinjalet që mund të përdoren për vendim</h2>
          <p style={styles.muted}>Raportet janë të vëzhguara; hotspot-et janë probabilitete modelore dhe nuk janë matje klinike.</p>
        </div>
        <button type="button" onClick={load} style={styles.secondaryButton}>Rifresko</button>
      </div>

      <section style={styles.cardGrid}>
        <Metric label="Raporte gjithsej" value={reportStats?.total ?? 0} detail={`${reportStats?.confirmed ?? 0} të konfirmuara`} color="#00d4ff" />
        <Metric label="Lagje të parashikuara" value={predictions.length} detail="nga modeli ML" color="#7b2ff7" />
        <Metric label="Rrezik kritik" value={critical} detail={`${high} me rrezik të lartë`} color="#ff4757" />
        <Metric label="Dita e modelit" value={latest.day ?? '—'} detail={`R(t): ${latest.rt ?? '—'}`} color="#2ed573" />
      </section>

      <div style={styles.grid}>
        <section style={styles.panel}>
          <PanelHeader title="Hotspot-et me prioritet" actionLabel="Hap parashikimet" onAction={() => navigate('/admin/intelligence?tab=predictions')} />
          {sortedPredictions.length === 0 ? <Empty text="Nuk ka parashikime të disponueshme." /> : (
            <div>{sortedPredictions.slice(0, 6).map((item) => {
              const probability = Number(item.probability || 0);
              const color = probability >= .8 ? '#ff4757' : probability >= .6 ? '#ffa502' : '#2ed573';
              return <div key={item.district} style={styles.row}>
                <div>
                  <strong style={styles.primary}>{item.district}</strong>
                  <p style={styles.muted}>Raporte live: {item.observed_reports_7d || 0} · Validuara: {item.observed_validated_7d || 0}</p>
                </div>
                <span style={styles.badge(color)}>{(probability * 100).toFixed(1)}%</span>
              </div>;
            })}</div>
          )}
        </section>

        <section style={styles.panel}>
          <PanelHeader title="Si po sillet modeli" actionLabel="Hap trendet" onAction={() => navigate('/admin/intelligence?tab=analytics')} />
          <div style={styles.stats}>
            <Stat label="Raste aktive" value={latest.real_active ?? latest.active ?? 0} />
            <Stat label="R(t)" value={latest.rt ?? '—'} />
            <Stat label="Vdekje" value={latest.real_deaths ?? latest.dead ?? 0} />
            <Stat label="Besueshmëria raporteve" value={`${((reportStats?.avg_reliability || 0) * 100).toFixed(0)}%`} />
          </div>
          <p style={styles.disclaimer}>Përdor trendet për kontekst; probabiliteti ML dhe raportet reale duhet të shqyrtohen bashkë.</p>
        </section>
      </div>

      <section style={styles.panel}>
        <PanelHeader title="Burimi i vendimit" />
        <div style={styles.sourceGrid}>
          <Source title="Raporte qytetarësh" text="Sinjale të ruajtura në databazë, me status dhe besueshmëri." />
          <Source title="Modeli ML" text="Probabilitete hotspot-esh nga parashikimet e fundit të modelit." />
          <Source title="Simulimi SEIR" text="Projeksion i gjendjes epidemiologjike dhe R(t) sipas ditëve." />
        </div>
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

function Metric({ label, value, detail, color }) {
  return <article style={styles.metric}><span style={{ color, fontSize: '1.4rem', fontWeight: 800 }}>{value}</span><strong style={styles.primary}>{label}</strong><small style={styles.muted}>{detail}</small></article>;
}

function Stat({ label, value }) {
  return <div style={styles.stat}><span style={styles.muted}>{label}</span><strong style={styles.primary}>{typeof value === 'number' ? value.toLocaleString() : value}</strong></div>;
}

function Source({ title, text }) {
  return <div style={styles.source}><strong style={styles.primary}>{title}</strong><p style={styles.muted}>{text}</p></div>;
}

function Empty({ text }) {
  return <p style={styles.muted}>{text}</p>;
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
  secondaryButton: { background: '#1b2550', border: '1px solid #34417d', color: '#dbeafe', borderRadius: '.4rem', padding: '.45rem .7rem', cursor: 'pointer', fontWeight: 600 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', marginBottom: '1.25rem' },
  metric: { background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.25rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1.25rem' },
  panel: { background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem', marginBottom: '1.25rem' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', paddingBottom: '.75rem', borderBottom: '1px solid #1e2655', marginBottom: '.75rem' },
  linkButton: { background: 'none', border: 0, color: '#00d4ff', cursor: 'pointer', fontSize: '.78rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '.7rem 0', borderBottom: '1px solid rgba(30,38,85,.65)' },
  badge: (color) => ({ color, background: `${color}22`, borderRadius: '.3rem', padding: '.25rem .45rem', fontSize: '.7rem', whiteSpace: 'nowrap' }),
  stats: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '.65rem' },
  stat: { background: '#0a0e27', borderRadius: '.45rem', padding: '.65rem', display: 'flex', flexDirection: 'column', gap: '.25rem' },
  sourceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '.75rem' },
  source: { background: '#0a0e27', borderRadius: '.45rem', padding: '.75rem' },
  disclaimer: { color: '#ffa502', fontSize: '.72rem', margin: '.9rem 0 0' },
};
