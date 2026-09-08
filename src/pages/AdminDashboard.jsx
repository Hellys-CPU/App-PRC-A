import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Brand from '../components/Brand.jsx';
import { useToast } from '../components/Toast.jsx';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import { useAdminRole, pageAllowed } from '../hooks/useAdminRole.js';
import NewTripModal from '../components/NewTripModal.jsx';
import PhotoLightbox from '../components/PhotoLightbox.jsx';
import ResetPasswordButton from '../components/ResetPasswordButton.jsx';

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
  { key: 'assigned', title: 'Atribuídas', color: 'var(--assigned)' },
  { key: 'apresentacao_base_origem', title: 'Apresentação na Origem', color: 'var(--assigned)' },
  { key: 'saida_base_origem', title: 'Em Trânsito', color: 'var(--amber)' },
  { key: 'chegada_base_destino', title: 'Chegada no Destino', color: 'var(--amber)' },
  { key: 'completed', title: 'Finalizadas', color: 'var(--route)' },
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

// Calcula os horários planejados (Apresentação, Saída, Chegada). A apresentação
// vem da própria viagem (definida na criação); saída/chegada somam a duração da rota.
function computePlannedTimes(trip) {
  if (!trip.planned_apresentacao_at) return null;
  const route = trip.routes;

  const apresentacao = new Date(trip.planned_apresentacao_at);
  const saidaHours = Number(route?.planned_saida_after_hours) || 0;
  const chegadaHours = Number(route?.planned_chegada_after_hours) || 0;
  const saida = new Date(apresentacao.getTime() + saidaHours * 3600000);
  const chegada = new Date(saida.getTime() + chegadaHours * 3600000);

  return {
    apresentacao_base_origem: apresentacao,
    saida_base_origem: saida,
    chegada_base_destino: chegada,
  };
}

const PLANNED_STAGE_TYPES = ['apresentacao_base_origem', 'saida_base_origem', 'chegada_base_destino'];

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
  const [stats, setStats] = useState({ activeDrivers: 0, activeTrips: 0, todayStages: 0, lateTrips: 0, unbilledCompleted: 0 });
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [photoUrls, setPhotoUrls] = useState({});
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const showHistoryRef = useRef(false);
  const [isLive, setIsLive] = useState(false);
  const [, forceTick] = useState(0);
  const navigate = useNavigate();
  const { permissions, role } = useAdminRole();
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
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

  useEffect(() => {
    showHistoryRef.current = showHistory;
    loadData();
  }, [showHistory]);

  // Faz os "parada Xh Ym" dos cards andarem sozinhos, sem esperar um evento novo do banco.
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(tick);
  }, []);

  async function loadData() {
    const { data: driversData } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, active, profiles(full_name, phone, cnh_validade), driver_ratings(rating)')
      .eq('active', true);
    setDrivers(driversData || []);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: activeTrips } = await supabase
      .from('trips').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');
    const { count: todayStages } = await supabase
      .from('trip_stages').select('*', { count: 'exact', head: true }).gte('recorded_at', todayStart.toISOString());

    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select(`
        id, origin, destination, status, created_at, scheduled_date, planned_apresentacao_at, client_name, cargo_description, freight_value, internal_notes, signature_storage_path,
        drivers ( id, vehicle_plate, profiles ( full_name, phone ) ),
        routes ( planned_saida_after_hours, planned_chegada_after_hours ),
        trip_stages ( id, status, recorded_at, latitude, longitude, photos ( id, storage_path ) )
      `)
      .or(
        showHistoryRef.current
          ? 'status.eq.in_progress,status.eq.assigned,status.eq.completed'
          : `status.eq.in_progress,status.eq.assigned,created_at.gte.${todayStart.toISOString()}`
      )
      .order('created_at', { ascending: false });

    if (tripsError) {
      console.error('Erro ao carregar viagens:', tripsError);
      toast('Erro ao carregar viagens: ' + tripsError.message, 'error');
    }

    const sorted = (tripsData || []).map((t) => ({
      ...t,
      trip_stages: [...(t.trip_stages || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)),
    }));

    const lateTrips = sorted.filter((t) => isLate(t)).length;

    // Só quem tem acesso ao Financeiro vê esse número (RLS já protege o dado,
    // isso aqui é só pra não mostrar "0" enganoso pra quem nem teria acesso).
    let unbilledCompleted = 0;
    if (role === 'diretoria' || role === 'financeiro') {
      const { data: completedTrips } = await supabase
        .from('trips')
        .select('id, financial_entries(entry_type)')
        .eq('status', 'completed')
        .not('client_id', 'is', null);
      unbilledCompleted = (completedTrips || []).filter(
        (t) => !(t.financial_entries || []).some((f) => f.entry_type === 'receivable_client')
      ).length;
    }

    setStats({
      activeDrivers: driversData?.length || 0,
      activeTrips: activeTrips || 0,
      todayStages: todayStages || 0,
      lateTrips,
      unbilledCompleted,
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
    loadDocuments(tripId);
  }

  async function loadDocuments(tripId) {
    const { data } = await supabase
      .from('trip_documents')
      .select('id, storage_path, file_name, created_at')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    setDocuments((prev) => ({ ...prev, [tripId]: data || [] }));
  }

  async function handleDocumentUpload(tripId, file) {
    if (!file) return;
    const { data: userData } = await supabase.auth.getUser();
    const storagePath = `${userData.user.id}/docs/${tripId}/${Date.now()}-${file.name}`;

    const { error: uploadErr } = await supabase.storage.from('trip-photos').upload(storagePath, file);
    if (uploadErr) {
      toast('Erro ao enviar documento: ' + uploadErr.message, 'error');
      return;
    }

    const { error: insertErr } = await supabase.from('trip_documents').insert({
      trip_id: tripId,
      storage_path: storagePath,
      file_name: file.name,
      uploaded_by: userData.user.id,
    });

    if (insertErr) {
      toast('Erro ao registrar documento: ' + insertErr.message, 'error');
      return;
    }

    toast('Documento anexado!', 'success');
    loadDocuments(tripId);
  }

  async function openDocument(doc) {
    const { data } = await supabase.storage.from('trip-photos').createSignedUrl(doc.storage_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function openSignature(storagePath) {
    const { data } = await supabase.storage.from('trip-photos').createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function buildWhatsAppText(trip) {
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
    const stages = [...(trip.trip_stages || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    stages.forEach((stage) => {
      lines.push(`• ${STAGE_LABELS[stage.status] || stage.status} — ${formatTime(stage.recorded_at)}`);
    });
    lines.push('');
    const statusLabel = trip.status === 'in_progress' ? 'EM ANDAMENTO' : trip.status === 'completed' ? 'FINALIZADA' : 'ATRIBUÍDA';
    lines.push(`Status: ${statusLabel}`);

    // Anexa o link da foto da etapa mais recente (WhatsApp não deixa mandar imagem
    // de verdade por link direto, então mandamos o link clicável da foto).
    const lastWithPhoto = [...stages].reverse().find((s) => s.photos?.[0]);
    if (lastWithPhoto) {
      const { data } = await supabase.storage
        .from('trip-photos')
        .createSignedUrl(lastWithPhoto.photos[0].storage_path, 3600);
      if (data?.signedUrl) {
        lines.push('');
        lines.push(`📸 Foto mais recente (${STAGE_LABELS[lastWithPhoto.status] || lastWithPhoto.status}):`);
        lines.push(data.signedUrl);
      }
    }

    return lines.join('\n');
  }

  async function sendToWhatsApp(trip) {
    const text = await buildWhatsAppText(trip);
    const phone = trip.drivers?.profiles?.phone;
    const base = phone ? `https://wa.me/55${phone}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function copyToClipboard(trip) {
    const text = await buildWhatsAppText(trip);
    try {
      await navigator.clipboard.writeText(text);
      toast('Texto copiado! Já pode colar no WhatsApp.', 'success');
    } catch {
      toast('Não foi possível copiar automaticamente.', 'error');
    }
  }

  async function handleDeleteStage(stage, tripId) {
    const confirmed = window.confirm(
      `Excluir "${STAGE_LABELS[stage.status] || stage.status}"? O motorista vai poder registrar essa etapa de novo.`
    );
    if (!confirmed) return;

    const photo = stage.photos?.[0];
    if (photo?.storage_path) {
      await supabase.storage.from('trip-photos').remove([photo.storage_path]);
    }
    const { error } = await supabase.from('trip_stages').delete().eq('id', stage.id);

    if (error) {
      toast('Erro ao excluir: ' + error.message, 'error');
      return;
    }
    toast('Etapa excluída. O motorista já pode registrar de novo.', 'success');
    loadData();
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
    const plannedTimes = computePlannedTimes(trip);

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
          {trip.internal_notes && (
            <div className="internal-note">🔒 {trip.internal_notes}</div>
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
                const planned = plannedTimes?.[stage.status];
                const isLateVsPlanned = planned && new Date(stage.recorded_at) > planned;
                return (
                  <div key={stage.id} className="stage-row">
                    <div className="stage-info">
                      <strong>{STAGE_LABELS[stage.status] || stage.status}</strong>
                      <span>
                        {formatTime(stage.recorded_at)}
                        {planned && (
                          <span className={`planned-tag${isLateVsPlanned ? ' late' : ''}`}>
                            planejado {planned.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </span>
                    </div>
                    {photo && photoUrls[photo.id] && (
                      <img
                        src={photoUrls[photo.id]}
                        alt="Registro"
                        className="stage-photo"
                        onClick={() => setLightboxSrc(photoUrls[photo.id])}
                      />
                    )}
                    <button
                      className="secondary-button stage-delete-btn"
                      onClick={() => handleDeleteStage(stage, trip.id)}
                    >
                      🗑 Excluir e pedir nova foto
                    </button>
                  </div>
                );
              })}
              {plannedTimes && trip.status !== 'completed' && PLANNED_STAGE_TYPES
                .filter((type) => !stages.some((s) => s.status === type))
                .map((type) => (
                  <div key={type} className="stage-row stage-pending">
                    <div className="stage-info">
                      <strong>{STAGE_LABELS[type]}</strong>
                      <span className="planned-tag">
                        planejado {plannedTimes[type].toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="trip-documents-section">
              <h3 className="report-chart-title">Documentos (nota fiscal, canhoto)</h3>
              {(documents[trip.id] || []).map((doc) => (
                <div key={doc.id} className="trip-document-row">
                  <span onClick={() => openDocument(doc)} className="trip-document-name">📎 {doc.file_name}</span>
                </div>
              ))}
              {(!documents[trip.id] || documents[trip.id].length === 0) && (
                <p className="empty-state" style={{ margin: '6px 0' }}>Nenhum documento anexado.</p>
              )}
              <label className="secondary-button trip-document-upload">
                + Anexar documento
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => handleDocumentUpload(trip.id, e.target.files?.[0])}
                />
              </label>
            </div>

            {trip.signature_storage_path && (
              <div className="trip-documents-section">
                <h3 className="report-chart-title">Assinatura de Recebimento</h3>
                <button className="secondary-button" onClick={() => openSignature(trip.signature_storage_path)}>
                  ✍️ Ver assinatura
                </button>
              </div>
            )}

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
        {(role === 'diretoria' || role === 'financeiro') && (
          <div className="card">
            <h3 style={stats.unbilledCompleted > 0 ? { color: 'var(--alert)' } : undefined}>{stats.unbilledCompleted}</h3>
            <p>Finalizadas sem cobrança lançada</p>
          </div>
        )}
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
            <button
              className={`secondary-button${showHistory ? ' filter-active' : ''}`}
              onClick={() => setShowHistory((v) => !v)}
              title="Por padrão só mostra finalizadas de hoje"
            >
              {showHistory ? '✓ Vendo tudo' : 'Só hoje'}
            </button>
          </div>

          <div className="kanban-board">
            {COLUMNS.map((col) => {
              const colTrips = filteredTrips.filter((t) => tripColumn(t) === col.key);
              return (
                <div key={col.key} className="kanban-column">
                  <div className="kanban-column-header" style={{ borderTopColor: col.color }}>
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
      <MobileTableReveal title="Motoristas" icon="🧑‍✈️">
        <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Placa</th><th>Telefone</th><th>CNH</th><th>Avaliação</th><th>Contato</th>{role === 'diretoria' && <th>Acesso</th>}</tr>
        </thead>
        <tbody>
          {drivers.map((d) => {
            const cnhDate = d.profiles?.cnh_validade;
            const daysLeft = cnhDate ? Math.ceil((new Date(cnhDate).getTime() - Date.now()) / 86400000) : null;
            const cnhWarning = daysLeft != null && daysLeft <= 30;
            const ratings = d.driver_ratings || [];
            const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) : null;
            return (
              <tr key={d.id}>
                <td>{d.profiles?.full_name}</td>
                <td className="mono-data">{d.vehicle_plate}</td>
                <td className="mono-data">{d.profiles?.phone}</td>
                <td style={cnhWarning ? { color: 'var(--alert)', fontWeight: 700 } : undefined}>
                  {cnhDate ? new Date(cnhDate).toLocaleDateString('pt-BR') : '-'}
                  {cnhWarning && (daysLeft >= 0 ? ` (${daysLeft}d)` : ' (vencida)')}
                </td>
                <td>{avgRating != null ? `⭐ ${avgRating.toFixed(1)} (${ratings.length})` : '-'}</td>
                <td className="contact-cell">
                  <a href={`tel:${d.profiles?.phone}`} title="Ligar">📞</a>
                  <a href={`https://wa.me/55${d.profiles?.phone}`} target="_blank" rel="noreferrer" title="WhatsApp">💬</a>
                </td>
                {role === 'diretoria' && (
                  <td><ResetPasswordButton userId={d.id} /></td>
                )}
              </tr>
            );
          })}
          {drivers.length === 0 && (
            <tr><td colSpan={role === 'diretoria' ? 7 : 6} className="empty-state">Nenhum motorista cadastrado ainda.</td></tr>
          )}
        </tbody>
        </table>
      </MobileTableReveal>

      {showNewTrip && (
        <NewTripModal
          onClose={() => setShowNewTrip(false)}
          onCreated={loadData}
        />
      )}

      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
