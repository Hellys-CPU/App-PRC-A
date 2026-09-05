import React from 'react';

// Mostra a foto inteira, sem cortar, por cima da tela. Clica fora ou no X pra fechar.
export default function PhotoLightbox({ src, onClose }) {
  if (!src) return null;

  return (
    <div className="modal-backdrop photo-lightbox-backdrop" onClick={onClose}>
      <button className="modal-close photo-lightbox-close" onClick={onClose} aria-label="Fechar">✕</button>
      <img
        src={src}
        alt="Foto ampliada"
        className="photo-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
