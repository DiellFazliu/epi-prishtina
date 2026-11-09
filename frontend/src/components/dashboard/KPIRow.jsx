import KPICardAdvanced from './KPICardAdvanced';

export default function KPIRow({ simulationSummary, simulationHistory }) {
  const lastHistory = simulationHistory.length > 0
    ? simulationHistory[simulationHistory.length - 1]
    : null;

  const prevHistory = simulationHistory.length > 1
    ? simulationHistory[simulationHistory.length - 2]
    : null;

  // Vlerat
  const active = simulationSummary?.final?.active ?? lastHistory?.active ?? 0;
  const prevActive = prevHistory?.active ?? 0;
  const activeChange = prevActive > 0 ? active - prevActive : 0;
  const activeChangePct = prevActive > 0 ? (activeChange / prevActive) * 100 : 0;

  const recovered = lastHistory?.R ?? lastHistory?.recovered ?? 0;
  const prevRecovered = prevHistory?.R ?? prevHistory?.recovered ?? 0;
  const recoveredChange = recovered - prevRecovered;

  const deaths = simulationSummary?.final?.dead ?? lastHistory?.D ?? lastHistory?.dead ?? 0;
  const prevDeaths = prevHistory?.D ?? prevHistory?.dead ?? 0;
  const deathsChange = deaths - prevDeaths;

  const rt = lastHistory?.rt ?? 1.0;

  const hospitalLoad = lastHistory
    ? Math.min(100, Math.round(((lastHistory.H || 0) + (lastHistory.ICU || 0)) / 650 * 100))
    : 0;

  // Sparkline data (30 ditët e fundit)
  const activeSpark = simulationHistory.map((d) => d.active ?? 0);
  const recoveredSpark = simulationHistory.map((d) => d.R ?? d.recovered ?? 0);
  const deathsSpark = simulationHistory.map((d) => d.D ?? d.dead ?? 0);
  const rtSpark = simulationHistory.map((d) => d.rt ?? 1);
  const hospitalSpark = simulationHistory.map((d) => (d.H || 0) + (d.ICU || 0));

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <KPICardAdvanced
        label="Raste Aktive"
        value={active}
        change={`${activeChange >= 0 ? '+' : ''}${activeChange.toLocaleString()} (${activeChangePct.toFixed(1)}%)`}
        changeType={activeChange > 0 ? 'up' : 'down'}
        color="#ff4757"
        icon="🦠"
        sparkData={activeSpark}
      />
      <KPICardAdvanced
        label="Të Shëruar"
        value={recovered}
        change={`+${recoveredChange.toLocaleString()}`}
        changeType="down"
        color="#2ed573"
        icon="💚"
        sparkData={recoveredSpark}
      />
      <KPICardAdvanced
        label="Vdekje"
        value={deaths}
        change={`+${deathsChange}`}
        changeType="up"
        color="#6b7280"
        icon="⚰️"
        sparkData={deathsSpark}
      />
      <KPICardAdvanced
        label="R(t)"
        value={rt}
        change={rt > 1 ? 'Rritje' : 'Ulje'}
        changeType={rt > 1 ? 'up' : 'down'}
        color="#ffa502"
        icon="📈"
        sparkData={rtSpark}
        isDecimal
      />
      <KPICardAdvanced
        label="Spitalet"
        value={`${hospitalLoad}%`}
        change={hospitalLoad > 80 ? 'Kritike' : 'Normale'}
        changeType={hospitalLoad > 80 ? 'up' : 'down'}
        color={hospitalLoad > 80 ? '#ff4757' : '#00d4ff'}
        icon="🏥"
        progress={hospitalLoad}
        sparkData={hospitalSpark}
      />
    </section>
  );
}