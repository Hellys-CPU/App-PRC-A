import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import Brand from '../components/Brand.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import PhotoLightbox from '../components/PhotoLightbox.jsx';

const STAGE_LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

function formatTime(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function ClientDashboard() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [photoUrls, setPhotoUrls] = useState({});
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => {
    loadTrips();

    const channel = supabase
      .channel('client_trips_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadTrips())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stages' }, () => loadTrips())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadTrips() {
    // A RLS já filtra pra só trazer viagens do próprio cliente logado.
    const { data } = await supabase
      .from('trips')
      .select(`
        id, origin, destination, status, created_at,
        drivers ( id, vehicle_plate, profiles ( full_name ) ),
        trip_stages ( id, status, recorded_at, photos ( id, storage_path ) ),
        driver_ratings ( rating, comment )
      `)
      .order('created_at', { ascending: false });

    const sorted = (data || []).map((t) => ({
      ...t,
      trip_stages: [...(t.trip_stages || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)),
    }));

    setTrips(sorted);
    setLoading(false);
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

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function exportMyData() {
    const bundle = { minhas_viagens: trips, exportado_em: new Date().toISOString() };
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

  async function submitRating(tripId, driverId, rating) {
    const { data: userData } = await supabase.auth.getUser();
    const { data: clientRow } = await supabase.from('clients').select('id').eq('auth_user_id', userData.user.id).maybeSingle();

    const { error } = await supabase.from('driver_ratings').insert({
      trip_id: tripId,
      driver_id: driverId,
      client_id: clientRow?.id,
      rating,
    });

    if (!error) loadTrips();
  }

  function statusLabel(status) {
    if (status === 'in_progress') return 'Em andamento';
    if (status === 'completed') return 'Finalizada';
    return 'Atribuída';
  }

  return (
    <div className="admin-container">
      <header className="admin-nav" style={{ position: 'static' }}>
        <div className="admin-nav-brand"><Brand subtitle="Painel do Cliente" /></div>
        <div className="admin-nav-right">
          <ThemeToggle />
          <button className="secondary-button" onClick={exportMyData}>⬇ Meus Dados</button>
          <button className="logout-button" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <h1 className="page-title">Minhas Viagens</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 20 }}>
        Acompanhe aqui o andamento e as fotos das viagens da sua carga.
      </p>

      {loading && <p className="empty-state">Carregando...</p>}
      {!loading && trips.length === 0 && (
        <p className="empty-state">Nenhuma viagem registrada pra você ainda.</p>
      )}

      <div className="trips-list">
        {trips.map((trip) => {
          const stages = trip.trip_stages || [];
          const lastStage = stages[stages.length - 1];
          const isExpanded = expandedTrip === trip.id;

          return (
            <div key={trip.id} className={`kanban-card status-${trip.status}`} style={{ maxWidth: 640 }}>
              <div className="kanban-card-header" onClick={() => toggleExpand(trip.id, stages)}>
                <strong>{trip.drivers?.profiles?.full_name || 'Motorista'}</strong>
                <span className="kanban-plate">{trip.drivers?.vehicle_plate || '-'}</span>
                <div className="trip-substatus">{trip.origin} → {trip.destination}</div>
                <div className="trip-substatus">{formatDate(trip.created_at)} — {statusLabel(trip.status)}</div>
                <div className="trip-substatus">
                  {lastStage
                    ? `Última etapa: ${STAGE_LABELS[lastStage.status] || lastStage.status} às ${formatTime(lastStage.recorded_at)}`
                    : 'Sem etapas registradas ainda'}
                </div>
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
                            <img
                              src={photoUrls[photo.id]}
                              alt="Registro"
                              className="stage-photo"
                              onClick={() => setLightboxSrc(photoUrls[photo.id])}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {trip.status === 'completed' && (
                    <div className="rating-section">
                      {trip.driver_ratings?.[0] ? (
                        <p className="rating-done">
                          Sua avaliação: {'⭐'.repeat(trip.driver_ratings[0].rating)}{'☆'.repeat(5 - trip.driver_ratings[0].rating)}
                        </p>
                      ) : (
                        <>
                          <p className="report-chart-title" style={{ marginBottom: 8 }}>Como foi o motorista nessa viagem?</p>
                          <div className="rating-stars">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                className="rating-star-btn"
                                onClick={() => submitRating(trip.id, trip.drivers?.id, n)}
                              >
                                ⭐
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
