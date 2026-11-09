export default function Button({ 
  children, 
  variant = 'primary', 
  onClick, 
  disabled = false,
  icon,
  fullWidth = false,
  size = 'md',
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  
  const variants = {
    primary: 'text-white bg-gradient-to-br from-blue-500 to-violet-600 hover:shadow-lg',
    secondary: 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
    danger: 'text-white bg-red-600 hover:bg-red-700',
    success: 'text-white bg-green-600 hover:bg-green-700',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-semibold
        transition-all
        ${sizes[size]}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}