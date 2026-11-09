import { useState, useEffect } from 'react';
import client from '../../api/client';

export default function RLEmergencyPage() {
  const [recommendation, setRecommendation] = useState(null);
  const [history, setHistory] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState(null);

  const ACTION_LABELS = {
    no_action: { label: 'Pa Veprim', icon: '⏸️', color: '#6b7280' },
    deploy_ambulance: { label: 'Dërgo Ambulancë', icon: '🚑', color: '#ff4757' },
    deploy_testing: { label: 'Rrit Testimet', icon: '🧪', color: '#ffa502' },
    restrict_movement: { label: 'Kufizo Lëvizjen', icon: '🛡️', color: '#00d4ff' },
    vaccinate: { label: 'Vaksino', icon: '💉', color: '#2ed573' },
  };

  const loadRecommendation = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/rl/recommend');
      setRecommendation(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Modeli RL nuk është gati. Trajnoje me: python -m src.rl.emergency_controller --train');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadRecommendation();
    });
  }, []);

  const runSimulation = async () => {
    setSimulating(true);
    setError(null);
    try {
      const { data } = await client.post('/rl/simulate', null, {
        params: { days: 30 },
      });
      setSimulation(data);
      setHistory(data.history || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Simulimi dështoi');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{
          width: '3rem', height: '3rem',
          border: '4px solid #1e2655', borderTopColor: '#7b2ff7',
          borderRadius: '50%', animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#e8eaf6', marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>
          🧠 AI Kontrollues Emergjent
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Reinforcement Learning (PPO) për politikën optimale të reagimit
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem',
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          borderRadius: '0.5rem',
          color: '#ff4757', fontSize: '0.875rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Recommendation Card */}
      {recommendation && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(123, 47, 247, 0.15), rgba(0, 212, 255, 0.05))',
          border: '1px solid rgba(123, 47, 247, 0.4)',
          borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
                Rekomandimi i AI për Ditën {recommendation.day}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '2.5rem' }}>
                  {ACTION_LABELS[recommendation.action]?.icon || '🤖'}
                </span>
                <h2 style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  color: ACTION_LABELS[recommendation.action]?.color || '#00d4ff',
                }}>
                  {ACTION_LABELS[recommendation.action]?.label || recommendation.action}
                </h2>
              </div>
            </div>
            <div style={{
              padding: '0.5rem 1rem',
              background: 'rgba(46, 213, 115, 0.15)',
              border: '1px solid rgba(46, 213, 115, 0.3)',
              borderRadius: '0.5rem',
              fontSize: '0.75rem', color: '#2ed573', fontWeight: 700,
            }}>
              Confidence: {(recommendation.confidence * 100).toFixed(0)}%
            </div>
          </div>

          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            {recommendation.reasoning}
          </p>

          <div style={{
            padding: '0.75rem 1rem',
            background: '#0a0e27', borderRadius: '0.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Reduktim i pritur:</span>
            <span style={{ color: '#2ed573', fontSize: '1rem', fontWeight: 800 }}>
              ↓ {recommendation.expected_reduction.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={loadRecommendation}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#131938', border: '1px solid #1e2655',
            borderRadius: '0.5rem', color: '#e8eaf6',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
          }}
        >
          ↻ Rifresko Rekomandimin
        </button>
        <button
          onClick={runSimulation}
          disabled={simulating}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            border: 'none', borderRadius: '0.5rem', color: 'white',
            fontWeight: 700, cursor: simulating ? 'wait' : 'pointer',
            fontSize: '0.875rem', opacity: simulating ? 0.6 : 1,
          }}
        >
          {simulating ? '⏳ Duke simuluar 30 ditë...' : '▶ Simulo 30 Ditë me RL'}
        </button>
      </div>

      {/* Simulation Results */}
      {simulation && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <SummaryCard label="Ditë të Simuluara" value={simulation.days_simulated} color="#00d4ff" icon="📅" />
            <SummaryCard label="Vdekje Totale" value={simulation.total_deaths} color="#ff4757" icon="⚰️" />
            <SummaryCard
              label="Veprimi Kryesor"
              value={Object.entries(simulation.actions_summary).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'}
              color="#7b2ff7"
              icon="🎯"
              isAction
            />
          </div>

          {/* Actions Summary */}
          <div style={{
            background: '#131938', border: '1px solid #1e2655',
            borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8eaf6', marginBottom: '1rem' }}>
              📊 Shpërndarja e Veprimeve
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {Object.entries(simulation.actions_summary).map(([action, count]) => {
                const info = ACTION_LABELS[action] || { label: action, icon: '❓', color: '#6b7280' };
                return (
                  <div key={action} style={{
                    padding: '0.75rem',
                    background: '#0a0e27',
                    border: `1px solid ${info.color}40`,
                    borderRadius: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{info.icon}</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: info.color }}>
                        {count}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                      {info.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* History Table */}
          <div style={{
            background: '#131938', border: '1px solid #1e2655',
            borderRadius: '0.75rem', overflow: 'hidden',
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e2655' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8eaf6' }}>
                📋 10 Ditët e Fundit
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0a0e27' }}>
                  <th style={thStyle}>Dita</th>
                  <th style={thStyle}>Veprimi</th>
                  <th style={thStyle}>Aktivë</th>
                  <th style={thStyle}>Raste të Reja</th>
                  <th style={thStyle}>Vdekje</th>
                  <th style={thStyle}>R(t)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const info = ACTION_LABELS[item.action] || { label: item.action, icon: '❓', color: '#6b7280' };
                  return (
                    <tr key={item.day} style={{ borderBottom: '1px solid #1e2655' }}>
                      <td style={tdStyle}>{item.day}</td>
                      <td style={tdStyle}>
                        <span style={{ color: info.color, fontWeight: 600 }}>
                          {info.icon} {info.label}
                        </span>
                      </td>
                      <td style={tdStyle}>{item.active?.toLocaleString() || '—'}</td>
                      <td style={{ ...tdStyle, color: '#ffa502', fontWeight: 600 }}>
                        {item.new_cases?.toLocaleString() || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: '#ff4757', fontWeight: 600 }}>
                        {item.deaths?.toLocaleString() || '—'}
                      </td>
                      <td style={tdStyle}>{item.rt?.toFixed(2) || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.7rem', textAlign: 'center' }}>
            Ky është një skenar simulimi. Nuk është udhëzim klinik.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, icon, isAction }) {
  const displayValue = isAction ? value : (typeof value === 'number' ? value.toLocaleString() : value);
  return (
    <div style={{
      background: '#131938', border: '1px solid #1e2655',
      borderRadius: '0.75rem', padding: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize: isAction ? '1rem' : '1.75rem', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {displayValue}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '0.75rem 1rem', textAlign: 'left',
  fontSize: '0.7rem', color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700,
};

const tdStyle = {
  padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#e8eaf6',
};