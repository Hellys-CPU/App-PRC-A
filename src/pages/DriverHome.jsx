import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle.jsx';

const STATUSES = [
  { key: 'apresentacao_base_origem', label: 'Apresentação na Base Origem', color: '#2563eb' },
  { key: 'saida_base_origem', label: 'Saída da Base Origem', color: '#059669' },
  { key: 'chegada_base_destino', label: 'Chegada na Base Destino', color: '#d97706' },
  { key: 'fim_descarga', label: 'Fim da Descarga', color: '#7c3aed' },
  { key: 'parada_eventual', label: 'Parada Eventual', color: '#dc2626' },
];

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
          <h2>Olá, {profile?.full_name || 'Motorista'}</h2>
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

      <button className="history-link" onClick={() => navigate('/historico')}>
        Ver Histórico Completo
      </button>
    </div>
  );
}
