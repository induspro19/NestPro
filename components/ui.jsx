
import React from 'react';
export const ICONS = {
  dashboard: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  materials: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  newjob: ['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M10 8l6 4-6 4V8z'],
  results: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  jobs: ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', 'M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'M9 12h6', 'M9 16h4'],
  scrap: 'M7 19H4.815a1.83 1.83 0 01-1.57-.881 1.785 1.785 0 01-.004-1.784L7.196 9.5M11 19h8.203a1.83 1.83 0 001.556-.89 1.784 1.784 0 000-1.775l-1.226-2.12M14 16l-3 3 3 3M8.293 13.596L7.196 9.5l-4.096 1.098M9.344 5.811l1.093-1.892A1.83 1.83 0 0111.985 3a1.784 1.784 0 011.546.888l3.943 6.843M13.378 9.633l4.096 1.098 1.097-4.096',
  plus: ['M12 5v14', 'M5 12h14'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  save: ['M15.2 3a2 2 0 011.4.6l3.8 3.8a2 2 0 01.6 1.4V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z', 'M17 21v-7a1 1 0 00-1-1H8a1 1 0 00-1 1v7', 'M7 3v4a1 1 0 001 1h7'],
  upload: ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  check: ['M22 11.08V12a10 10 0 11-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  warn: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  trend: ['M22 7l-9.5 9.5-5-5L1 17', 'M16 7h6v6'],
  gear: ['M20 7h-9', 'M14 17H5', 'M17 17a3 3 0 100-6 3 3 0 000 6z', 'M7 7a3 3 0 100-6 3 3 0 000 6z'],
  brain: 'M12 5a3 3 0 01-5.997 .125A3 3 0 015.003 8H5a4 4 0 000 8h.5a1.5 1.5 0 110 3H5a2 2 0 010-4 4 4 0 01-4-4V8a7 7 0 0114 0v1a3 3 0 01-3 3h-1a3 3 0 01-3-3V5z',
  x: ['M18 6L6 18', 'M6 6l12 12'],
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  zoomIn: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.35-4.35', 'M11 8v6', 'M8 11h6'],
  zoomOut: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.35-4.35', 'M8 11h6'],
  chevLeft: 'M15 18l-6-6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  rotate: ['M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  report: ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  loader: 'M21 12a9 9 0 11-6.219-8.56',
  chip: ['M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2z', 'M9 9h6v6H9z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M20 9h3', 'M20 15h3', 'M1 9h3', 'M1 15h3']
};

/* ─── Primitive UI atoms ─── */
/* ════════════════════════════════════════
   APP SHELL
════════════════════════════════════════ */
export const NAV = [{
  key: 'dashboard',
  label: 'Dashboard',
  icon: 'dashboard'
}, {
  key: 'materials',
  label: 'Material Master',
  icon: 'materials'
}, {
  key: 'standardparts',
  label: 'Standard Parts',
  icon: 'folder'
}, {
  key: 'newjob',
  label: 'New Job',
  icon: 'newjob'
}, {
  key: 'results',
  label: 'Results',
  icon: 'results'
}, {
  key: 'jobs',
  label: 'Job History',
  icon: 'jobs'
}, {
  key: 'scrap',
  label: 'Scrap Inventory',
  icon: 'scrap'
}];
/* ══════════════════════════════════════════════
   UI COMPONENTS - DARK INDUSTRIAL DESIGN
══════════════════════════════════════════════ */

/* ─── Design Tokens ─── */
export const T = {
  bg: '#080b10',
  panel: '#0e1117',
  card: '#161b24',
  cardHover: '#1c2333',
  border: '#1e2a3a',
  borderLight: '#2a3a52',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  fontBody: 'Inter, sans-serif',
  fontMono: 'JetBrains Mono, monospace',
  fontDisplay: 'Rajdhani, sans-serif'
};

/* ─── Icon Set (inline SVG paths) ─── */
export function Icon({
  d,
  size = 18,
  color = 'currentColor',
  style = {}
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>;
}
export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  size = 'md',
  icon,
  type = 'button'
}) {
  const styles = {
    primary: {
      background: T.blue,
      color: '#fff',
      border: 'none'
    },
    success: {
      background: T.green,
      color: '#fff',
      border: 'none'
    },
    danger: {
      background: T.red,
      color: '#fff',
      border: 'none'
    },
    ghost: {
      background: 'transparent',
      color: T.textDim,
      border: `1px solid ${T.border}`
    },
    dark: {
      background: T.card,
      color: T.text,
      border: `1px solid ${T.border}`
    },
    outline: {
      background: 'transparent',
      color: T.text,
      border: `1px solid ${T.border}`
    },
    accent: {
      background: T.green,
      color: '#fff',
      border: 'none'
    }
  };
  const sizes = {
    sm: 'padding:5px 10px;font-size:12px;',
    md: 'padding:8px 14px;font-size:13px;'
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={{
    ...styles[variant],
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: T.fontBody,
    fontWeight: 600,
    transition: 'opacity 0.15s',
    ...Object.fromEntries(sizes[size].split(';').filter(Boolean).map(s => {
      const [k, v] = s.split(':');
      return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v?.trim()];
    }))
  }}>
      {icon && <Icon d={ICONS[icon]} size={size === 'sm' ? 13 : 15} color="currentColor" />}
      {children}
    </button>;
}
export function Card({
  children,
  style = {}
}) {
  return <div style={{
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '1.25rem',
    ...style
  }}>{children}</div>;
}
export function Badge({
  children,
  color = T.blue
}) {
  return <span style={{
    background: `${color}20`,
    color,
    border: `1px solid ${color}40`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    fontFamily: T.fontMono
  }}>{children}</span>;
}
export function Input(props) {
  return <input {...props} style={{
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 13,
    color: T.text,
    width: '100%',
    fontFamily: T.fontMono,
    outline: 'none',
    ...props.style
  }} />;
}
export function Select(props) {
  return <select {...props} style={{
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 13,
    color: T.text,
    width: '100%',
    fontFamily: T.fontBody,
    outline: 'none',
    ...props.style
  }} />;
}
export function Field({
  label,
  children,
  hint
}) {
  return <label style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 5
  }}>
      <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: T.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }}>{label}</span>
      {children}
      {hint && <span style={{
      fontSize: 11,
      color: T.textMuted
    }}>{hint}</span>}
    </label>;
}
export function SectionHeader({
  eyebrow,
  title,
  action
}) {
  return <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem'
  }}>
      <div>
        {eyebrow && <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.blue,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 4
      }}>{eyebrow}</div>}
        <h2 style={{
        fontFamily: T.fontDisplay,
        fontSize: 26,
        fontWeight: 700,
        color: T.text,
        margin: 0,
        letterSpacing: '0.03em'
      }}>{title}</h2>
      </div>
      {action}
    </div>;
}
export function EmptyState({
  title,
  body,
  action
}) {
  return <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
    padding: '3rem 1rem'
  }}>
      <div style={{
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: T.panel,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
        <Icon d={ICONS.warn} size={20} color={T.textMuted} />
      </div>
      <div>
        <div style={{
        fontWeight: 600,
        color: T.text,
        marginBottom: 4
      }}>{title}</div>
        <div style={{
        fontSize: 13,
        color: T.textMuted,
        maxWidth: 320
      }}>{body}</div>
      </div>
      {action}
    </div>;
}
export function Modal({
  title,
  children,
  onClose,
  wide
}) {
  return <div onClick={onClose} style={{
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)'
  }}>
      <div onClick={e => e.stopPropagation()} style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '1.5rem',
      maxHeight: '90vh',
      overflowY: 'auto',
      width: '100%',
      maxWidth: wide ? 760 : 560,
      boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
    }}>
        <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem'
      }}>
          <h3 style={{
          fontFamily: T.fontDisplay,
          fontSize: 20,
          fontWeight: 700,
          color: T.text,
          margin: 0
        }}>{title}</h3>
          <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: T.textMuted
        }}><Icon d={ICONS.x} size={18} /></button>
        </div>
        {children}
      </div>
    </div>;
}

/* ─── Stat Card ─── */
export function StatCard({
  label,
  value,
  sub,
  color = T.blue,
  icon
}) {
  return <Card>
      <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12
    }}>
        <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
      }}>{label}</span>
        {icon && <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${color}20`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}><Icon d={ICONS[icon]} size={15} color={color} /></div>}
      </div>
      <div style={{
      fontFamily: T.fontDisplay,
      fontSize: 28,
      fontWeight: 700,
      color,
      letterSpacing: '0.03em'
    }}>{value}</div>
      {sub && <div style={{
      fontSize: 12,
      color: T.textMuted,
      marginTop: 4
    }}>{sub}</div>}
    </Card>;
}

/* ─── Utilization Arc ─── */
export function UtilArc({
  pct,
  size = 120
}) {
  const r = 44,
    cx = 60,
    cy = 60,
    circumference = 2 * Math.PI * r;
  const color = pct >= 80 ? T.green : pct >= 60 ? T.orange : T.red;
  const dash = pct / 100 * circumference * 0.75;
  return <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={10} strokeDasharray={circumference * 0.75} strokeDashoffset={0} transform="rotate(135 60 60)" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeDasharray={`${dash} ${circumference}`} strokeDashoffset={0} transform="rotate(135 60 60)" strokeLinecap="round" style={{
      transition: 'stroke-dasharray 0.6s ease'
    }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={20} fontWeight={700} fontFamily={T.fontDisplay}>{Math.round(pct)}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={T.textMuted} fontSize={10} fontFamily={T.fontBody}>Utilization</text>
    </svg>;
}

/* ════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════ */
