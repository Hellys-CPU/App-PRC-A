import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Brand from '../components/Brand.jsx';
import { useToast } from '../components/Toast.jsx';
import { sendOrQueuePing, flushPingQueue, pendingPingCount } from '../lib/pingQueue.js';
import { SkeletonBlock } from '../components/Skeleton.jsx';

const STATUSES = [
  { key: 'apresentacao_base_origem', label: 'Apresentação na Base Origem', color: '#4f80b8' },
  { key: 'saida_base_origem', label: 'Saída da Base Origem', color: '#3b8c6e' },
  { key: 'chegada_base_destino', label: 'Chegada na Base Destino', color: '#c97f16' },
  { key: 'fim_descarga', label: 'Fim da Descarga', color: '#6d5bb0' },
  { key: 'parada_eventual', label: 'Parada Eventual', color: '#b8492b' },
];

// Etapas que só podem ser registradas uma vez por viagem (Parada Eventual pode repetir).
const ONE_TIME_STATUSES = ['apresentacao_base_origem', 'saida_base_origem', 'chegada_base_destino', 'fim_descarga'];

const PING_INTERVAL_MS = 3 * 60 * 1000; // a cada 3 minutos, enquanto o app estiver aberto

export default function DriverHome() {
  const [lastTimes, setLastTimes] = useState({});
  const [stages, setStages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [undoing, setUndoing] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('driver_trips_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stages' }, () => loadData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Rastreamento por intervalo: só roda com viagem em andamento e o app aberto nesta tela.
  const [pendingPings, setPendingPings] = useState(0);

  useEffect(() => {
    if (!trip || trip.status !== 'in_progress' || !navigator.geolocation) return;

    function sendPing() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user) return;
          await sendOrQueuePing({
            driver_id: userData.user.id,
            trip_id: trip.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setPendingPings(pendingPingCount());
        },
        () => {},
        { timeout: 8000 }
      );
    }

    async function tryFlush() {
      await flushPingQueue();
      setPendingPings(pendingPingCount());
    }

    sendPing();
    tryFlush();
    setPendingPings(pendingPingCount());

    const interval = setInterval(sendPing, PING_INTERVAL_MS);
    const flushInterval = setInterval(tryFlush, 30 * 1000);
    window.addEventListener('online', tryFlush);

    return () => {
      clearInterval(interval);
      clearInterval(flushInterval);
      window.removeEventListener('online', tryFlush);
    };
  }, [trip?.id, trip?.status]);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    const driverId = userData.user.id;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', driverId)
      .maybeSingle();
    setProfile(profileData);

    const { data: tripData } = await supabase
      .from('trips')
      .select('id, origin, destination, status, created_at')
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setTrip(tripData || null);
    setLoadingTrip(false);

    if (tripData) {
      const { data } = await supabase
        .from('trip_stages')
        .select('id, status, recorded_at')
        .eq('trip_id', tripData.id)
        .order('recorded_at', { ascending: false });

      setStages(data || []);

      const times = {};
      (data || []).forEach((row) => {
        if (!times[row.status]) times[row.status] = row.recorded_at;
      });
      setLastTimes(times);

      const { data: stopsData } = await supabase
        .from('trip_stops')
        .select('id, status')
        .eq('trip_id', tripData.id);
      setStops(stopsData || []);
    } else {
      setStages([]);
      setLastTimes({});
      setStops([]);
    }
  }

  function formatTime(iso) {
    if (!iso) return 'Sem registro ainda';
    const d = new Date(iso);
    return `Último: ${d.toLocaleString('pt-BR')}`;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function exportMyData() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user.id;

    const [{ data: profileData }, { data: tripsData }, { data: ratingsData } ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('trips').select('id, origin, destination, status, created_at, freight_value').eq('driver_id', uid),
      supabase.from('driver_ratings').select('rating, comment, created_at').eq('driver_id', uid),
    ]);

    const bundle = { perfil: profileData, viagens: tripsData, avaliacoes: ratingsData, exportado_em: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meus-dados.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const doneStatuses = new Set(stages.filter((s) => ONE_TIME_STATUSES.includes(s.status)).map((s) => s.status));
  const lastStage = stages[0]; // já vem ordenado do mais recente pro mais antigo

  async function handleUndoLast() {
    if (!lastStage) return;
    setUndoing(true);

    const { data: photoRows } = await supabase.from('photos').select('storage_path').eq('stage_id', lastStage.id);
    if (photoRows?.length) {
      await supabase.storage.from('trip-photos').remove(photoRows.map((p) => p.storage_path));
    }
    const { error } = await supabase.from('trip_stages').delete().eq('id', lastStage.id);

    setUndoing(false);

    if (error) {
      toast('Não foi possível desfazer: ' + error.message, 'error');
      return;
    }
    toast('Etapa desfeita. Pode registrar de novo.', 'success');
    loadData();
  }

  return (
    <div className="driver-home">
      <header className="driver-header">
        <div>
          <Brand />
          <h2 style={{ marginTop: 10 }}>Olá, {profile?.full_name || 'Motorista'}</h2>
          <p className="subtitle">
            {trip ? 'Toque em uma etapa para registrar' : 'Aguardando viagem'}
          </p>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <button className="logout-button" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      {loadingTrip && (
        <div style={{ padding: '0 4px' }}>
          <SkeletonBlock height={50} style={{ marginBottom: 12 }} />
          <SkeletonBlock height={70} style={{ marginBottom: 10 }} />
          <SkeletonBlock height={70} style={{ marginBottom: 10 }} />
          <SkeletonBlock height={70} />
        </div>
      )}

      {!loadingTrip && !trip && (
        <div className="no-trip-box">
          <p>Você ainda não tem nenhuma viagem atribuída.</p>
          <p className="subtitle">Aguarde o time administrativo atribuir sua próxima viagem.</p>
        </div>
      )}

      {trip && (
        <>
          <div className="current-trip-box">
            <span className="trip-route">{trip.origin} → {trip.destination}</span>
            <span className={`trip-badge ${trip.status === 'in_progress' ? 'badge-active' : 'badge-assigned'}`}>
              {trip.status === 'in_progress' ? 'Em andamento' : 'Viagem atribuída'}
            </span>
          </div>

          {pendingPings > 0 && (
            <p className="offline-notice">
              📡 Sem conexão — {pendingPings} posição(ões) guardada(s) no celular, serão enviadas quando a internet voltar.
            </p>
          )}

          <div className="status-buttons">
            {STATUSES.map((s) => {
              const isDone = doneStatuses.has(s.key);
              const stopsBlocking = s.key === 'chegada_base_destino' && stops.length > 0 && stops.some((st) => st.status !== 'concluida');
              return (
                <React.Fragment key={s.key}>
                  <button
                    className={`status-button${isDone ? ' status-done' : ''}${stopsBlocking ? ' status-blocked' : ''}`}
                    style={{ backgroundColor: isDone ? undefined : s.color }}
                    onClick={() => !isDone && !stopsBlocking && navigate(`/camera/${s.key}`)}
                    disabled={isDone || stopsBlocking}
                  >
                    <span className="status-label">
                      {isDone ? `✓ ${s.label}` : stopsBlocking ? `🔒 ${s.label}` : s.label}
                    </span>
                    <span className="status-time">
                      {stopsBlocking ? 'Conclua as paradas de entrega primeiro' : formatTime(lastTimes[s.key])}
                    </span>
                  </button>
                  {s.key === 'saida_base_origem' && stops.length > 0 && (
                    <button className="status-button stops-progress-button" onClick={() => navigate('/paradas')}>
                      <span className="status-label">
                        📍 Paradas de Entrega ({stops.filter((st) => st.status === 'concluida').length}/{stops.length})
                      </span>
                      <div className="stops-progress-bar">
                        <div
                          className="stops-progress-fill"
                          style={{ width: `${(stops.filter((st) => st.status === 'concluida').length / stops.length) * 100}%` }}
                        />
                      </div>
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {lastStage && (
            <button className="undo-link" onClick={handleUndoLast} disabled={undoing}>
              {undoing ? 'Desfazendo...' : '↩ Desfazer última etapa registrada'}
            </button>
          )}
        </>
      )}

      <button className="history-link" onClick={() => navigate('/chat')} style={{ marginBottom: 10 }}>
        Falar com a Central
      </button>
      {trip && (
        <>
          <button className="history-link" onClick={() => navigate('/checklist')} style={{ marginBottom: 10 }}>
            Checklist de Saída do Veículo
          </button>
          <button className="history-link" onClick={() => navigate('/ocorrencia')} style={{ marginBottom: 10 }}>
            Reportar Ocorrência / Avaria
          </button>
        </>
      )}
      <button className="history-link" onClick={() => navigate('/historico')}>
        Ver Histórico Completo
      </button>
      <button className="history-link" onClick={exportMyData}>
        ⬇ Baixar Meus Dados
      </button>
    </div>
  );
}
