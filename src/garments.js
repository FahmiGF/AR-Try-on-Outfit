/**
 * Garment visual generator.
 * Menghasilkan SVG transparan untuk setiap tipe pakaian, dipakai baik di
 * katalog (sebagai <img>) maupun di overlay AR (sebagai Image canvas).
 */

function clampChannel(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function shade(hex, amount) {
  const raw = String(hex || '#888888').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c) => clampChannel(c + (t - c) * p);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

const BODY = 'M112 54 L138 38 Q160 58 182 38 L208 54 L244 110 L210 128 L200 108 L200 316 Q160 330 120 316 L120 108 L110 128 L76 110 Z';

const TEMPLATES = {
  tshirt: (color) => {
    const dark = shade(color, -0.18);
    return `
      <path d="${BODY}" fill="${color}"/>
      <path d="M138 38 Q160 62 182 38 Q160 54 138 38" fill="${dark}"/>
      <path d="M120 108 L120 316 Q160 330 200 316 L200 108" fill="none" stroke="${shade(color, -0.28)}" stroke-width="2" opacity=".45"/>
      <path d="M76 110 L110 128" stroke="${shade(color, -0.3)}" stroke-width="2" opacity=".5"/>
      <path d="M244 110 L210 128" stroke="${shade(color, -0.3)}" stroke-width="2" opacity=".5"/>
      <path d="M120 316 Q160 330 200 316" fill="none" stroke="${shade(color, -0.25)}" stroke-width="3" opacity=".5"/>
    `;
  },

  polo: (color) => {
    const dark = shade(color, -0.22);
    return `
      <path d="${BODY}" fill="${color}"/>
      <path d="M138 38 L160 72 L182 38 L170 34 L160 54 L150 34 Z" fill="${dark}"/>
      <path d="M152 62 L168 62 L168 132 L152 132 Z" fill="${shade(color, -0.1)}"/>
      <circle cx="160" cy="84" r="2.4" fill="${shade(color, 0.55)}"/>
      <circle cx="160" cy="102" r="2.4" fill="${shade(color, 0.55)}"/>
      <circle cx="160" cy="120" r="2.4" fill="${shade(color, 0.55)}"/>
      <path d="M120 108 L120 316 Q160 330 200 316 L200 108" fill="none" stroke="${shade(color, -0.3)}" stroke-width="2" opacity=".35"/>
    `;
  },

  kemeja: (color) => {
    const dark = shade(color, -0.2);
    return `
      <path d="M112 54 L140 38 L160 58 L180 38 L208 54 L246 112 L212 130 L200 110 L200 316 Q160 328 120 316 L120 110 L108 130 L74 112 Z" fill="${color}"/>
      <path d="M140 38 L160 58 L146 76 L132 52 Z" fill="${shade(color, 0.28)}"/>
      <path d="M180 38 L160 58 L174 76 L188 52 Z" fill="${shade(color, 0.28)}"/>
      <path d="M160 58 L160 320" stroke="${shade(color, -0.3)}" stroke-width="2" opacity=".5"/>
      <circle cx="160" cy="92" r="2.4" fill="${shade(color, -0.35)}"/>
      <circle cx="160" cy="122" r="2.4" fill="${shade(color, -0.35)}"/>
      <circle cx="160" cy="152" r="2.4" fill="${shade(color, -0.35)}"/>
      <circle cx="160" cy="182" r="2.4" fill="${shade(color, -0.35)}"/>
      <circle cx="160" cy="212" r="2.4" fill="${shade(color, -0.35)}"/>
      <path d="M76 112 L108 130" stroke="${dark}" stroke-width="2" opacity=".5"/>
      <path d="M244 112 L212 130" stroke="${dark}" stroke-width="2" opacity=".5"/>
    `;
  },

  flannel: (color) => `
      <defs>
        <pattern id="plaid" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="transparent"/>
          <rect width="26" height="6" y="4" fill="rgba(255,255,255,.18)"/>
          <rect width="6" height="26" x="4" fill="rgba(255,255,255,.18)"/>
          <rect width="26" height="2" y="16" fill="rgba(0,0,0,.22)"/>
          <rect width="2" height="26" x="16" fill="rgba(0,0,0,.22)"/>
        </pattern>
      </defs>
      <path d="${BODY}" fill="${color}"/>
      <path d="${BODY}" fill="url(#plaid)"/>
      <path d="M140 38 L160 58 L146 76 L132 52 Z" fill="${shade(color, 0.24)}"/>
      <path d="M180 38 L160 58 L174 76 L188 52 Z" fill="${shade(color, 0.24)}"/>
      <path d="M160 58 L160 320" stroke="${shade(color, -0.35)}" stroke-width="2" opacity=".6"/>
      <circle cx="160" cy="98" r="2.2" fill="${shade(color, 0.7)}"/>
      <circle cx="160" cy="132" r="2.2" fill="${shade(color, 0.7)}"/>
      <circle cx="160" cy="166" r="2.2" fill="${shade(color, 0.7)}"/>
      <circle cx="160" cy="200" r="2.2" fill="${shade(color, 0.7)}"/>
    `,

  hoodie: (color) => {
    const dark = shade(color, -0.2);
    return `
      <path d="M124 48 Q160 52 196 48 Q184 34 160 32 Q136 34 124 48 Z" fill="${shade(color, -0.12)}"/>
      <path d="M112 54 L140 40 Q160 60 180 40 L208 54 L248 118 L214 136 L204 114 L204 312 Q160 328 116 312 L116 114 L106 136 L72 118 Z" fill="${color}"/>
      <path d="M132 46 Q160 82 188 46 Q160 60 132 46 Z" fill="${dark}"/>
      <path d="M152 74 L150 112" stroke="${shade(color, 0.55)}" stroke-width="4" stroke-linecap="round"/>
      <path d="M168 74 L170 112" stroke="${shade(color, 0.55)}" stroke-width="4" stroke-linecap="round"/>
      <path d="M128 226 L192 226 L192 284 Q160 296 128 284 Z" fill="${shade(color, -0.12)}"/>
      <path d="M116 312 Q160 328 204 312" fill="none" stroke="${shade(color, -0.3)}" stroke-width="8" opacity=".55"/>
    `;
  },

  sweater: (color) => {
    const dark = shade(color, -0.18);
    return `
      <path d="M112 54 L140 38 Q160 58 180 38 L208 54 L252 128 L214 148 L202 122 L202 310 Q160 324 118 310 L118 122 L106 148 L68 128 Z" fill="${color}"/>
      <path d="M140 38 Q160 64 180 38 Q160 50 140 38" fill="${dark}"/>
      <path d="M118 292 L118 310 Q160 324 202 310 L202 292" fill="none" stroke="${shade(color, -0.28)}" stroke-width="10" opacity=".5"/>
      <path d="M68 128 L106 148" stroke="${shade(color, -0.28)}" stroke-width="10" opacity=".5"/>
      <path d="M252 128 L214 148" stroke="${shade(color, -0.28)}" stroke-width="10" opacity=".5"/>
      <path d="M124 70 L196 70" stroke="${shade(color, -0.06)}" stroke-width="1.5" opacity=".5"/>
      <path d="M132 90 L188 90" stroke="${shade(color, -0.06)}" stroke-width="1.5" opacity=".5"/>
    `;
  },

  dress: (color) => {
    const dark = shade(color, -0.2);
    return `
      <path d="M124 54 L142 40 Q160 58 178 40 L196 54 L226 112 L198 126 L190 112 L198 168 L262 332 Q160 354 58 332 L122 168 L130 112 L122 126 L94 112 Z" fill="${color}"/>
      <path d="M142 40 Q160 66 178 40 Q160 54 142 40" fill="${dark}"/>
      <path d="M122 168 L198 168 L200 182 L120 182 Z" fill="${shade(color, -0.28)}"/>
      <path d="M160 182 L160 350" stroke="${shade(color, -0.12)}" stroke-width="2" opacity=".35"/>
      <path d="M58 332 Q160 354 262 332" fill="none" stroke="${shade(color, -0.25)}" stroke-width="3" opacity=".5"/>
      <path d="M96 114 L122 126" stroke="${dark}" stroke-width="2" opacity=".5"/>
      <path d="M224 114 L198 126" stroke="${dark}" stroke-width="2" opacity=".5"/>
    `;
  },

  jacket: (color) => {
    const dark = shade(color, -0.24);
    return `
      <path d="M112 54 L140 38 L160 62 L180 38 L208 54 L250 120 L216 138 L204 116 L204 314 L160 322 L116 314 L116 116 L104 138 L70 120 Z" fill="${dark}"/>
      <path d="M112 54 L140 38 L160 62 L160 322 L116 314 L116 116 L104 138 L70 120 Z" fill="${color}"/>
      <path d="M208 54 L180 38 L160 62 L160 322 L204 314 L204 116 L216 138 L250 120 Z" fill="${shade(color, -0.08)}"/>
      <path d="M160 62 L160 322" stroke="${shade(color, -0.45)}" stroke-width="3" stroke-dasharray="5 4" opacity=".8"/>
      <path d="M140 38 L160 62 L148 88 L128 52 Z" fill="${shade(color, 0.22)}"/>
      <path d="M180 38 L160 62 L172 88 L192 52 Z" fill="${shade(color, 0.22)}"/>
      <path d="M118 208 L140 208 L140 236 L118 236 Z" fill="${shade(color, -0.18)}" opacity=".7"/>
      <path d="M180 208 L202 208 L202 236 L180 236 Z" fill="${shade(color, -0.18)}" opacity=".7"/>
    `;
  },
};

export function garmentSVG(type, color = '#24252a') {
  const template = TEMPLATES[type] || TEMPLATES.tshirt;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" width="320" height="360">
    ${template(color)}
  </svg>`;
}

export function garmentDataUrl(type, color) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(garmentSVG(type, color))}`;
}

export function garmentAspect(type) {
  return 360 / 320;
}

export const GARMENT_TYPES = Object.keys(TEMPLATES);
