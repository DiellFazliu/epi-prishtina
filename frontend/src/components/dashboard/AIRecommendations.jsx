import { Link } from 'react-router-dom';

const STRATEGY_LABELS = {
  movement_restriction: 'Kufizim i lëvizjes',
  venue_closures: 'Mbyllje e ambienteve',
  testing: 'Rritje e testimeve',
  remote_work: 'Punë në distancë',
  vaccination: 'Vaksinim',
  transport_restriction: 'Kufizim i transportit',
};

const IMPACT_LEVELS = {
  movement_restriction: 'high',
  testing: 'high',
  venue_closures: 'medium',
  remote_work: 'medium',
  vaccination: 'medium',
  transport_restriction: 'high',
};

export default function AIRecommendations({ recommendations, topDistrict }) {
  const impactColors = {
    high: '#ff4757',
    medium: '#ffa502',
    low: '#2ed573',
  };

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, rgba(123, 47, 247, 0.08), rgba(0, 212, 255, 0.03))',
        border: '1px solid rgba(123, 47, 247, 0.3)',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
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
          🤖 Sugjerime nga AI
        </h2>
        <span
          style={{
            padding: '0.15rem 0.5rem',
            background: 'rgba(0, 212, 255, 0.15)',
            color: '#00d4ff',
            borderRadius: '0.25rem',
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          MODEL-BASED
        </span>
      </div>

      {/* Alert */}
      {topDistrict && (
        <div
          style={{
            padding: '0.625rem 0.75rem',
            background: 'rgba(255, 71, 87, 0.1)',
            border: '1px solid rgba(255, 71, 87, 0.3)',
            borderRadius: '0.5rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1rem' }}>⚠</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                color: '#ff4757',
                fontWeight: 700,
                fontSize: '0.75rem',
                marginBottom: '0.125rem',
              }}
            >
              Rrezik i lartë: {topDistrict.district}
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
              {topDistrict.count} raporte · Kërkohet veprim
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {recommendations === null ? (
          <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
            Rekomandimet nuk janë të disponueshme.
          </p>
        ) : recommendations.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
            Nuk ka rekomandime shtesë.
          </p>
        ) : (
          recommendations.slice(0, 5).map((item) => {
            const impact = IMPACT_LEVELS[item.type] || 'medium';
            const impactColor = impactColors[impact];

            return (
              <div
                key={item.type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.625rem',
                  background: '#0a0e27',
                  borderRadius: '0.4rem',
                  border: '1px solid #1e2655',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: '0.72rem',
                    color: '#e8eaf6',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {STRATEGY_LABELS[item.type] || item.type}
                </span>
                <span
                  style={{
                    padding: '0.15rem 0.4rem',
                    background: `${impactColor}20`,
                    color: impactColor,
                    borderRadius: '0.2rem',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {impact === 'high' ? 'Lartë' : impact === 'medium' ? 'Mesëm' : 'Ulët'}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p
        style={{
          marginTop: '0.65rem',
          color: '#6b7280',
          fontSize: '0.6rem',
          lineHeight: 1.4,
        }}
      >
        Bazuar në modelin SEIR. Nuk është udhëzim klinik.
      </p>

      <Link
        to="/admin/strategy"
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: '0.5rem',
          padding: '0.5rem',
          background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
          color: 'white',
          borderRadius: '0.4rem',
          fontWeight: 600,
          fontSize: '0.75rem',
          textDecoration: 'none',
        }}
      >
        ✨ Gjenero plan masash
      </Link>
    </div>
  );
}