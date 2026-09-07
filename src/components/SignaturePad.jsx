import React, { useRef, useState } from 'react';

// Canvas de assinatura por toque (celular) ou mouse. Retorna um dataURL PNG
// quando o motorista confirma.
export default function SignaturePad({ onConfirm, onSkip }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }

  function start(e) {
    e.preventDefault();
    drawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#15171c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSignature(true);
  }

  function end() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function confirm() {
    if (!hasSignature) return;
    onConfirm(canvasRef.current.toDataURL('image/png'));
  }

  return (
    <div className="signature-pad-wrapper">
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 10 }}>
        Peça pro cliente assinar aqui embaixo, confirmando o recebimento da carga.
      </p>
      <canvas
        ref={canvasRef}
        width={340}
        height={180}
        className="signature-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="trip-actions" style={{ marginTop: 10 }}>
        <button type="button" className="secondary-button" onClick={clear}>Limpar</button>
        <button type="button" className="secondary-button" onClick={onSkip}>Pular</button>
        <button type="button" className="primary-button" onClick={confirm} disabled={!hasSignature}>
          Confirmar Assinatura
        </button>
      </div>
    </div>
  );
}
