export default function ProgressBar({ 
  value, 
  max = 100, 
  color = '#3b82f6',
  showLabel = true,
  height = 6,
}) {
  const percent = Math.min((value / max) * 100, 100);
  
  return (
    <div>
      <div 
        className="w-full bg-slate-100 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${percent}%`,
            background: color,
          }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-slate-500 mt-1 text-right">
          {percent.toFixed(1)}%
        </div>
      )}
    </div>
  );
}