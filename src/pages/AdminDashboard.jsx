import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Brand from '../components/Brand.jsx';
import { useToast } from '../components/Toast.jsx';
import AdminNav from '../components/AdminNav.jsx';
import { useAdminRole, pageAllowed } from '../hooks/useAdminRole.js';
import NewTripModal from '../components/NewTripModal.jsx';

const STAGE_LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

// Etapas sequenciais do fluxo (exclui "parada_eventual", que é uma exceção
// e não representa avanço no pipeline — ela vira um alerta no card, não uma coluna).
const SEQUENTIAL_STAGES = ['apresentacao_base_origem', 'saida_base_origem', 'chegada_base_destino'];

const COLUMNS = [
  { key: 'assigned', title: 'Atribuídas' },
  { key: 'apresentacao_base_origem', title: 'Apresentação na Origem' },
  { key: 'saida_base_origem', title: 'Em Trânsito' },
  { key: 'chegada_base_destino', title: 'Chegada no Destino' },
  { key: 'completed', title: 'Finalizadas' },
];

// Retorna a etapa sequencial mais recente da viagem (ignorando parada_eventual).
function lastSequentialStage(trip) {
  const seq = (trip.trip_stages || []).filter((s) => SEQUENTIAL_STAGES.includes(s.status));
  if (seq.length === 0) return null;
  return seq[seq.length - 1].status;
}

// Determina em qual coluna do Kanban a viagem cai.
function tripColumn(trip) {
  if (trip.status === 'assigned') return 'assigned';
  if (trip.status === 'completed') return 'completed';
  return lastSequentialStage(trip) || 'apresentacao_base_origem';
}

// Acima disso, uma viagem em andamento sem nova etapa é sinalizada como atrasada.
const LATE_THRESHOLD_MINUTES = 120;

function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}
function minutesSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}
function formatElapsed(mins) {
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `há ${h}h${m > 0 ? m + 'm' : ''}` : `há ${m}m`;
}

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({ activeDrivers: 0, activeTrips: 0, todayStages: 0, lateTrips: 0 });
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [photoUrls, setPhotoUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [, forceTick] = useState(0);
  const navigate = useNavigate();
  const { permissions } = useAdminRole();
  const [showNewTrip, setShowNewTrip] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('trip_stages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stages' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));
    return () => supabase.removeChannel(channel);
  }, []);

  // Faz os "parada Xh Ym" dos cards andarem sozinhos, sem esperar um evento novo do banco.
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(tick);
  }, []);

  async function loadData() {
    const { data: driversData } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, active, profiles(full_name, phone, cnh_validade)')
      .eq('active', true);
    setDrivers(driversData || []);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: activeTrips } = await supabase
      .from('trips').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
    const { count: todayStages } = await supabase
      .from('trip_stages').select('*', { count: 'exact', head: true }).gte('recorded_at', todayStart.toISOString());

    const { data: tripsData } = await supabase
      .from('trips')
      .select(`
        id, origin, destination, status, created_at, client_name, cargo_description, freight_value,
        drivers ( id, vehicle_plate, profiles ( full_name, phone ) ),
        trip_stages ( id, status, recorded_at, latitude, longitude, photos ( id, storage_path ) )
      `)
      .or(`status.eq.in_progress,status.eq.assigned,created_at.gte.${todayStart.toISOString()}`)
      .order('created_at', { ascending: false });

    const sorted = (tripsData || []).map((t) => ({
      ...t,
      trip_stages: [...(t.trip_stages || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)),
    }));

    const lateTrips = sorted.filter((t) => isLate(t)).length;

    setStats({
      activeDrivers: driversData?.length || 0,
      activeTrips: activeTrips || 0,
      todayStages: todayStages || 0,
      lateTrips,
    });
    setTrips(sorted);
    setLoading(false);
  }

  function isLate(trip) {
    if (trip.status !== 'in_progress') return false;
    const stages = trip.trip_stages || [];
    const reference = stages.length ? stages[stages.length - 1].recorded_at : trip.created_at;
    const mins = minutesSince(reference);
    return mins != null && mins >= LATE_THRESHOLD_MINUTES;
  }

  async function toggleExpand(tripId, stages) {
    if (expandedTrip === tripId) { setExpandedTrip(null); return; }
    setExpandedTrip(tripId);
    for (const stage of stages) {
      for (const photo of stage.photos || []) {
        if (photoUrls[photo.id]) continue;
        const { data } = await supabase.storage.from('trip-photos').createSignedUrl(photo.storage_path, 3600);
        if (data?.signedUrl) setPhotoUrls((prev) => ({ ...prev, [photo.id]: data.signedUrl }));
      }
    }
  }

  function buildWhatsAppText(trip) {
    const driverName = trip.drivers?.profiles?.full_name || 'Motorista';
    const plate = trip.drivers?.vehicle_plate || '-';
    const lines = [
      `*PRC Transportes — Viagem de ${driverName}*`,
      `Placa: ${plate}`,
      `Data: ${formatDate(trip.created_at)}`,
      `Origem: ${trip.origin || '-'}  →  Destino: ${trip.destination || '-'}`,
    ];
    if (trip.client_name) lines.push(`Cliente: ${trip.client_name}`);
    if (trip.cargo_description) lines.push(`Carga: ${trip.cargo_description}`);
    lines.push('');
    (trip.trip_stages || []).forEach((stage) => {
      lines.push(`• ${STAGE_LABELS[stage.status] || stage.status} — ${formatTime(stage.recorded_at)}`);
    });
    lines.push('');
    const statusLabel = trip.status === 'in_progress' ? 'EM ANDAMENTO' : trip.status === 'completed' ? 'FINALIZADA' : 'ATRIBUÍDA';
    lines.push(`Status: ${statusLabel}`);
    return lines.join('\n');
  }

  function sendToWhatsApp(trip) {
    const text = buildWhatsAppText(trip);
    const phone = trip.drivers?.profiles?.phone;
    const base = phone ? `https://wa.me/55${phone}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function copyToClipboard(trip) {
    const text = buildWhatsAppText(trip);
    try {
      await navigator.clipboard.writeText(text);
      toast('Texto copiado! Já pode colar no WhatsApp.', 'success');
    } catch {
      toast('Não foi possível copiar automaticamente.', 'error');
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); }

  const filteredTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) => {
      const name = (t.drivers?.profiles?.full_name || '').toLowerCase();
      const plate = (t.drivers?.vehicle_plate || '').toLowerCase();
      return name.includes(q) || plate.includes(q);
    });
  }, [trips, search]);

  function renderTripCard(trip) {
    const driverName = trip.drivers?.profiles?.full_name || 'Motorista';
    const plate = trip.drivers?.vehicle_plate || '-';
    const stages = trip.trip_stages || [];
    const lastStage = stages[stages.length - 1];
    const isExpanded = expandedTrip === trip.id;
    const late = isLate(trip);
    const elapsedMins = minutesSince(lastStage ? lastStage.recorded_at : trip.created_at);

    return (
      <div key={trip.id} className={`kanban-card status-${trip.status}${late ? ' is-late' : ''}`}>
        <div className="kanban-card-header" onClick={() => toggleExpand(trip.id, stages)}>
          <strong>{driverName}</strong>
          <span className="kanban-plate">{plate}</span>
          <div className="trip-substatus">{trip.origin} → {trip.destination}</div>
          {trip.client_name && <div className="trip-substatus">Cliente: {trip.client_name}</div>}
          {trip.freight_value != null && (
            <div className="trip-substatus">Frete: {Number(trip.freight_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          )}
          <div className="trip-substatus">
            {lastStage
              ? `Última etapa: ${STAGE_LABELS[lastStage.status] || lastStage.status} às ${formatTime(lastStage.recorded_at)}`
              : 'Sem etapas registradas'}
          </div>
          {lastStage?.status === 'parada_eventual' && (
            <span className="elapsed-badge is-late">⚠ Parada eventual registrada</span>
          )}
          {trip.status === 'in_progress' && (
            <span className={`elapsed-badge${late ? ' is-late' : ''}`}>
              {late ? '⚠ Atrasada — ' : ''}parada {formatElapsed(elapsedMins)}
            </span>
          )}
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
              <button className="secondary-button" onClick={() => copyToClipboard(trip)}>Copiar texto</button>
              <button className="primary-button" onClick={() => sendToWhatsApp(trip)}>Enviar no WhatsApp</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">
        Painel
        <span className={`rt-badge${isLive ? '' : ' rt-offline'}`}>
          <span className="rt-dot" /> {isLive ? 'Ao vivo' : 'Conectando...'}
        </span>
      </h1>

      <div className="cards">
        <div className="card"><h3>{stats.activeDrivers}</h3><p>Motoristas Ativos</p></div>
        <div className="card"><h3>{stats.activeTrips}</h3><p>Viagens em Andamento</p></div>
        <div className="card"><h3 style={stats.lateTrips > 0 ? { color: 'var(--alert)' } : undefined}>{stats.lateTrips}</h3><p>Viagens Atrasadas</p></div>
      </div>

      <div className="section-header-row">
        <h2 style={{ margin: 0 }}>Viagens</h2>
        {pageAllowed(permissions, 'nova-viagem') && (
          <button className="primary-button" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setShowNewTrip(true)}>
            + Nova Viagem
          </button>
        )}
      </div>
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          <div className="trips-toolbar">
            <input
              type="text"
              placeholder="Buscar por motorista ou placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="kanban-board">
            {COLUMNS.map((col) => {
              const colTrips = filteredTrips.filter((t) => tripColumn(t) === col.key);
              return (
                <div key={col.key} className="kanban-column">
                  <div className="kanban-column-header">
                    <span>{col.title}</span>
                    <span className="kanban-count">{colTrips.length}</span>
                  </div>
                  <div className="kanban-column-body">
                    {colTrips.length === 0 && <p className="empty-state small">Nenhuma viagem</p>}
                    {colTrips.map(renderTripCard)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2>Motoristas</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Placa</th><th>Telefone</th><th>CNH</th><th>Contato</th></tr>
        </thead>
        <tbody>
          {drivers.map((d) => {
            const cnhDate = d.profiles?.cnh_validade;
            const daysLeft = cnhDate ? Math.ceil((new Date(cnhDate).getTime() - Date.now()) / 86400000) : null;
            const cnhWarning = daysLeft != null && daysLeft <= 30;
            return (
              <tr key={d.id}>
                <td>{d.profiles?.full_name}</td>
                <td>{d.vehicle_plate}</td>
                <td>{d.profiles?.phone}</td>
                <td style={cnhWarning ? { color: 'var(--alert)', fontWeight: 700 } : undefined}>
                  {cnhDate ? new Date(cnhDate).toLocaleDateString('pt-BR') : '-'}
                  {cnhWarning && (daysLeft >= 0 ? ` (${daysLeft}d)` : ' (vencida)')}
                </td>
                <td className="contact-cell">
                  <a href={`tel:${d.profiles?.phone}`} title="Ligar">📞</a>
                  <a href={`https://wa.me/55${d.profiles?.phone}`} target="_blank" rel="noreferrer" title="WhatsApp">💬</a>
                </td>
              </tr>
            );
          })}
          {drivers.length === 0 && (
            <tr><td colSpan="5" className="empty-state">Nenhum motorista cadastrado ainda.</td></tr>
          )}
        </tbody>
      </table>

      {showNewTrip && (
        <NewTripModal
          onClose={() => setShowNewTrip(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}
