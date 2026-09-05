import React, { useState } from 'react';

// Em telas grandes, mostra a tabela normal, sem bolha nenhuma.
// Em celular, esconde a tabela e mostra uma bolha flutuante;
// tocando nela abre a tabela num painel por cima da tela.
export default function MobileTableReveal({ title, icon = '📋', offset = 0, children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="table-desktop-only">{children}</div>

      <button
        className="mobile-table-fab"
        style={{ bottom: 20 + offset }}
        onClick={() => setOpen(true)}
        aria-label={`Abrir ${title}`}
        title={title}
      >
        {icon}
      </button>

      {open && (
        <div className="modal-backdrop mobile-table-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel mobile-table-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>{title}</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="mobile-table-sheet-body">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
