import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const [config, setConfig] = useState({
    alertThreshold: 50,
    autoRefreshInterval: 30,
    emailNotifications: true,
    soundAlerts: false,
    darkTheme: true,
    mapDefaultZoom: 13,
  });

  const handleSave = () => {
    localStorage.setItem('epiprishtina_config', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Rivendos cilësimet në vlerat e paracaktuara?')) {
      setConfig({
        alertThreshold: 50,
        autoRefreshInterval: 30,
        emailNotifications: true,
        soundAlerts: false,
        darkTheme: true,
        mapDefaultZoom: 13,
      });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#e8eaf6', marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>
          ⚙️ Cilësimet
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Konfigurimi i sistemit dhe preferencat e përdoruesit
        </p>
      </div>

      {saved && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(46, 213, 115, 0.1)',
          border: '1px solid rgba(46, 213, 115, 0.3)',
          borderRadius: '0.5rem',
          color: '#2ed573',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          ✓ Cilësimet u ruajtën me sukses
        </div>
      )}

      <div style={{ display: 'grid', gap: '1.25rem' }}>
        {/* Karta 1: Alarmet */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#e8eaf6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔔 Alarmet dhe Njoftimet
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ConfigRow
              label="Pragu i alarmit (raporte/24h)"
              description="Sa raporte kërkohen për të shfaqur një alarm"
              type="number"
              value={config.alertThreshold}
              onChange={(v) => setConfig({ ...config, alertThreshold: parseInt(v) || 0 })}
            />
            <ConfigRow
              label="Intervali i rifreskimit (sekonda)"
              description="Sa shpesh rifreskohen të dhënat automatikisht"
              type="number"
              value={config.autoRefreshInterval}
              onChange={(v) => setConfig({ ...config, autoRefreshInterval: parseInt(v) || 30 })}
            />
            <ConfigToggle
              label="Njoftime me email"
              description="Merr njoftime me email për ngjarje kritike"
              value={config.emailNotifications}
              onChange={(v) => setConfig({ ...config, emailNotifications: v })}
            />
            <ConfigToggle
              label="Alarme me tingull"
              description="Luaj tingull kur shfaqet një alarm kritik"
              value={config.soundAlerts}
              onChange={(v) => setConfig({ ...config, soundAlerts: v })}
            />
          </div>
        </div>

        {/* Karta 2: Pamja */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#e8eaf6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎨 Pamja
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ConfigToggle
              label="Temë e errët"
              description="Aktivizo temën e errët për të gjithë sistemin"
              value={config.darkTheme}
              onChange={(v) => setConfig({ ...config, darkTheme: v })}
            />
            <ConfigRow
              label="Zoom i paracaktuar i hartës"
              description="Niveli i zoom kur hap harta e Prishtinës"
              type="number"
              value={config.mapDefaultZoom}
              onChange={(v) => setConfig({ ...config, mapDefaultZoom: parseInt(v) || 13 })}
            />
          </div>
        </div>

        {/* Karta 3: Informacioni i Sistemit */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '700', color: '#e8eaf6', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ℹ️ Informacioni i Sistemit
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <InfoRow label="Versioni" value="1.0.0" />
            <InfoRow label="Përdoruesi" value={user?.username || '—'} />
            <InfoRow label="Roli" value={user?.role || '—'} />
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="Backend API" value="http://localhost:8000" />
            <InfoRow label="Frontend" value="http://localhost:5173" />
          </div>
        </div>

        {/* Butonat */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: '1px solid #1e2655',
              color: '#9ca3af',
              borderRadius: '0.5rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            ↻ Rivendos
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            💾 Ruaj Cilësimet
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, description, type, value, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e8eaf6', marginBottom: '0.125rem' }}>
          {label}
        </p>
        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {description}
        </p>
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100px',
          background: '#0a0e27',
          border: '1px solid #1e2655',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          color: 'white',
          fontSize: '0.875rem',
          textAlign: 'center',
          fontWeight: '600'
        }}
      />
    </div>
  );
}

function ConfigToggle({ label, description, value, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#e8eaf6', marginBottom: '0.125rem' }}>
          {label}
        </p>
        <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '48px',
          height: '26px',
          borderRadius: '13px',
          border: 'none',
          background: value ? 'linear-gradient(135deg, #00d4ff, #7b2ff7)' : '#1e2655',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0
        }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '3px',
          left: value ? '25px' : '3px',
          transition: 'left 0.2s'
        }} />
      </button>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      background: '#0a0e27',
      border: '1px solid #1e2655',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem'
    }}>
      <p style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: '0.875rem', color: '#e8eaf6', fontWeight: '600', wordBreak: 'break-all' }}>
        {value}
      </p>
    </div>
  );
}