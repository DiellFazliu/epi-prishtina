import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import client from '../../api/client';

export default function PortalProfile() {
  const { user } = useAuth();
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await client.post('/auth/change-password', passwords);
      setPasswords({ old_password: '', new_password: '' });
      setMessage('Fjalëkalimi u ndryshua me sukses.');
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Fjalëkalimi nuk mund të ndryshohet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        👤 Profili Im
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Informacioni i llogarisë
      </p>

      <div style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '0.75rem', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 'bold',
            color: 'white'
          }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>

          <form onSubmit={changePassword} style={{ marginTop: '1.25rem', background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '.4rem' }}>Ndrysho fjalëkalimin</h2>
            <p style={{ color: '#9ca3af', fontSize: '.8rem', marginBottom: '1rem' }}>Përdor një fjalëkalim me të paktën 8 karaktere, një shkronjë të madhe dhe një numër.</p>
            {error && <p role="alert" style={{ color: '#ff7b86' }}>{error}</p>}
            {message && <p role="status" style={{ color: '#2ed573' }}>{message}</p>}
            <input required type="password" minLength="8" placeholder="Fjalëkalimi aktual" value={passwords.old_password} onChange={(event) => setPasswords({ ...passwords, old_password: event.target.value })} style={inputStyle} />
            <input required type="password" minLength="8" placeholder="Fjalëkalimi i ri" value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} style={inputStyle} />
            <button type="submit" disabled={saving} style={buttonStyle}>{saving ? 'Duke ruajtur…' : 'Ruaj fjalëkalimin'}</button>
          </form>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {user?.full_name || user?.username}
            </h2>
            <p style={{ color: '#9ca3af' }}>{user?.email}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <InfoRow label="Username" value={user?.username} />
          <InfoRow label="Email" value={user?.email} />
          <InfoRow label="Roli" value={user?.role} />
          <InfoRow label="Lagjja" value={user?.district || '—'} />
          <InfoRow label="Statusi" value={user?.is_active ? 'Aktiv' : 'Joaktiv'} />
        </div>
      </div>
    </div>
  );
}

const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box', marginBottom: '.65rem', padding: '.65rem', background: '#0a0e27', border: '1px solid #34417d', borderRadius: '.4rem', color: '#e8eaf6' };
const buttonStyle = { padding: '.6rem .9rem', background: '#00d4ff', border: 0, borderRadius: '.4rem', color: '#071126', cursor: 'pointer', fontWeight: 700 };

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #1e2655' }}>
      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ color: '#e8eaf6', fontSize: '0.875rem', fontWeight: '600' }}>{value}</span>
    </div>
  );
}