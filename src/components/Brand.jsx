import React from 'react';

// Marca PRC: chevron duplo (referência a sinalização rodoviária de curva/sentido)
// + wordmark. Nada de ícone genérico de caminhão de banco de imagem.
export default function Brand({ subtitle }) {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 28 L16 16 L4 4" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="square" />
        <path d="M20 28 L32 16 L20 4" fill="none" stroke="var(--amber)" strokeWidth="5" strokeLinecap="square" />
      </svg>
      <div className="brand-text">
        <span className="brand-name">PRC</span>
        {subtitle && <span className="brand-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}
