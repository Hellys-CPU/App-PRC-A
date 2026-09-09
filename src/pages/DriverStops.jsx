import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useToast } from '../components/Toast.jsx';

export default function DriverStops() {
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);
  const pendingStopId = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data: tripData } = await supabase
      .from('trips')
      .select('id, origin, destination')
      .eq('driver_id', userData.user.id)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tripData) { setLoading(false); return; }
    setTrip(tripData);

    const { data: stopsData } = await supabase
      .from('trip_stops')
      .select('*')
      .eq('trip_id', tripData.id)
      .order('sequence', { ascending: true });

    setStops(stopsData || []);
    setLoading(false);
  }

  function openCameraFor(stopId) {
    pendingStopId.current = stopId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const stopId = pendingStopId.current;
    if (!file || !stopId) return;

    setUploadingId(stopId);

    const { data: userData } = await supabase.auth.getUser();
    const storagePath = `${userData.user.id}/${trip.id}/stops/${stopId}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from('trip-photos')
      .upload(storagePath, file, { contentType: 'image/jpeg', upsert: true });

    if (uploadErr) {
      setUploadingId(null);
      toast('Erro ao enviar foto: ' + uploadErr.message, 'error');
      return;
    }

    const { error: updateErr } = await supabase
      .from('trip_stops')
      .update({ status: 'concluida', arrived_at: new Date().toISOString(), photo_storage_path: storagePath })
      .eq('id', stopId);

    setUploadingId(null);

    if (updateErr) {
      toast('Erro ao registrar parada: ' + updateErr.message, 'error');
      return;
    }

    toast('Parada registrada!', 'success');
    loadData();
  }

  const doneCount = stops.filter((s) => s.status === 'concluida').length;
  const nextPendingIndex = stops.findIndex((s) => s.status !== 'concluida');

  return (
    <div className="driver-home">
      <header className="camera-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h3>Paradas de Entrega</h3>
      </header>

      {loading && <p className="empty-state">Carregando...</p>}
      {!loading && !trip && <p className="empty-state">Nenhuma viagem atribuída.</p>}

      {!loading && trip && (
        <>
          <p className="subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
            {doneCount} de {stops.length} paradas concluídas — registre em ordem, uma de cada vez.
          </p>

          <div className="stops-list">
            {stops.map((stop, i) => {
              const isDone = stop.status === 'concluida';
              const isNext = i === nextPendingIndex;
              return (
                <div key={stop.id} className={`stop-row${isDone ? ' stop-done' : ''}${isNext ? ' stop-next' : ''}`}>
                  <div className="stop-row-header">
                    <span className="stop-sequence">{i + 1}</span>
                    <div>
                      <strong>{stop.address}</strong>
                      {isDone && <div className="stop-meta">✓ Entregue às {new Date(stop.arrived_at).toLocaleTimeString('pt-BR')}</div>}
                      {!isDone && !isNext && <div className="stop-meta">Aguardando as anteriores</div>}
                    </div>
                  </div>
                  {isNext && (
                    <button
                      className="primary-button"
                      onClick={() => openCameraFor(stop.id)}
                      disabled={uploadingId === stop.id}
                    >
                      {uploadingId === stop.id ? 'Enviando...' : '📷 Registrar Chegada'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />

          {doneCount === stops.length && stops.length > 0 && (
            <p className="offline-notice" style={{ marginTop: 16 }}>
              ✓ Todas as paradas concluídas — volte e registre a Chegada na Base Destino pra finalizar.
            </p>
          )}
        </>
      )}
    </div>
  );
}
