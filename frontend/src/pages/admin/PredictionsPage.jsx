import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useWebSocket } from '../../hooks/useWebSocket';

const RISK_COLORS = { CRITICAL: '#ff4757', HIGH: '#ff6348', MEDIUM: '#ffa502', LOW: '#2ed573' };

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { lastEvent } = useWebSocket();

  useEffect(() => {
    let mounted = true;
    Promise.all([client.get('/hotspots'), client.get('/hotspots/runs')]).then(([predictionResponse, runsResponse]) => {
      if (!mounted) return;
      setPredictions(predictionResponse.data.map((item) => ({ ...item, risk_level: item.risk_level?.toUpperCase() || 'LOW' })));
      setRuns(Array.isArray(runsResponse.data) ? runsResponse.data : []);
    }).catch((reason) => {
      if (mounted) setError(reason.response?.data?.detail || 'Parashikimet nuk mund të ngarkohen. Ekzekuto rifreskimin e modelit ML.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [lastEvent?.type]);

  const critical = predictions.filter((item) => item.risk_level === 'CRITICAL').length;
  const high = predictions.filter((item) => item.risk_level === 'HIGH').length;
  const generated = predictions[0]?.day;

  return (
    <main>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '.5rem' }}>🔮 Parashikimet e hotspot-eve</h1>
        <p style={{ color: '#9ca3af' }}>Probabilitetet lexohen nga dalja e fundit e modelit XGBoost të trajnuar me CSV-në historike të përpunuar.</p>
      </header>
      {error && <p role="alert" style={{ color: '#ff7b86', marginBottom: '1rem' }}>{error}</p>}
      {loading ? <p role="status" style={{ color: '#9ca3af' }}>Duke ngarkuar parashikimet…</p> : <>
        <section aria-label="Përmbledhje e rrezikut" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <SummaryCard label="Lagje të analizuara" value={predictions.length} color="#00d4ff" icon="📍" />
          <SummaryCard label="Rrezik kritik" value={critical} color="#ff4757" icon="🚨" />
          <SummaryCard label="Rrezik i lartë" value={high} color="#ff6348" icon="⚠️" />
          <SummaryCard label="Dita e të dhënave" value={generated ?? '—'} color="#7b2ff7" icon="🗓️" />
        </section>
        <section style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e2655' }}><h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Lagjet sipas probabilitetit të hotspot-it</h2></div>
          {predictions.length === 0 ? <p style={{ padding: '1.25rem', color: '#9ca3af' }}>Modeli nuk ka prodhuar ende parashikime.</p> : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 650, borderCollapse: 'collapse' }}>
              <thead><tr>{['Lagjja', 'Probabiliteti i modelit', 'Niveli', 'Raporte live · 7 ditë', 'Të verifikuara live', 'Input historik CSV · raporte 7d', 'Input CSV · konfirmuara 7d', 'Popullsia bazë'].map((label) => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
              <tbody>{[...predictions].sort((a, b) => b.probability - a.probability).map((item) => {
                const color = RISK_COLORS[item.risk_level] || '#9ca3af';
                return <tr key={item.district}>
                  <td style={tdStyle}>{item.district}</td>
                  <td style={{ ...tdStyle, color, fontWeight: 800 }}>{(item.probability * 100).toFixed(1)}%</td>
                  <td style={tdStyle}><span style={{ color, fontWeight: 700 }}>{item.risk_level}</span></td>
                  <td style={{ ...tdStyle, color: '#00d4ff', fontWeight: 700 }}>{Number(item.observed_reports_7d || 0).toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: '#2ed573', fontWeight: 700 }}>{Number(item.observed_validated_7d || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(item.reports_7d || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(item.confirmed_7d || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(item.population || 0).toLocaleString()}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        </section>
        <section style={{ marginTop: '1.25rem', background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e2655' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Historiku i run-eve ML</h2>
            <p style={{ color: '#9ca3af', fontSize: '.75rem', margin: '.35rem 0 0' }}>Run-et e mëparshme ruhen për krahasim dhe auditim të modelit.</p>
          </div>
          {runs.length === 0 ? <p style={{ padding: '1.25rem', color: '#9ca3af' }}>Nuk ka historik të ruajtur.</p> : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }}>
              <thead><tr>{['Run ID', 'Dita e parashikimit', 'Distrikte', 'Gjeneruar'].map((label) => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
              <tbody>{runs.map((run) => <tr key={run.run_id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '.72rem' }}>{run.run_id}</td>
                <td style={tdStyle}>{run.prediction_day}</td>
                <td style={tdStyle}>{run.count}</td>
                <td style={tdStyle}>{new Date(run.generated_at).toLocaleString('sq-AL')}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>
        <p style={{ marginTop: '1rem', color: '#ffa502', fontSize: '.75rem' }}>Numërimet live vijnë nga raportet e databazës; probabilitetet e modelit nuk përfshijnë këto raporte dhe mbeten parashikime historike. CSV-ja dhe modeli duhen rifreskuar e validuar para përdorimit operacional.</p>
      </>}
    </main>
  );
}

function SummaryCard({ label, value, color, icon }) {
  return <article style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '.75rem', marginBottom: '.5rem' }}><span>{label}</span><span>{icon}</span></div>
    <strong style={{ color, fontSize: '1.5rem' }}>{value}</strong>
  </article>;
}
const thStyle = { padding: '.75rem 1rem', textAlign: 'left', color: '#9ca3af', fontSize: '.7rem', textTransform: 'uppercase', borderBottom: '1px solid #1e2655' };
const tdStyle = { padding: '.8rem 1rem', color: '#e8eaf6', fontSize: '.85rem', borderBottom: '1px solid rgba(30,38,85,.65)' };
