import React from 'react';

// Marca oficial PRC Transportes.
export default function Brand({ subtitle }) {
  return (
    <div className="brand">
      <img src="/prc-icon.png" alt="PRC" className="brand-mark" />
      <div className="brand-text">
        <span className="brand-name">PRC</span>
        <span className="brand-tagline">transportes</span>
        {subtitle && <span className="brand-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}
