import { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../../api/reports';

export default function PortalHistory() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
      setError('');
      setLoading(true);
      try {
        const data = await reportsAPI.list({ limit: 50 });
        setReports(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Historia nuk mund të ngarkohet.');
      } finally {
        setLoading(false);
      }

  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        📋 Historia e Raporteve
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Të gjitha raportet e tua
      </p>
      <button type="button" onClick={load} style={buttonStyle}>Rifresko historikun</button>

      {error && <p role="alert" style={{ color: '#ff7b86', margin: '1rem 0' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#9ca3af' }}>Duke u ngarkuar...</p>
      ) : reports.length === 0 ? (
        <div style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '0.75rem', padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
          Nuk kesh raporte
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {reports.map((r) => (
            <div key={r.id} style={{
              background: '#131938',
              border: '1px solid #1e2655',
              borderRadius: '0.75rem',
              padding: '1.25rem'
            }}>
              <button type="button" onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={cardButtonStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: '600', color: '#e8eaf6' }}>{r.district}</span>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  background: r.report_type === 'confirmed' ? 'rgba(255, 71, 87, 0.2)' : 'rgba(255, 165, 2, 0.2)',
                  color: r.report_type === 'confirmed' ? '#ff4757' : '#ffa502'
                }}>
                  {r.report_type}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {r.symptoms?.map((s) => (
                  <span key={s} style={{
                    padding: '0.25rem 0.5rem',
                    background: '#0a0e27',
                    border: '1px solid #1e2655',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#9ca3af'
                  }}>
                    {s}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {new Date(r.reported_at).toLocaleString('sq-AL')}
              </p>
              {expanded === r.id && <div style={{ marginTop: '.85rem', paddingTop: '.75rem', borderTop: '1px solid #1e2655', textAlign: 'left' }}>
                <p style={detailStyle}>Statusi: <strong>{r.status}</strong></p>
                <p style={detailStyle}>Ashpërsia: <strong>{r.severity}/5</strong></p>
                {r.validation_notes && <p style={detailStyle}>Shënim i verifikimit: <strong>{r.validation_notes}</strong></p>}
              </div>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const buttonStyle = {
  marginBottom: '1rem',
  padding: '.55rem .8rem',
  background: '#1b2550',
  border: '1px solid #34417d',
  borderRadius: '.4rem',
  color: '#dbeafe',
  cursor: 'pointer',
  fontWeight: 600,
};
const cardButtonStyle = {
  width: '100%',
  background: 'none',
  border: 0,
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  padding: 0,
};
const detailStyle = { color: '#9ca3af', fontSize: '.8rem', margin: '.35rem 0' };