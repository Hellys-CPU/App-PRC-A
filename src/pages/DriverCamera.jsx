import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

export default function DriverCamera() {
  const { status } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    startCamera();
    requestLocation();
    return () => stopCamera();
  }, []);

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

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhotoDataUrl(dataUrl);
    stopCamera();
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
      setError('Erro ao salvar: ' + e.message);
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

      {error && <p className="error-text">{error}</p>}

      {!photoDataUrl ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="camera-preview" />
          <button className="capture-button" onClick={capturePhoto}>Tirar Foto</button>
        </>
      ) : (
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
