import Sparkline from './Sparkline';
import { Link } from 'react-router-dom';

export default function LiveSimulationPanel({
  snapshot,
  history = [],
  canOperate = false,
  operationLoading = false,
  onToggleRunning,
}) {
  const state = snapshot?.simulation_state || {};
  const stats = snapshot?.stats || {};
  const active = stats.active ?? 0;
  const series = [...history.map((item) => item.active ?? 0), active].slice(-30);
  const running = snapshot?.running === true;

  return (
    <section style={{
      background: '#131938',
      border: '1px solid #1e2655',
      borderRadius: '.75rem',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        marginBottom: '.9rem',
      }}>
        <div>
          <h2 style={{ color: '#e8eaf6', fontSize: '.95rem', margin: 0 }}>
            ⚡ Simulimi epidemiologjik live
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '.72rem', margin: '.35rem 0 0' }}>
            Model SEIR i avancuar nga raportet dhe masat aktive
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{
            color: running ? '#2ed573' : '#ffa502',
            border: `1px solid ${running ? '#2ed573' : '#ffa502'}55`,
            background: running ? '#2ed57315' : '#ffa50215',
            borderRadius: '999px',
            padding: '.3rem .6rem',
            fontSize: '.65rem',
            fontWeight: 800,
          }}>
            {running ? '● RUNNING' : 'Ⅱ PAUSED'}
          </span>
          {canOperate && (
            <button
              type="button"
              onClick={onToggleRunning}
              disabled={operationLoading}
              style={{
                border: '1px solid #1e2655',
                borderRadius: '.4rem',
                background: '#0a0e27',
                color: running ? '#ffa502' : '#2ed573',
                padding: '.3rem .55rem',
                cursor: operationLoading ? 'wait' : 'pointer',
                fontSize: '.65rem',
                fontWeight: 700,
              }}
            >
              {operationLoading ? '...' : running ? 'Pauzo' : 'Nis'}
            </button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: '.75rem',
      }}>
        <Metric label="Dita virtuale" value={snapshot?.day ?? '—'} color="#00d4ff" />
        <Metric label="Raste aktive" value={Math.round(active).toLocaleString()} color="#ff4757" />
        <Metric label="R(t)" value={stats.rt?.toFixed?.(2) ?? '—'} color="#ffa502" />
        <Metric label="Vdekje" value={Math.round(stats.deaths ?? state.dead ?? 0).toLocaleString()} color="#a5b1c2" />
        <Metric label="Masa aktive" value={snapshot?.active_measures?.length ?? 0} color="#2ed573" />
      </div>

      <div style={{ marginTop: '.75rem', height: 48 }}>
        <Sparkline data={series} color="#ff4757" height={48} />
      </div>
      <div style={{
        marginTop: '.9rem',
        paddingTop: '.8rem',
        borderTop: '1px solid rgba(30,38,85,.75)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            color: '#9ca3af',
            fontSize: '.65rem',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '.45rem',
          }}>
            Masat që ndikojnë në model
          </div>
          {snapshot?.active_measures?.length ? (
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              {snapshot.active_measures.map((measure, index) => (
                <span key={`${measure.type || 'measure'}-${index}`} style={{
                  color: '#b8f7d4',
                  background: 'rgba(46,213,115,.1)',
                  border: '1px solid rgba(46,213,115,.25)',
                  borderRadius: '999px',
                  padding: '.3rem .55rem',
                  fontSize: '.68rem',
                }}>
                  {formatMeasure(measure)}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: '#6b7280', fontSize: '.72rem' }}>Nuk ka masa aktive</span>
          )}
        </div>
        <Link to="/admin/pipeline" style={{
          color: '#00d4ff',
          fontSize: '.7rem',
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          Menaxho masat dhe shiko ndikimin →
        </Link>
      </div>
      <p style={{ color: '#6b7280', fontSize: '.65rem', margin: '.35rem 0 0' }}>
        Ky është projeksion modelor i kalibruar me të dhënat e disponueshme, jo matje klinike reale.
        Përditësimi i fundit: {snapshot?.last_updated ? new Date(snapshot.last_updated).toLocaleTimeString('sq-AL') : '—'}
      </p>
    </section>
  );
}

function formatMeasure(measure) {
  const type = String(measure?.type || 'masë').replaceAll('_', ' ');
  const intensity = Number(measure?.intensity);
  return Number.isFinite(intensity) && intensity > 0
    ? `${type} · ${Math.round(intensity * 100)}%`
    : type;
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background: '#0a0e27', borderRadius: '.45rem', padding: '.6rem .7rem' }}>
      <div style={{ color: '#6b7280', fontSize: '.62rem', textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color, fontSize: '1.05rem', fontWeight: 800, marginTop: '.25rem' }}>
        {value}
      </div>
    </div>
  );
}
