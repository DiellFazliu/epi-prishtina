/**
 * ScenarioComparison — Krahasimi i skenarëve A/B/C.
 * 
 * Shfaq vetëm projeksionet që vijnë nga simulimi live.
 */

export default function ScenarioComparison({ scenarios }) {
  const items = scenarios || [];

  return (
    <div
      style={{
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
      }}
    >
      <h2
        style={{
          fontSize: '0.9rem',
          fontWeight: 700,
          color: '#e8eaf6',
          marginBottom: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        ⚙️ Krahasimi i Skenarëve
      </h2>

      {items.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '.75rem' }}>
          Nuk ka projeksion të disponueshëm nga simulimi aktiv.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {items.map((sc) => (
          <div
            key={sc.key}
            style={{
              background: '#0a0e27',
              border: `1px solid ${sc.color}40`,
              borderRadius: '0.5rem',
              padding: '0.875rem',
              position: 'relative',
            }}
          >
            {sc.recommended && (
              <span
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  fontSize: '0.9rem',
                }}
              >
                ✓
              </span>
            )}

            <p
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: sc.color,
                marginBottom: '0.25rem',
              }}
            >
              {sc.label}
            </p>
            <p
              style={{
                fontSize: '0.65rem',
                color: '#6b7280',
                marginBottom: '0.75rem',
                lineHeight: 1.3,
              }}
            >
              {sc.subtitle}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <MetricRow label="Raste aktive (piku)" value={sc.peak.toLocaleString()} />
              <MetricRow label="Raste të reja" value={(sc.newCases ?? 0).toLocaleString()} />
              <MetricRow label="R(t) në fund" value={sc.rt ?? '—'} />
              <MetricRow label="Vdekje totale" value={sc.deaths.toLocaleString()} />
              <MetricRow
                label="Pjesë e popullsisë aktive"
                value={`${sc.overload ?? 0}%`}
                valueColor={
                  sc.overload > 80
                    ? '#ff4757'
                    : sc.overload > 60
                    ? '#ffa502'
                    : '#2ed573'
                }
              />
            </div>

            <div
              style={{
                height: '4px',
                background: '#1e2655',
                borderRadius: '2px',
                overflow: 'hidden',
                marginTop: '0.75rem',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${sc.overload}%`,
                  background: sc.color,
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value, valueColor }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.7rem',
      }}
    >
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span
        style={{
          color: valueColor || '#e8eaf6',
          fontWeight: 700,
          fontFamily: 'monospace',
        }}
      >
        {value}
      </span>
    </div>
  );
}