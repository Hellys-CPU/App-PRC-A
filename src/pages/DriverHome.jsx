import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

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
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userData.user.id)
      .maybeSingle();
    setProfile(profileData);

    const { data } = await supabase
      .from('trip_stages')
      .select('status, recorded_at, trips!inner(driver_id)')
      .eq('trips.driver_id', userData.user.id)
      .order('recorded_at', { ascending: false });

    const times = {};
    (data || []).forEach((row) => {
      if (!times[row.status]) times[row.status] = row.recorded_at;
    });
    setLastTimes(times);
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
          <p className="subtitle">Toque em uma etapa para registrar</p>
        </div>
        <button className="logout-button" onClick={handleLogout}>Sair</button>
      </header>

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

      <button className="history-link" onClick={() => navigate('/historico')}>
        Ver Histórico Completo
      </button>
    </div>
  );
}
