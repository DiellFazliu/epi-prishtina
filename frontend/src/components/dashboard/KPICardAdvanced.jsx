import Sparkline from './Sparkline';

export default function KPICardAdvanced({
  label,
  value,
  change,
  changeType = 'neutral',
  color = '#00d4ff',
  icon,
  sparkData = [],
  progress = null,
  suffix = '',
  isDecimal = false,
}) {
  const changeColors = {
    up: '#ff4757',
    down: '#2ed573',
    neutral: '#9ca3af',
  };

  const displayValue = () => {
    if (value === null || value === undefined || value === '—') return '—';
    if (typeof value === 'number' && !isDecimal) return value.toLocaleString();
    if (typeof value === 'number' && isDecimal) return value.toFixed(2);
    return value;
  };

  return (
    <div
      style={{
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minHeight: '130px',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: color,
          opacity: 0.7,
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {icon && <span style={{ fontSize: '1rem' }}>{icon}</span>}
          <span
            style={{
              fontSize: '0.65rem',
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        </div>
        {change && (
          <span
            style={{
              fontSize: '0.65rem',
              color: changeColors[changeType],
              fontWeight: 700,
            }}
          >
            {change}
          </span>
        )}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {displayValue()}
        {suffix && (
          <span style={{ fontSize: '1rem', color: '#9ca3af', marginLeft: '0.25rem' }}>
            {suffix}
          </span>
        )}
      </div>

      {/* Sparkline ose progress */}
      {sparkData.length > 0 && (
        <div style={{ marginTop: 'auto' }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}

      {progress !== null && (
        <div style={{ marginTop: 'auto' }}>
          <div
            style={{
              height: '6px',
              background: '#1e2655',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                background: color,
                borderRadius: '3px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div
            style={{
              fontSize: '0.65rem',
              color: '#9ca3af',
              marginTop: '0.25rem',
              textAlign: 'right',
            }}
          >
            {Math.round(progress)}% kapaciteti
          </div>
        </div>
      )}
    </div>
  );
}