export default function ResourceCapacity({ data }) {
  const items = data || [];

  return (
    <div
      style={{
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.875rem',
        }}
      >
        <h2
          style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: '#e8eaf6',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🏥 Kapaciteti i Burimeve
        </h2>
      </div>

      {items.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '.75rem' }}>
          Nuk ka alokime burimesh të regjistruara.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {items.map((item) => {
          const hasCapacity = Number.isFinite(item.total) && item.total > 0;
          const percent = hasCapacity ? (item.used / item.total) * 100 : 0;
          const color =
            percent > 80 ? '#ff4757' : percent > 60 ? '#ffa502' : '#2ed573';

          return (
            <div key={item.key || item.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.25rem',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {hasCapacity ? `${item.used.toLocaleString()}/${item.total.toLocaleString()}` : `${item.used.toLocaleString()} të alokuara`}
                </span>
              </div>
              <div
                style={{
                  height: '5px',
                  background: '#1e2655',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${hasCapacity ? Math.min(percent, 100) : 100}%`,
                    background: color,
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
              {!hasCapacity && <p style={{ color: '#6b7280', fontSize: '.62rem', marginTop: '.3rem' }}>Inventari total nuk është konfiguruar.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}