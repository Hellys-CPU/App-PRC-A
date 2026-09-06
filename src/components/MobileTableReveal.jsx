import React from 'react';

// Desativado a pedido: tabelas voltam a aparecer normalmente na tela,
// em qualquer tamanho de tela. Mantido só pra não quebrar os imports existentes.
export default function MobileTableReveal({ children }) {
  return <>{children}</>;
}
