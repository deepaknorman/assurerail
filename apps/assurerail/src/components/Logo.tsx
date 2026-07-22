// Inline (not <img>) so the mark inherits the app's --arail-logo-ink / --arail-logo-accent tokens,
// which respond to BOTH prefers-color-scheme AND the data-theme toggle. An <img>-loaded SVG only sees
// the OS preference, so a light-OS + dark-app-theme rendered the wordmark invisibly — this fixes that.

export function Logo({ className = "", title = "AssureRail" }: { className?: string; title?: string }) {
  return (
    <svg className={`arail-logo ${className}`} viewBox="0 0 288 64" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      {/* The Interlock */}
      <path className="mk-a" d="M22 56 H8 V8 H38 V24 H30 V36 H22 Z" />
      <path className="mk-b" d="M42 8 H56 V56 H26 V40 H34 V28 H42 Z" />
      {/* Wordmark: AssureRail (monoline paths — no font dependency) */}
      <path className="wm-f" d="M72 46 L84 17 L96 46 H91.67 L84 27.5 L76.33 46 Z M78.6 35.5 H89.4 V39.5 H78.6 Z" />
      <path className="wm-s" d="M113 30.5 V27 H102 V35.5 H113 V44 H102 V40.5" />
      <path className="wm-s" d="M135 30.5 V27 H124 V35.5 H135 V44 H124 V40.5" />
      <path className="wm-s" d="M146 25 V37.5 A6.5 6.5 0 0 0 159 37.5 V25" />
      <path className="wm-s" d="M170 25 V46 M170 34 A7 7 0 0 1 177 27 H180.5" />
      <path className="wm-s" d="M202 44 H193 A3.5 3.5 0 0 1 189.5 40.5 V30.5 A3.5 3.5 0 0 1 193 27 H199 A3.5 3.5 0 0 1 202.5 30.5 V35.5 H189.5" />
      <path className="wm-s" d="M215.5 46 V19 H223.5 A6.25 6.25 0 0 1 229.75 25.25 A6.25 6.25 0 0 1 223.5 31.5 H215.5" />
      <path className="wm-f" d="M222.5 31.5 H226.8 L232.8 46 H228.5 Z" />
      <path className="wm-s" d="M254.8 31.5 V39.5 A4.5 4.5 0 0 1 250.3 44 H246.3 A4.5 4.5 0 0 1 241.8 39.5 V31.5 A4.5 4.5 0 0 1 246.3 27 H250.3 A4.5 4.5 0 0 1 254.8 31.5 Z M254.8 25 V46" />
      <path className="wm-s" d="M265.8 25 V46" />
      <path className="wm-f" d="M263.8 17.5 H267.8 V21.5 H263.8 Z" />
      <path className="wm-s" d="M276.8 17 V46" />
    </svg>
  );
}

export function LogoMark({ className = "", title = "AssureRail" }: { className?: string; title?: string }) {
  return (
    <svg className={`arail-mark ${className}`} viewBox="0 0 64 64" role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <path className="mk-a" d="M22 56 H8 V8 H38 V24 H30 V36 H22 Z" />
      <path className="mk-b" d="M42 8 H56 V56 H26 V40 H34 V28 H42 Z" />
    </svg>
  );
}
