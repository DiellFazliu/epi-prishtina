import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { reportsAPI } from '../../api/reports';

export default function PortalHome() {
  const { user } = useAuth();
  const [myReports, setMyReports] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMyReports = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [reports, stats] = await Promise.all([
        reportsAPI.list({ limit: 10 }),
        reportsAPI.getStatistics(),
      ]);
      setMyReports(reports);
      setStatistics(stats);
    } catch (err) {
      setError(err.response?.data?.detail || 'Të dhënat personale nuk mund të ngarkohen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadMyReports(); }, 0);
    return () => clearTimeout(timer);
  }, [loadMyReports]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Mirësevjen, {user?.full_name || user?.username}!
        </h1>
        <p style={{ color: '#9ca3af' }}>
          Kontribo në monitorimin e shëndetit publik të Prishtinës
        </p>
      </div>

      {/* Status Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(123, 47, 247, 0.1))',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '2rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Si mund të ndihmosh?
        </h2>
        <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
          Raporto simptomat e tua për të ndihmuar në parashikimin e përhapjes së sëmundjeve
        </p>
        <Link to="/portal/report" style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
          color: 'white',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '0.875rem'
        }}>
          ➕ Raporto Simptoma
        </Link>
      </div>

      {error && <p role="alert" style={{ color: '#ff7b86', marginBottom: '1rem' }}>{error}</p>}
      <section aria-label="Përmbledhje personale" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '.75rem', marginBottom: '2rem' }}>
        <PersonalMetric label="Raporte gjithsej" value={statistics?.total ?? '—'} color="#00d4ff" />
        <PersonalMetric label="Në pritje" value={statistics?.pending ?? '—'} color="#ffa502" />
        <PersonalMetric label="Të validuara" value={statistics?.validated ?? '—'} color="#2ed573" />
        <PersonalMetric label="Të refuzuara" value={statistics?.rejected ?? '—'} color="#ff4757" />
      </section>

      {/* My Reports */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Raportet e Mia të Fundit</h2>
        <Link to="/portal/history" style={{ color: '#00d4ff', fontSize: '.8rem' }}>Shiko historikun</Link>
      </div>
      <section>
        {loading ? (
          <p style={{ color: '#9ca3af' }}>Duke u ngarkuar...</p>
        ) : myReports.length === 0 ? (
          <div style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
            Nuk ke raporte ende
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {myReports.slice(0, 5).map((r) => (
              <div key={r.id} style={{
                background: '#131938',
                border: '1px solid #1e2655',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{r.district}</p>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {new Date(r.reported_at).toLocaleString('sq-AL')}
                  </p>
                </div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  background: r.status === 'validated' ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255, 165, 2, 0.2)',
                  color: r.status === 'validated' ? '#2ed573' : '#ffa502'
                }}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PersonalMetric({ label, value, color }) {
  return (
    <article style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.65rem', padding: '1rem' }}>
      <strong style={{ display: 'block', color, fontSize: '1.35rem' }}>{value}</strong>
      <span style={{ color: '#9ca3af', fontSize: '.75rem' }}>{label}</span>
    </article>
  );
}
