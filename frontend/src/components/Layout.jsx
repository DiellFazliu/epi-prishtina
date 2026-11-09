import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'health_worker', 'analyst', 'citizen'] },
  { path: '/reports', label: 'Raporte', icon: '📋', roles: ['admin', 'health_worker', 'analyst'] },
  { path: '/users', label: 'Usera', icon: '👥', roles: ['admin'] },
  { path: '/report', label: 'Raporto Simptoma', icon: '➕', roles: ['admin', 'health_worker', 'analyst', 'citizen'] },
];

export default function Layout({ children }) {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0a0e27' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        background: '#131938',
        borderRight: '1px solid #1e2655',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #1e2655'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              🦠
            </div>
            <div>
              <h1 style={{
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '1rem'
              }}>
                EpiPrishtina
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Digital Twin</p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems
            .filter((item) => hasRole(item.roles))
            .map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                    color: isActive ? '#00d4ff' : '#9ca3af',
                    borderLeft: isActive ? '2px solid #00d4ff' : '2px solid transparent',
                    transition: 'all 0.2s',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  <span style={{ fontSize: '1.125rem' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        <div style={{
          padding: '1rem',
          borderTop: '1px solid #1e2655'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold'
            }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e8eaf6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.username}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              fontSize: '0.875rem',
              color: '#9ca3af',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              transition: 'color 0.2s'
            }}
          >
            Dilni
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '2rem' }}>{children}</div>
      </main>
    </div>
  );
}