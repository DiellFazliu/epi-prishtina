import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/portal', label: 'Kryefaqja', icon: '🏠' },
  { path: '/portal/report', label: 'Raporto', icon: '➕' },
  { path: '/portal/history', label: 'Historia', icon: '📋' },
  { path: '/portal/profile', label: 'Profili', icon: '👤' },
];

export default function CitizenLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e27', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#131938',
        borderBottom: '1px solid #1e2655',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.125rem'
          }}>🦠</div>
          <h1 style={{
            fontWeight: 'bold',
            fontSize: '1rem',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>EpiPrishtina</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            {user?.full_name || user?.username}
          </span>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.875rem'
          }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <button
            onClick={logout}
            style={{
              fontSize: '0.875rem',
              color: '#9ca3af',
              background: 'transparent',
              border: '1px solid #1e2655',
              cursor: 'pointer',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem'
            }}
          >
            Dilni
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>

      {/* Bottom navigation (mobile style) */}
      <nav style={{
        background: '#131938',
        borderTop: '1px solid #1e2655',
        padding: '0.75rem',
        display: 'flex',
        justifyContent: 'space-around',
        position: 'sticky',
        bottom: 0
      }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                textDecoration: 'none',
                color: isActive ? '#00d4ff' : '#9ca3af',
                fontSize: '0.75rem',
                padding: '0.5rem 1rem'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}