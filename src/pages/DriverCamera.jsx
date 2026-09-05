import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { reverseGeocode } from '../lib/geocode.js';

const LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

const ONE_TIME_STATUSES = ['apresentacao_base_origem', 'saida_base_origem', 'chegada_base_destino', 'fim_descarga'];

// Desenha a marca d'água (nome, placa(s), endereço, data/hora) direto no canvas da foto.
function drawStamp(ctx, width, height, info) {
  const fontSize = Math.max(Math.round(width * 0.024), 16);
  const lineHeight = Math.round(fontSize * 1.4);

  const lines = [`PRC Transportes — ${info.stageLabel}`];
  if (info.driverName) lines.push(`Motorista: ${info.driverName}`);
  lines.push(info.plateReboque ? `Placa: ${info.plate} / ${info.plateReboque}` : `Placa: ${info.plate || '-'}`);
  if (info.address) {
    lines.push(`Local: ${info.address}`);
  } else if (info.coords) {
    lines.push(`Local (coordenada): ${info.coords.latitude.toFixed(5)}, ${info.coords.longitude.toFixed(5)}`);
  } else {
    lines.push('Local: não disponível');
  }
  lines.push(new Date().toLocaleString('pt-BR'));

  // Quebra linhas muito longas (endereço) pra caber na largura da foto.
  const maxCharsPerLine = Math.max(Math.floor(width / (fontSize * 0.52)), 10);
  const wrapped = [];
  lines.forEach((line) => {
    let remaining = line;
    while (remaining.length > maxCharsPerLine) {
      let cut = remaining.lastIndexOf(' ', maxCharsPerLine);
      if (cut <= 0) cut = maxCharsPerLine;
      wrapped.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trim();
    }
    wrapped.push(remaining);
  });

  const boxHeight = wrapped.length * lineHeight + fontSize * 0.8;
  const gradient = ctx.createLinearGradient(0, height - boxHeight, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.28)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - boxHeight, width, boxHeight);

  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  let y = height - fontSize * 0.6;
  for (let i = wrapped.length - 1; i >= 0; i--) {
    ctx.fillText(wrapped[i], Math.round(fontSize * 0.6), y);
    y -= lineHeight;
  }
}

export default function DriverCamera() {
  const { status } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [coords, setCoords] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [stamping, setStamping] = useState(false);
  const [driverInfo, setDriverInfo] = useState(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    checkAlreadyDone();
    loadDriverInfo();
    return () => stopCamera();
  }, []);

  async function loadDriverInfo() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return;

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle();
    const { data: driver } = await supabase.from('drivers').select('vehicle_id, vehicle_plate').eq('id', uid).maybeSingle();

    let plate = driver?.vehicle_plate || '-';
    let plateReboque = null;

    if (driver?.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('plate, plate_reboque')
        .eq('id', driver.vehicle_id)
        .maybeSingle();
      if (vehicle) {
        plate = vehicle.plate;
        plateReboque = vehicle.plate_reboque;
      }
    }

    setDriverInfo({ name: profile?.full_name || 'Motorista', plate, plateReboque });
  }

  async function checkAlreadyDone() {
    if (!ONE_TIME_STATUSES.includes(status)) {
      setChecking(false);
      startCamera();
      requestLocation();
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const driverId = userData?.user?.id;
    const { data: currentTrip } = await supabase
      .from('trips')
      .select('id')
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentTrip) {
      const { data: existing } = await supabase
        .from('trip_stages')
        .select('id')
        .eq('trip_id', currentTrip.id)
        .eq('status', status)
        .maybeSingle();

      if (existing) {
        setBlocked(true);
        setChecking(false);
        return;
      }
    }

    setChecking(false);
    startCamera();
    requestLocation();
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setCoords(null),
      { timeout: 5000 }
    );
  }

  // Carimba um canvas já desenhado (seja da câmera ao vivo, seja de uma foto
  // escolhida da galeria) com nome/placa/endereço/hora, e finaliza a foto.
  async function stampCanvasAndFinish(canvas, ctx) {
    setStamping(true);

    // Endereço precisa de internet; sem conexão, cai pro fallback de coordenada
    // (definido dentro do drawStamp) sem travar o motorista.
    let address = null;
    if (coords) {
      address = await reverseGeocode(coords.latitude, coords.longitude);
    }

    drawStamp(ctx, canvas.width, canvas.height, {
      stageLabel: LABELS[status] || status,
      driverName: driverInfo?.name,
      plate: driverInfo?.plate,
      plateReboque: driverInfo?.plateReboque,
      address,
      coords,
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setStamping(false);
    setPhotoDataUrl(dataUrl);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    setFlash(true);
    setTimeout(() => setFlash(false), 350);
    stopCamera();

    await stampCanvasAndFinish(canvas, ctx);
  }

  function handleGalleryFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;

    stopCamera();
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);
      await stampCanvasAndFinish(canvas, ctx);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Não foi possível abrir essa imagem. Tente outra foto.');
    };
    img.src = objectUrl;
  }

  function retake() {
    setPhotoDataUrl(null);
    startCamera();
  }

  async function confirmAndSave() {
    setSaving(true);
    setError('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const driverId = userData.user.id;

      // Busca a viagem atribuída pelo admin (assigned) ou já em andamento.
      // O motorista NUNCA cria viagem, só o time administrativo.
      let { data: currentTrip } = await supabase
        .from('trips')
        .select('id, status')
        .eq('driver_id', driverId)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!currentTrip) {
        throw new Error('Nenhuma viagem atribuída. Aguarde o time administrativo atribuir uma viagem.');
      }

      const tripId = currentTrip.id;

      // Primeira etapa registrada muda a viagem de "assigned" para "in_progress"
      if (currentTrip.status === 'assigned') {
        await supabase.from('trips').update({ status: 'in_progress' }).eq('id', tripId);
      }

      // "Fim da Descarga" é a etapa final do fluxo: fecha a viagem automaticamente.
      if (status === 'fim_descarga') {
        await supabase.from('trips').update({ status: 'completed' }).eq('id', tripId);
      }

      const { data: stage, error: stageErr } = await supabase
        .from('trip_stages')
        .insert({
          trip_id: tripId,
          status,
          recorded_at: new Date().toISOString(),
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        })
        .select('id')
        .single();
      if (stageErr) throw stageErr;

      // Converte dataURL para blob e sobe pro Storage
      const blob = await (await fetch(photoDataUrl)).blob();
      const storagePath = `${driverId}/${tripId}/${stage.id}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('trip-photos')
        .upload(storagePath, blob, { contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;

      await supabase.from('photos').insert({ stage_id: stage.id, storage_path: storagePath });

      navigate('/');
    } catch (e) {
      const msg = String(e.message || '');
      if (msg.includes('duplicate') || msg.includes('uq_trip_stage_once')) {
        setError('Essa etapa já tinha sido registrada nesse meio tempo. Volte e confira.');
      } else {
        setError('Erro ao salvar: ' + msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="camera-screen">
      <header className="camera-header">
        <button className="back-button" onClick={() => { stopCamera(); navigate('/'); }}>← Voltar</button>
        <h3>{LABELS[status] || status}</h3>
      </header>

      {checking && <p className="empty-state">Verificando...</p>}

      {blocked && (
        <div className="no-trip-box">
          <p>Essa etapa já foi registrada nessa viagem.</p>
          <p className="subtitle">
            Se foi engano, volte e use "Desfazer última etapa" — ou peça pro time administrativo excluir e liberar de novo.
          </p>
        </div>
      )}

      {!checking && !blocked && error && <p className="error-text">{error}</p>}

      {!checking && !blocked && stamping && (
        <p className="empty-state">Adicionando informações na foto...</p>
      )}

      {!checking && !blocked && !stamping && !photoDataUrl && (
        <>
          <div className="camera-viewport">
            <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
            <div className={`camera-flash${flash ? ' active' : ''}`} />
          </div>
          <button className="capture-button" onClick={capturePhoto}>Tirar Foto</button>
          <button
            className="secondary-button gallery-button"
            onClick={() => galleryInputRef.current?.click()}
          >
            📁 Escolher da Galeria
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleGalleryFile}
          />
        </>
      )}

      {!checking && !blocked && !stamping && photoDataUrl && (
        <>
          <img src={photoDataUrl} alt="Foto capturada" className="camera-preview" />
          <div className="confirm-actions">
            <button className="secondary-button" onClick={retake} disabled={saving}>Refazer</button>
            <button className="primary-button" onClick={confirmAndSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
