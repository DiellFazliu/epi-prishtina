export default function AgeDistribution({ data }) {
  const items = data || [];
  const maxValue = Math.max(...items.map((d) => d.value), 1);

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
        📊 Shpërndarja sipas moshës
      </h2>

      {items.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '.75rem' }}>
          Nuk ka raporte me grupmoshë të regjistruar.
        </p>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.5rem',
          height: '160px',
          paddingTop: '1.5rem',
        }}
      >
        {items.map((item, i) => {
          const height = (item.value / maxValue) * 100;

          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <span
                style={{
                  fontSize: '0.65rem',
                  color: '#9ca3af',
                  fontWeight: 700,
                }}
              >
                {item.value.toLocaleString()}
              </span>
              <div
                style={{
                  width: '100%',
                  height: `${height}%`,
                  background: `linear-gradient(180deg, ${item.color}, ${item.color}80)`,
                  borderRadius: '0.25rem 0.25rem 0 0',
                  transition: 'height 0.5s ease',
                }}
              />
              <span
                style={{
                  fontSize: '0.65rem',
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                {item.range}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}