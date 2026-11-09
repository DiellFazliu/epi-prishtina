import { useState, useEffect, useCallback } from 'react';
import { usersAPI } from '../api/users';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersAPI.list({ limit: 100 });
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadUsers(); }, 0);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const roleColors = {
    admin: '#ff4757',
    health_worker: '#00d4ff',
    analyst: '#ffa502',
    citizen: '#2ed573',
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        Usera
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Menaxho userat e sistemit
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          Duke u ngarkuar...
        </div>
      ) : (
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a0e27', borderBottom: '1px solid #1e2655' }}>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Emri</th>
                <th style={thStyle}>Roli</th>
                <th style={thStyle}>Statusi</th>
                <th style={thStyle}>Regjistruar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #1e2655' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 'bold'
                      }}>
                        {u.username?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '600' }}>{u.username}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{u.full_name || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      background: `${roleColors[u.role]}20`,
                      color: roleColors[u.role]
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      background: u.is_active ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255, 71, 87, 0.2)',
                      color: u.is_active ? '#2ed573' : '#ff4757'
                    }}>
                      {u.is_active ? 'Aktiv' : 'Joaktiv'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('sq-AL') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: '600'
};

const tdStyle = {
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  color: '#e8eaf6'
};
