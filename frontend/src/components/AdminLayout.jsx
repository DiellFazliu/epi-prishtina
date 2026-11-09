import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WebSocketStatus from './WebSocketStatus';

const navSections = [
  {
    title: 'KONTROLLI',
    items: [
      { path: '/admin/overview', label: 'Command Center', icon: '📊' },
      { path: '/admin/simulation', label: 'Simulim & AI', icon: '🧠' },
      { path: '/admin/map', label: 'Harta Live', icon: '🗺️' },
    ],
  },
  {
    title: 'VEPRIMI',
    items: [
      { path: '/admin/operations', label: 'Operacionet', icon: '🚑' },
    ],
  },
  {
    title: 'INTELIGJENCA',
    items: [
      { path: '/admin/intelligence', label: 'Analiza & ML', icon: '📈' },
    ],
  },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const hasAccess = (item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0a0e27' }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={{
        width: '260px',
        background: '#131938',
        borderRight: '1px solid #1e2655',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1e2655' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.625rem',
              background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)'
            }}>🦠</div>
            <div>
              <h1 style={{
                fontWeight: '800',
                fontSize: '1.05rem',
                background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em'
              }}>EpiPrishtina</h1>
              <p style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Admin Panel
              </p>
            </div>
          </div>
        </div>

        {/* Navigation me Seksione */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
          {navSections.map((section) => {
            const visibleItems = section.items.filter(hasAccess);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} style={{ marginBottom: '1.25rem' }}>
                <p style={{
                  fontSize: '0.65rem',
                  color: '#4b5563',
                  fontWeight: '700',
                  letterSpacing: '0.1em',
                  padding: '0 0.75rem',
                  marginBottom: '0.5rem'
                }}>
                  {section.title}
                </p>

                {visibleItems.map((item) => {
                  const isActive = location.pathname.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.5rem',
                        textDecoration: 'none',
                        background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                        color: isActive ? '#00d4ff' : '#9ca3af',
                        borderLeft: isActive ? '2px solid #00d4ff' : '2px solid transparent',
                        transition: 'all 0.15s',
                        fontSize: '0.825rem',
                        fontWeight: isActive ? '600' : '500',
                        marginBottom: '0.125rem'
                      }}
                    >
                      <span style={{ fontSize: '1.05rem' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid #1e2655' }}>
          <WebSocketStatus />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '0.825rem',
                fontWeight: '600',
                color: '#e8eaf6',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user?.full_name || user?.username}
              </p>
              <p style={{
                fontSize: '0.7rem',
                color: '#00d4ff',
                textTransform: 'uppercase',
                fontWeight: '600',
                letterSpacing: '0.05em'
              }}>
                {user?.role}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%',
              fontSize: '0.8rem',
              color: '#9ca3af',
              background: 'transparent',
              border: '1px solid #1e2655',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s',
              fontWeight: '500'
            }}
            onMouseOver={(e) => {
              e.target.style.background = 'rgba(255, 71, 87, 0.1)';
              e.target.style.borderColor = 'rgba(255, 71, 87, 0.3)';
              e.target.style.color = '#ff4757';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.borderColor = '#1e2655';
              e.target.style.color = '#9ca3af';
            }}
          >
            🚪 Dilni
          </button>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <div style={{ padding: '1.75rem' }}>{children}</div>
      </main>
    </div>
  );
}