import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../../api/client';
import { reportsAPI } from '../../api/reports';
import { useWebSocket } from '../../hooks/useWebSocket';
import Reports from '../Reports';
import ResourcesPage from './ResourcesPage';
import RoutingPage from './RoutingPage';

const tabs = [
  { id: 'overview', label: 'Pamja operative', component: OperationsOverview },
  { id: 'reports', label: 'Raportet', component: Reports },
  { id: 'resources', label: 'Burimet', component: ResourcesPage },
  { id: 'routing', label: 'Dispatch', component: RoutingPage },
];

export default function OperationsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(
    () => tabs.some((tab) => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview',
    [searchParams],
  );
  const ActivePage = tabs.find((tab) => tab.id === activeTab).component;

  return (
    <div>
      <HubHeader
        title="Operacionet"
        description="Kthe raportet në veprime: valido sinjalet, cakto burimet dhe ndiq dispatch-et reale."
      />
      <HubTabs tabs={tabs} activeTab={activeTab} onChange={(tab) => setSearchParams({ tab })} />
      <ActivePage />
    </div>
  );
}

function OperationsOverview() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportStatistics, setReportStatistics] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { lastEvent } = useWebSocket();

  const load = useCallback(async () => {
    setError('');
    try {
      const [summaryResponse, reportsResponse, statisticsResponse, dispatchResponse] = await Promise.all([
        client.get('/routing/dispatches/summary'),
        reportsAPI.list({ status: 'pending', limit: 6 }),
        reportsAPI.getStatistics(),
        client.get('/routing/dispatches'),
      ]);
      setSummary(summaryResponse.data);
      setReports(Array.isArray(reportsResponse.data) ? reportsResponse.data : []);
      setReportStatistics(statisticsResponse.data);
      setDispatches(dispatchResponse.data?.dispatches || []);
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Të dhënat operative nuk mund të ngarkohen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  useEffect(() => {
    if (['report:created', 'report:updated', 'report:deleted', 'routing:dispatch', 'resource:allocated'].includes(lastEvent?.type)) {
      queueMicrotask(load);
    }
  }, [lastEvent, load]);

  const activeDispatches = dispatches.filter((item) => ['en_route', 'at_scene'].includes(item.status));

  if (loading) return <p role="status" style={{ color: '#9ca3af' }}>Duke ngarkuar gjendjen operative…</p>;

  return (
    <main>
      {error && <Notice tone="error">{error}</Notice>}
      <div style={styles.toolbar}>
        <div>
          <h2 style={styles.sectionTitle}>Gjendja tani</h2>
          <p style={styles.muted}>Burimi: PostgreSQL dhe ngjarjet live të platformës.</p>
        </div>
        <button type="button" onClick={load} style={styles.secondaryButton}>Rifresko</button>
      </div>

      <section aria-label="Metrikat operative" style={styles.cardGrid}>
        <Metric label="Raporte në pritje" value={reportStatistics?.pending ?? 0} detail="për verifikim" color="#ffa502" />
        <Metric label="Ambulanca të lira" value={summary?.fleet?.available ?? 0} detail={`nga ${summary?.fleet?.total ?? 0}`} color="#2ed573" />
        <Metric label="Dispatch aktive" value={summary?.dispatches?.active ?? 0} detail={`${summary?.dispatches?.completed ?? 0} të përfunduara`} color="#00d4ff" />
        <Metric label="Koha mesatare" value={`${summary?.average_response_minutes ?? 0} min`} detail="nga dispatch-et e ruajtura" color="#7b2ff7" />
      </section>

      <div style={styles.twoColumn}>
        <section style={styles.panel}>
          <PanelHeader title="Raportet që kërkojnë veprim" actionLabel="Hap të gjitha" onAction={() => navigate('/admin/operations?tab=reports')} />
          {reports.length === 0 ? (
            <Empty text="Nuk ka raporte në pritje." />
          ) : (
            <div>{reports.map((report) => (
              <div key={report.id} style={styles.row}>
                <div>
                  <strong style={styles.primaryText}>{report.district || 'Lokacion i panjohur'}</strong>
                  <p style={styles.muted}>{report.report_type || 'Raport'} · Severiteti {report.severity}/5</p>
                </div>
                <span style={styles.badge('#ffa502')}>Në pritje</span>
              </div>
            ))}</div>
          )}
        </section>

        <section style={styles.panel}>
          <PanelHeader title="Dispatch-et aktive" actionLabel="Hap dispatch" onAction={() => navigate('/admin/operations?tab=routing')} />
          {activeDispatches.length === 0 ? (
            <Empty text="Nuk ka ambulanca në rrugë." />
          ) : (
            <div>{activeDispatches.map((dispatch) => (
              <DispatchRow key={dispatch.id} dispatch={dispatch} onUpdated={load} />
            ))}</div>
          )}
        </section>
      </div>

      <section style={styles.panel}>
        <PanelHeader title="Aktiviteti i fundit i dispatch-it" />
        {dispatches.length === 0 ? <Empty text="Ende nuk ka dispatch-e të ruajtura." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr>{['Ambulanca', 'Distrikti', 'Spitali', 'Statusi', 'Algoritmi', 'Koha'].map((heading) => <th key={heading} style={styles.th}>{heading}</th>)}</tr></thead>
              <tbody>{dispatches.slice(0, 8).map((dispatch) => (
                <tr key={dispatch.id}>
                  <td style={styles.td}>{dispatch.ambulance_id}</td>
                  <td style={styles.td}>{dispatch.district}</td>
                  <td style={styles.td}>{dispatch.hospital}</td>
                  <td style={styles.td}><span style={styles.badge(statusColor(dispatch.status))}>{dispatch.status}</span></td>
                  <td style={styles.td}>{dispatch.algorithm || '—'}</td>
                  <td style={styles.td}>{dispatch.time_minutes ? `${Number(dispatch.time_minutes).toFixed(1)} min` : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function DispatchRow({ dispatch, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const advance = async () => {
    setUpdating(true);
    try {
      await client.patch(`/routing/dispatches/${dispatch.id}`, { status: dispatch.status === 'en_route' ? 'at_scene' : 'completed' });
      onUpdated();
    } catch (reason) {
      console.error(reason);
    } finally {
      setUpdating(false);
    }
  };
  return (
    <div style={styles.row}>
      <div>
        <strong style={styles.primaryText}>{dispatch.ambulance_id}</strong>
        <p style={styles.muted}>{dispatch.district} → {dispatch.hospital}</p>
      </div>
      <button type="button" disabled={updating} onClick={advance} style={styles.secondaryButton}>
        {updating ? '…' : dispatch.status === 'en_route' ? 'Arriti në vendngjarje' : 'Përfundo'}
      </button>
    </div>
  );
}

function HubHeader({ title, description }) {
  return <header style={{ marginBottom: '1.25rem' }}><h1 style={styles.title}>{title}</h1><p style={styles.muted}>{description}</p></header>;
}

function HubTabs({ tabs, activeTab, onChange }) {
  return <div style={styles.tabs}>{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => onChange(tab.id)} style={{ ...styles.tab, ...(activeTab === tab.id ? styles.activeTab : {}) }}>{tab.label}</button>)}</div>;
}

function Metric({ label, value, detail, color }) {
  return <article style={styles.metric}><span style={{ color, fontSize: '1.5rem', fontWeight: 800 }}>{value}</span><strong style={styles.primaryText}>{label}</strong><small style={styles.muted}>{detail}</small></article>;
}

function PanelHeader({ title, actionLabel, onAction }) {
  return <div style={styles.panelHeader}><h2 style={styles.sectionTitle}>{title}</h2>{actionLabel && <button type="button" onClick={onAction} style={styles.linkButton}>{actionLabel}</button>}</div>;
}

function Empty({ text }) {
  return <p style={{ ...styles.muted, padding: '1rem 0' }}>{text}</p>;
}

function Notice({ tone, children }) {
  return <p role="alert" style={{ color: tone === 'error' ? '#ff7b86' : '#2ed573' }}>{children}</p>;
}

function statusColor(status) {
  return { en_route: '#ffa502', at_scene: '#00d4ff', completed: '#2ed573', cancelled: '#ff4757' }[status] || '#9ca3af';
}

const styles = {
  title: { margin: 0, color: '#f3f4f6', fontSize: '1.65rem' },
  sectionTitle: { margin: 0, color: '#e8eaf6', fontSize: '1rem' },
  muted: { margin: '.3rem 0 0', color: '#9ca3af', fontSize: '.8rem' },
  primaryText: { color: '#e8eaf6', fontSize: '.88rem' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  tabs: { display: 'flex', gap: '.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #1e2655', paddingBottom: '.75rem', overflowX: 'auto' },
  tab: { padding: '.55rem .9rem', borderRadius: '.45rem', border: '1px solid #1e2655', background: '#131938', color: '#9ca3af', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' },
  activeTab: { borderColor: '#00d4ff', background: 'rgba(0,212,255,.12)', color: '#00d4ff' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '1rem', marginBottom: '1.25rem' },
  metric: { background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.25rem' },
  twoColumn: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '1.25rem', marginBottom: '1.25rem' },
  panel: { background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem', marginBottom: '1.25rem' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', paddingBottom: '.75rem', borderBottom: '1px solid #1e2655' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '.8rem 0', borderBottom: '1px solid rgba(30,38,85,.65)' },
  badge: (color) => ({ color, background: `${color}22`, borderRadius: '.3rem', padding: '.25rem .45rem', fontSize: '.7rem', whiteSpace: 'nowrap' }),
  secondaryButton: { background: '#1b2550', border: '1px solid #34417d', color: '#dbeafe', borderRadius: '.4rem', padding: '.45rem .7rem', cursor: 'pointer', fontWeight: 600 },
  linkButton: { background: 'none', border: 0, color: '#00d4ff', cursor: 'pointer', fontSize: '.78rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '.7rem .5rem', color: '#9ca3af', fontSize: '.7rem', textTransform: 'uppercase', borderBottom: '1px solid #1e2655' },
  td: { padding: '.7rem .5rem', color: '#e8eaf6', borderBottom: '1px solid rgba(30,38,85,.65)', fontSize: '.8rem' },
};
