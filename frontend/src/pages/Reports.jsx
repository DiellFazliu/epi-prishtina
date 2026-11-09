import { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../api/reports';
import { useAuth } from '../contexts/AuthContext';

export default function Reports() {
  const { hasRole } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    district: '',
    status: '',
    report_type: '',
  });

  const canValidate = hasRole(['admin', 'health_worker']);
  const canDelete = hasRole(['admin']);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.district) params.district = filters.district;
      if (filters.status) params.status = filters.status;
      if (filters.report_type) params.report_type = filters.report_type;

      const data = await reportsAPI.list({ ...params, limit: 100 });
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    queueMicrotask(() => {
      loadReports();
    });
  }, [loadReports]);

  const handleValidate = async (id, status) => {
    if (!canValidate) return;
    try {
      await reportsAPI.update(id, { status });
      loadReports();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    if (!window.confirm('Konfirmo fshirjen e raportit?')) return;
    try {
      await reportsAPI.delete(id);
      loadReports();
    } catch (err) {
      console.error(err);
    }
  };

  const statusColors = {
    pending: '#ffa502',
    validated: '#2ed573',
    rejected: '#ff4757',
    flagged: '#ff6348',
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        Raporte
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Menaxho dhe valido raportet e qytetarëve
      </p>

      {/* Filtra */}
      <div style={{
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <select
          value={filters.district}
          onChange={(e) => setFilters({ ...filters, district: e.target.value })}
          style={selectStyle}
        >
          <option value="">Të gjitha lagjet</option>
          <option value="Qendra">Qendra</option>
          <option value="Dardania">Dardania</option>
          <option value="Ulpiana">Ulpiana</option>
          <option value="Arbëria">Arbëria</option>
          <option value="Kalabria">Kalabria</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={selectStyle}
        >
          <option value="">Të gjitha statuset</option>
          <option value="pending">Në pritje</option>
          <option value="validated">Validuar</option>
          <option value="rejected">Refuzuar</option>
        </select>

        <select
          value={filters.report_type}
          onChange={(e) => setFilters({ ...filters, report_type: e.target.value })}
          style={selectStyle}
        >
          <option value="">Të gjitha llojet</option>
          <option value="symptom">Simptoma</option>
          <option value="confirmed">Konfirmuar</option>
        </select>

        <button onClick={loadReports} className="btn-primary">
          🔄 Rifresko
        </button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          Duke u ngarkuar...
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '3rem',
          textAlign: 'center',
          color: '#9ca3af',
        }}>
          Nuk ka raporte
        </div>
      ) : (
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a0e27', borderBottom: '1px solid #1e2655' }}>
                <th style={thStyle}>Lagjja</th>
                <th style={thStyle}>Lloji</th>
                <th style={thStyle}>Simptomat</th>
                <th style={thStyle}>Severiteti</th>
                <th style={thStyle}>Besueshmëria</th>
                <th style={thStyle}>Statusi</th>
                {canValidate && <th style={thStyle}>Veprime</th>}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #1e2655' }}>
                  <td style={tdStyle}>{r.district}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      background: r.report_type === 'confirmed' ? 'rgba(255,71,87,.2)' : 'rgba(255,165,2,.2)',
                      color: r.report_type === 'confirmed' ? '#ff4757' : '#ffa502',
                    }}>
                      {r.report_type === 'confirmed' ? 'Konfirmuar' : 'Simptoma'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {r.symptoms?.slice(0, 2).join(', ') || '—'}
                    {r.symptoms?.length > 2 && ` +${r.symptoms.length - 2}`}
                  </td>
                  <td style={tdStyle}>{r.severity}/5</td>
                  <td style={tdStyle}>
                    <span style={{ color: r.reliability_score > 0.7 ? '#2ed573' : '#ffa502' }}>
                      {(r.reliability_score * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      background: `${statusColors[r.status]}20`,
                      color: statusColors[r.status],
                    }}>
                      {r.status}
                    </span>
                  </td>
                  {canValidate && (
                    <td style={tdStyle}>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            onClick={() => handleValidate(r.id, 'validated')}
                            title="Valido"
                            style={btnIconStyle('rgba(46,213,115,.2)', '#2ed573')}
                          >✓</button>
                          <button
                            onClick={() => handleValidate(r.id, 'rejected')}
                            title="Refuzo"
                            style={btnIconStyle('rgba(255,71,87,.2)', '#ff4757')}
                          >✗</button>
                        </div>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          title="Fshij"
                          style={{
                            ...btnIconStyle('rgba(255,71,87,.15)', '#ff4757'),
                            marginLeft: '0.25rem',
                          }}
                        >🗑</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  background: '#0a0e27',
  border: '1px solid #1e2655',
  borderRadius: '0.5rem',
  padding: '0.5rem 1rem',
  color: 'white',
  fontSize: '0.875rem',
};

const thStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: '600',
};

const tdStyle = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: '#e8eaf6',
};

function btnIconStyle(bg, color) {
  return {
    padding: '0.25rem 0.5rem',
    background: bg,
    color,
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
  };
}