import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ROLE_PRESETS = {
  admin: {
    label: 'Administrator',
    description: 'Admin, Health Worker, Analyst',
    icon: '👨‍💼',
    color: '#ff4757',
    targetPath: '/admin/dashboard',
  },
  citizen: {
    label: 'Qytetar',
    description: 'Raporto simptomat',
    icon: '👤',
    color: '#2ed573',
    targetPath: '/portal',
  },
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password);

    if (result.success) {
      const userRole = result.user?.role;

      // Kontrollo nëse roli përputhet me zgjedhjen
      if (selectedRole === 'citizen' && userRole !== 'citizen') {
        setError('Ky user nuk është qytetar. Provo si Administrator.');
        setLoading(false);
        return;
      }

      if (selectedRole === 'admin' && userRole === 'citizen') {
        setError('Ky user është qytetar. Provo si Qytetar.');
        setLoading(false);
        return;
      }

      // Redirect sipas rolit
      if (userRole === 'citizen') {
        navigate('/portal');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e27',
      padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 1rem',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem'
          }}>
            🦠
          </div>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            EpiPrishtina
          </h1>
          <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            Intelligent Epidemic Response System
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '2rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', textAlign: 'center' }}>
            Zgjidh llojin e llogarisë
          </h2>

          {/* Role Selector */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            {Object.entries(ROLE_PRESETS).map(([key, preset]) => {
              const isSelected = selectedRole === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleRoleSelect(key)}
                  style={{
                    padding: '1rem',
                    background: isSelected
                      ? `linear-gradient(135deg, ${preset.color}20, ${preset.color}05)`
                      : '#0a0e27',
                    border: isSelected
                      ? `2px solid ${preset.color}`
                      : '2px solid #1e2655',
                    borderRadius: '0.75rem',
                    color: isSelected ? preset.color : '#9ca3af',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      width: '1rem',
                      height: '1rem',
                      borderRadius: '50%',
                      background: preset.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </div>
                  )}
                  <span style={{ fontSize: '1.75rem' }}>{preset.icon}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>
                    {preset.label}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    color: isSelected ? preset.color : '#6b7280',
                    textAlign: 'center',
                    lineHeight: '1.2'
                  }}>
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid rgba(255, 71, 87, 0.3)',
              borderRadius: '0.5rem',
              color: '#ff4757',
              fontSize: '0.8rem'
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0a0e27',
                  border: '1px solid #1e2655',
                  borderRadius: '0.5rem',
                  padding: '0.625rem 1rem',
                  color: 'white',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
                placeholder="username"
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0a0e27',
                  border: '1px solid #1e2655',
                  borderRadius: '0.5rem',
                  padding: '0.625rem 1rem',
                  color: 'white',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: `linear-gradient(135deg, ${ROLE_PRESETS[selectedRole].color}, ${ROLE_PRESETS[selectedRole].color}aa)`,
                color: 'white',
                fontWeight: '700',
                padding: '0.875rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: loading ? 0.6 : 1,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                'Duke u identifikuar...'
              ) : (
                <>
                  <span>{ROLE_PRESETS[selectedRole].icon}</span>
                  <span>Hyr si {ROLE_PRESETS[selectedRole].label}</span>
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
            Nuk kesh llogari?{' '}
            <Link to="/register" style={{ color: '#00d4ff', textDecoration: 'none', fontWeight: '600' }}>
              Regjistrohu
            </Link>
          </div>
        </div>

        {/* Info Box */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(0, 212, 255, 0.05)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: '0.5rem',
          fontSize: '0.7rem',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          💡 Roli i zgjedhur përcakton se ku do të ridrejtohesh pas login-it
        </div>
      </div>
    </div>
  );
}