import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const STAGE_LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

function formatTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({ activeDrivers: 0, activeTrips: 0, todayStages: 0 });
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [photoUrls, setPhotoUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('trip_stages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stages' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    const { data: driversData } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, active, profiles(full_name, phone)')
      .eq('active', true);
    setDrivers(driversData || []);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: activeTrips } = await supabase
      .from('trips').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');

    const { count: todayStages } = await supabase
      .from('trip_stages').select('*', { count: 'exact', head: true }).gte('recorded_at', todayStart.toISOString());

    setStats({ activeDrivers: driversData?.length || 0, activeTrips: activeTrips || 0, todayStages: todayStages || 0 });

    // Busca viagens de hoje (ou em andamento) com motorista e etapas + fotos
    const { data: tripsData } = await supabase
      .from('trips')
      .select(`
        id, origin, destination, status, created_at,
        drivers ( id, vehicle_plate, profiles ( full_name, phone ) ),
        trip_stages (
          id, status, recorded_at, latitude, longitude,
          photos ( id, storage_path )
        )
      `)
      .or(`status.eq.in_progress,created_at.gte.${todayStart.toISOString()}`)
      .order('created_at', { ascending: false });

    const sorted = (tripsData || []).map((t) => ({
      ...t,
      trip_stages: [...(t.trip_stages || [])].sort(
        (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
      ),
    }));

    setTrips(sorted);
    setLoading(false);
  }

  async function toggleExpand(tripId, stages) {
    if (expandedTrip === tripId) {
      setExpandedTrip(null);
      return;
    }
    setExpandedTrip(tripId);

    // Gera signed URLs pras fotos dessa viagem que ainda não tem URL carregada
    for (const stage of stages) {
      for (const photo of stage.photos || []) {
        if (photoUrls[photo.id]) continue;
        const { data } = await supabase.storage
          .from('trip-photos')
          .createSignedUrl(photo.storage_path, 3600);
        if (data?.signedUrl) {
          setPhotoUrls((prev) => ({ ...prev, [photo.id]: data.signedUrl }));
        }
      }
    }
  }

  function buildWhatsAppText(trip) {
    const driverName = trip.drivers?.profiles?.full_name || 'Motorista';
    const plate = trip.drivers?.vehicle_plate || '-';
    const dateLabel = formatDate(trip.created_at);
    const lines = [
      `*Viagem — ${driverName}*`,
      `Placa: ${plate}`,
      `Data: ${dateLabel}`,
      `Origem: ${trip.origin || '-'}  →  Destino: ${trip.destination || '-'}`,
      '',
    ];
    (trip.trip_stages || []).forEach((stage) => {
      const label = STAGE_LABELS[stage.status] || stage.status;
      lines.push(`• ${label} — ${formatTime(stage.recorded_at)}`);
    });
    lines.push('');
    lines.push(trip.status === 'in_progress' ? 'Status: EM ANDAMENTO' : 'Status: FINALIZADA');
    return lines.join('\n');
  }

  function sendToWhatsApp(trip) {
    const text = buildWhatsAppText(trip);
    const phone = trip.drivers?.profiles?.phone;
    const base = phone ? `https://wa.me/55${phone}` : 'https://wa.me/';
    const url = `${base}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  async function copyToClipboard(trip) {
    const text = buildWhatsAppText(trip);
    try {
      await navigator.clipboard.writeText(text);
      alert('Texto copiado! Já pode colar no WhatsApp.');
    } catch {
      alert('Não foi possível copiar automaticamente. Copie manualmente:\n\n' + text);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Painel Administrativo</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/motoristas')}>Motoristas</button>
          <button className="logout-button" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <div className="cards">
        <div className="card"><h3>{stats.activeDrivers}</h3><p>Motoristas Ativos</p></div>
        <div className="card"><h3>{stats.activeTrips}</h3><p>Viagens em Andamento</p></div>
        <div className="card"><h3>{stats.todayStages}</h3><p>Registros Hoje</p></div>
      </div>

      <h2>Viagens de Hoje</h2>
      {loading && <p className="empty-state">Carregando...</p>}
      {!loading && trips.length === 0 && (
        <p className="empty-state">Nenhuma viagem registrada hoje ainda.</p>
      )}

      <div className="trips-list">
        {trips.map((trip) => {
          const driverName = trip.drivers?.profiles?.full_name || 'Motorista';
          const plate = trip.drivers?.vehicle_plate || '-';
          const stages = trip.trip_stages || [];
          const lastStage = stages[stages.length - 1];
          const isExpanded = expandedTrip === trip.id;

          return (
            <div key={trip.id} className={`trip-card ${trip.status === 'in_progress' ? 'trip-active' : 'trip-done'}`}>
              <div className="trip-card-header" onClick={() => toggleExpand(trip.id, stages)}>
                <div>
                  <strong>{driverName}</strong> — {plate}
                  <div className="trip-substatus">
                    {lastStage
                      ? `Última etapa: ${STAGE_LABELS[lastStage.status] || lastStage.status} às ${formatTime(lastStage.recorded_at)}`
                      : 'Sem etapas registradas'}
                  </div>
                </div>
                <span className={`trip-badge ${trip.status === 'in_progress' ? 'badge-active' : 'badge-done'}`}>
                  {trip.status === 'in_progress' ? 'Em andamento' : 'Finalizada'}
                </span>
              </div>

              {isExpanded && (
                <div className="trip-card-body">
                  <div className="stages-timeline">
                    {stages.length === 0 && <p className="empty-state">Nenhuma etapa registrada.</p>}
                    {stages.map((stage) => {
                      const photo = stage.photos?.[0];
                      return (
                        <div key={stage.id} className="stage-row">
                          <div className="stage-info">
                            <strong>{STAGE_LABELS[stage.status] || stage.status}</strong>
                            <span>{formatTime(stage.recorded_at)}</span>
                          </div>
                          {photo && photoUrls[photo.id] && (
                            <img src={photoUrls[photo.id]} alt="Registro" className="stage-photo" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="trip-actions">
                    <button className="secondary-button" onClick={() => copyToClipboard(trip)}>
                      Copiar texto
                    </button>
                    <button className="primary-button" onClick={() => sendToWhatsApp(trip)}>
                      Enviar no WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h2>Motoristas</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Placa</th><th>Telefone</th><th>Contato</th></tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id}>
              <td>{d.profiles?.full_name}</td>
              <td>{d.vehicle_plate}</td>
              <td>{d.profiles?.phone}</td>
              <td className="contact-cell">
                <a href={`tel:${d.profiles?.phone}`} title="Ligar">📞</a>
                <a href={`https://wa.me/55${d.profiles?.phone}`} target="_blank" rel="noreferrer" title="WhatsApp">💬</a>
              </td>
            </tr>
          ))}
          {drivers.length === 0 && (
            <tr><td colSpan="4" className="empty-state">Nenhum motorista cadastrado ainda.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
