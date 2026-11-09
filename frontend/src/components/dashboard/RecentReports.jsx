import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../api/client';

export default function RecentReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    client
      .get('/reports', { params: { limit: 5 } })
      .then(({ data }) => {
        if (mounted) setReports(data);
      })
      .catch(() => {
        if (mounted) setReports([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const statusColors = {
    pending: '#ffa502',
    validated: '#2ed573',
    rejected: '#ff4757',
    flagged: '#ff6348',
  };

  return (
    <div
      style={{
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.875rem',
        }}
      >
        <h2
          style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: '#e8eaf6',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📋 Raporte të Fundit
        </h2>
        <Link
          to="/admin/reports"
          style={{
            fontSize: '0.7rem',
            color: '#00d4ff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Shiko të gjitha →
        </Link>
      </div>

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.75rem' }}>Duke u ngarkuar...</p>
      ) : reports.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.75rem' }}>Nuk ka raporte</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {reports.map((r) => {
            const color = statusColors[r.status] || '#6b7280';
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem 0.625rem',
                  background: '#0a0e27',
                  borderRadius: '0.4rem',
                  border: '1px solid #1e2655',
                  gap: '0.5rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: '#e8eaf6',
                      fontWeight: 600,
                      marginBottom: '0.125rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.district}
                  </p>
                  <p
                    style={{
                      fontSize: '0.65rem',
                      color: '#6b7280',
                    }}
                  >
                    {r.report_type === 'confirmed' ? '🧪 Konfirmuar' : '🤒 Simptoma'}
                  </p>
                </div>
                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    background: `${color}20`,
                    color,
                    borderRadius: '0.25rem',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}