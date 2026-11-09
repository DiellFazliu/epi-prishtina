import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { reportsAPI } from '../../api/reports';
import client from '../../api/client';

const COLORS = ['#ff4757', '#ffa502', '#00d4ff', '#2ed573', '#7b2ff7', '#ff6348'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24);
  const [simulationHistory, setSimulationHistory] = useState([]);

  useEffect(() => {
    let mounted = true;
    client.get('/simulation/history', { params: { limit: 200 } }).then(({ data }) => {
      if (mounted) setSimulationHistory(data);
    }).catch(() => {
      if (mounted) setSimulationHistory([]);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await reportsAPI.getStatistics();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Duke u ngarkuar...</div>;
  }

  const timeSeriesData = simulationHistory.slice(-Math.min(timeRange, simulationHistory.length)).map((day) => ({
    time: `Dita ${day.day}`,
    cases: day.active ?? day.real_active ?? 0,
    recovered: day.R ?? day.recovered ?? 0,
    deaths: day.D ?? day.dead ?? 0,
  }));

  const districtData = Object.entries(stats?.by_district || {})
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const pieData = [
    { name: 'Simptoma', value: stats?.symptom || 0 },
    { name: 'Konfirmuar', value: stats?.confirmed || 0 },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            📈 Analiza & Trende
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Analiza e thelluar e të dhënave epidemiologjike
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { label: '24h', value: 24 },
            { label: '7d', value: 168 },
            { label: '30d', value: 720 },
          ].map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              style={{
                padding: '0.5rem 1rem',
                background: timeRange === range.value ? 'linear-gradient(135deg, #00d4ff, #7b2ff7)' : '#131938',
                border: timeRange === range.value ? 'none' : '1px solid #1e2655',
                borderRadius: '0.5rem',
                color: timeRange === range.value ? 'white' : '#9ca3af',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatBox label="Total Raporte" value={stats?.total || 0} color="#00d4ff" />
        <StatBox label="Simptoma" value={stats?.symptom || 0} color="#ffa502" />
        <StatBox label="Konfirmuar" value={stats?.confirmed || 0} color="#ff4757" />
        <StatBox
          label="Besueshmëria"
          value={`${((stats?.avg_reliability || 0) * 100).toFixed(0)}%`}
          color="#2ed573"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Trend Chart */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            📊 Trendi ({timeRange}h)
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2655" />
              <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
              <YAxis stroke="#6b7280" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: '#131938',
                  border: '1px solid #1e2655',
                  borderRadius: '0.5rem',
                  color: '#e8eaf6'
                }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="cases"
                name="Raste të reja"
                stroke="#ff4757"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="recovered"
                name="Të shëruar"
                stroke="#2ed573"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="deaths"
                name="Vdekje"
                stroke="#6b7280"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            🥧 Shpërndarja
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelStyle={{ fill: '#e8eaf6', fontSize: 12 }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#131938',
                  border: '1px solid #1e2655',
                  borderRadius: '0.5rem'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* District Bar Chart */}
      <div style={{
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          🏙️ Raporte sipas Lagjeve
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={districtData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2655" />
            <XAxis dataKey="name" stroke="#6b7280" fontSize={10} angle={-30} textAnchor="end" height={80} />
            <YAxis stroke="#6b7280" fontSize={10} />
            <Tooltip
              contentStyle={{
                background: '#131938',
                border: '1px solid #1e2655',
                borderRadius: '0.5rem',
                color: '#e8eaf6'
              }}
            />
            <Bar dataKey="count" name="Raporte" fill="#7b2ff7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: '#131938',
      border: '1px solid #1e2655',
      borderRadius: '0.75rem',
      padding: '1rem'
    }}>
      <p style={{
        fontSize: '0.7rem',
        color: '#9ca3af',
        textTransform: 'uppercase',
        marginBottom: '0.5rem',
        fontWeight: '600',
        letterSpacing: '0.05em'
      }}>
        {label}
      </p>
      <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
