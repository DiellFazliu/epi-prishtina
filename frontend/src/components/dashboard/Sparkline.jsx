/**
 * Sparkline — mini chart për KPI cards.
 */

export default function Sparkline({
  data = [],
  color = '#00d4ff',
  height = 32,
  fillOpacity = 0.15,
}) {
  if (!data || data.length < 2) {
    return <div style={{ height }} />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const width = 200;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const pathLine = `M ${points.join(' L ')}`;
  const pathFill = `${pathLine} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height }}
      preserveAspectRatio="none"
    >
      <path d={pathFill} fill={color} opacity={fillOpacity} />
      <path
        d={pathLine}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}