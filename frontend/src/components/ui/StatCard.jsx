export default function StatCard({ 
  label, 
  value, 
  change, 
  changeType = 'neutral',
  icon, 
  color = '#3b82f6',
  subtitle,
}) {
  const changeColors = {
    up: 'text-red-600 bg-red-50',
    down: 'text-green-600 bg-green-50',
    neutral: 'text-slate-600 bg-slate-50',
  };
  
  const displayValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value;
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
      {/* Accent bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-1" 
        style={{ background: color }}
      />
      
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      
      <div 
        className="text-3xl font-extrabold tracking-tight"
        style={{ color }}
      >
        {displayValue}
      </div>
      
      {change && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold mt-2 ${changeColors[changeType]}`}>
          {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : '•'}
          {change}
        </div>
      )}
    </div>
  );
}