/**
 * Sistemi i Dizajnit — EpiPrishtina
 * Tema e Bardhë me Aksente Profesionale
 */

export const theme = {
  // ═══ Ngjyrat Kryesore ═══
  colors: {
    // Sfondet
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',
    backgroundTertiary: '#f1f5f9',
    backgroundCard: '#ffffff',
    
    // Teksti
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    textInverse: '#ffffff',
    
    // Kufijtë
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',
    
    // Aksentet (gradient)
    primary: '#3b82f6',        // Blu
    primaryDark: '#1e40af',
    primaryLight: '#dbeafe',
    
    // Statuset
    critical: '#dc2626',       // E kuqe
    criticalLight: '#fee2e2',
    warning: '#ea580c',        // Portokalli
    warningLight: '#ffedd5',
    success: '#16a34a',        // Jeshile
    successLight: '#dcfce7',
    info: '#0891b2',           // Cyan
    infoLight: '#cffafe',
    
    // Ngjyrat e algoritmeve
    algorithm: '#7c3aed',      // Purple
    algorithmLight: '#ede9fe',
    
    // Neutral
    gray: '#64748b',
    grayLight: '#f1f5f9',
  },
  
  // ═══ Hapësira ═══
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  
  // ═══ Kufijtë e Rrumbullakosjes ═══
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  
  // ═══ Hijet ═══
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    glow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  },
  
  // ═══ Tipografia ═══
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', monospace",
    
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  
  // ═══ Tranzicionet ═══
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms ease',
  },
};

// ═══ Stile të Gatshme ═══

export const card = {
  background: theme.colors.backgroundCard,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.lg,
  padding: theme.spacing.lg,
  boxShadow: theme.shadows.sm,
};

export const cardHover = {
  ...card,
  transition: `all ${theme.transitions.base}`,
  cursor: 'pointer',
};

export const buttonPrimary = {
  background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.algorithm})`,
  color: theme.colors.textInverse,
  border: 'none',
  borderRadius: theme.radius.md,
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.semibold,
  cursor: 'pointer',
  transition: `all ${theme.transitions.base}`,
};

export const buttonSecondary = {
  background: theme.colors.background,
  color: theme.colors.textPrimary,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
  fontSize: theme.typography.sizes.sm,
  fontWeight: theme.typography.weights.medium,
  cursor: 'pointer',
  transition: `all ${theme.transitions.base}`,
};

export const input = {
  width: '100%',
  background: theme.colors.background,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  fontSize: theme.typography.sizes.sm,
  color: theme.colors.textPrimary,
  outline: 'none',
  transition: `all ${theme.transitions.fast}`,
};

// ═══ Funksione Ndihmëse ═══

export const getStatusColor = (status) => {
  const map = {
    critical: theme.colors.critical,
    high: theme.colors.warning,
    medium: theme.colors.info,
    low: theme.colors.success,
    minimal: theme.colors.gray,
    validated: theme.colors.success,
    pending: theme.colors.warning,
    rejected: theme.colors.critical,
  };
  return map[status?.toLowerCase()] || theme.colors.gray;
};

export const getHealthColor = (state) => {
  const map = {
    S: theme.colors.success,
    E: theme.colors.warning,
    I_mild: '#f97316',
    I_severe: theme.colors.critical,
    H: '#b91c1c',
    ICU: '#7f1d1d',
    R: theme.colors.info,
    D: theme.colors.gray,
  };
  return map[state] || theme.colors.gray;
};