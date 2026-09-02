import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Brand from '../components/Brand.jsx';

const STATUSES = [
  { key: 'apresentacao_base_origem', label: 'Apresentação na Base Origem', color: '#4f80b8' },
  { key: 'saida_base_origem', label: 'Saída da Base Origem', color: '#3b8c6e' },
  { key: 'chegada_base_destino', label: 'Chegada na Base Destino', color: '#c97f16' },
  { key: 'fim_descarga', label: 'Fim da Descarga', color: '#6d5bb0' },
  { key: 'parada_eventual', label: 'Parada Eventual', color: '#b8492b' },
];

const PING_INTERVAL_MS = 3 * 60 * 1000; // a cada 3 minutos, enquanto o app estiver aberto

export default function DriverHome() {
  const [lastTimes, setLastTimes] = useState({});
  const [profile, setProfile] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('driver_trips_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Rastreamento por intervalo: só roda com viagem em andamento e o app aberto nesta tela.
  useEffect(() => {
    if (!trip || trip.status !== 'in_progress' || !navigator.geolocation) return;

    function sendPing() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user) return;
          await supabase.from('location_pings').insert({
            driver_id: userData.user.id,
            trip_id: trip.id,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {},
        { timeout: 8000 }
      );
    }

    sendPing();
    const interval = setInterval(sendPing, PING_INTERVAL_MS);
    return () => clearInterval(interval);
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

    // Busca a viagem atual do motorista: atribuída ou em andamento (a mais recente)
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
        .select('status, recorded_at')
        .eq('trip_id', tripData.id)
        .order('recorded_at', { ascending: false });

      const times = {};
      (data || []).forEach((row) => {
        if (!times[row.status]) times[row.status] = row.recorded_at;
      });
      setLastTimes(times);
    } else {
      setLastTimes({});
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

      {loadingTrip && <p className="empty-state">Carregando...</p>}

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

          <div className="status-buttons">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                className="status-button"
                style={{ backgroundColor: s.color }}
                onClick={() => navigate(`/camera/${s.key}`)}
              >
                <span className="status-label">{s.label}</span>
                <span className="status-time">{formatTime(lastTimes[s.key])}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="history-link" onClick={() => navigate('/chat')} style={{ marginBottom: 10 }}>
        Falar com a Central
      </button>
      <button className="history-link" onClick={() => navigate('/historico')}>
        Ver Histórico Completo
      </button>
    </div>
  );
}
