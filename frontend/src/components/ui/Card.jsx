export default function Card({ children, hover = false, padding = 'lg', className = '' }) {
  const paddings = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  };
  
  return (
    <div 
      className={`
        bg-white rounded-xl border border-slate-200
        ${paddings[padding]}
        ${hover ? 'transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'shadow-sm'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}