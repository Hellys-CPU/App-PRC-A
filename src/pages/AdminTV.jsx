import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';

const STAGE_LABELS = {
  apresentacao_base_origem: 'Apresentação',
  saida_base_origem: 'Em Trânsito',
  chegada_base_destino: 'Chegada',
  fim_descarga: 'Descarregando',
};

// Tela pensada pra ficar num monitor fixo no galpão: sem menu, sem interação,
// números grandes + mapa ao vivo + lista de viagens em andamento, tudo atualizando sozinho.
export default function AdminTV() {
  const [stats, setStats] = useState({ activeDrivers: 0, inProgress: 0, late: 0 });
  const [trips, setTrips] = useState([]);
  const [points, setPoints] = useState([]);
  const [now, setNow] = useState(new Date());

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('tv_mode_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stages' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_pings' }, () => loadData())
      .subscribe();

    const clock = setInterval(() => setNow(new Date()), 1000);
    const reload = setInterval(loadData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(clock);
      clearInterval(reload);
    };
  }, []);

  // Monta o mapa Leaflet uma única vez
  useEffect(() => {
    if (!window.L || mapInstance.current) return;
    mapInstance.current = window.L.map(mapRef.current, { zoomControl: false }).setView([-23.55, -46.63], 6);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(mapInstance.current);
    markersLayer.current = window.L.layerGroup().addTo(mapInstance.current);
  }, []);

  // Redesenha os marcadores sempre que a posição dos motoristas muda
  useEffect(() => {
    if (!markersLayer.current || !window.L) return;
    markersLayer.current.clearLayers();

    points.forEach((p) => {
      const icon = window.L.divIcon({
        className: 'truck-marker',
        html: `<div class="truck-marker-pin" style="background:#f46101"><span>🚚</span></div><div class="truck-marker-plate">${p.plate}</div>`,
        iconSize: [36, 50],
        iconAnchor: [18, 40],
        popupAnchor: [0, -40],
      });
      window.L.marker([p.latitude, p.longitude], { icon }).addTo(markersLayer.current)
        .bindPopup(`<strong>${p.driverName}</strong><br/>${p.plate}<br/>${p.stageLabel}`);
    });

    if (points.length > 0) {
      const bounds = window.L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      mapInstance.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    }
  }, [points]);

  async function loadData() {
    const { data: driversData } = await supabase.from('drivers').select('id').eq('active', true);

    const { data: tripsData } = await supabase
      .from('trips')
      .select('id, origin, destination, status, created_at, drivers(vehicle_plate, profiles(full_name)), trip_stages(status, recorded_at, latitude, longitude), location_pings(latitude, longitude, recorded_at)')
      .in('status', ['assigned', 'in_progress']);

    const withLast = (tripsData || []).map((t) => {
      const stages = [...(t.trip_stages || [])].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
      const last = stages[0];
      const mins = (Date.now() - new Date(last?.recorded_at || t.created_at).getTime()) / 60000;
      return { ...t, lastStage: last, elapsedMins: mins };
    });

    setStats({
      activeDrivers: driversData?.length || 0,
      inProgress: withLast.filter((t) => t.status === 'in_progress').length,
      late: withLast.filter((t) => t.elapsedMins > 120).length,
    });
    setTrips(withLast.sort((a, b) => b.elapsedMins - a.elapsedMins));

    // Posições pro mapa — mesma lógica da tela de Mapa (ping mais recente x etapa mais recente)
    const mapPoints = [];
    (tripsData || []).filter((t) => t.status === 'in_progress').forEach((trip) => {
      const stagesWithCoords = (trip.trip_stages || []).filter((s) => s.latitude && s.longitude);
      const lastStage = stagesWithCoords.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
      const pings = trip.location_pings || [];
      const lastPing = [...pings].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];

      let last = lastStage;
      if (lastPing && (!lastStage || new Date(lastPing.recorded_at) > new Date(lastStage.recorded_at))) {
        last = lastPing;
      }
      if (!last) return;

      mapPoints.push({
        latitude: last.latitude,
        longitude: last.longitude,
        driverName: trip.drivers?.profiles?.full_name || 'Motorista',
        plate: trip.drivers?.vehicle_plate || '-',
        stageLabel: STAGE_LABELS[last.status] || 'Em trânsito',
      });
    });
    setPoints(mapPoints);
  }

  return (
    <div className="tv-mode">
      <div className="tv-header">
        <span className="tv-clock">{now.toLocaleTimeString('pt-BR')}</span>
        <span className="tv-date">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
      </div>

      <div className="tv-stats">
        <div className="tv-stat"><span className="tv-stat-number">{stats.activeDrivers}</span><span>Motoristas Ativos</span></div>
        <div className="tv-stat"><span className="tv-stat-number">{stats.inProgress}</span><span>Em Andamento</span></div>
        <div className="tv-stat tv-stat-alert"><span className="tv-stat-number">{stats.late}</span><span>Atrasadas</span></div>
      </div>

      <div className="tv-main-grid">
        <div className="tv-map-wrapper">
          <div ref={mapRef} className="tv-map" />
        </div>

        <div className="tv-trips-column">
          {trips.map((t) => (
            <div key={t.id} className={`tv-trip-card${t.elapsedMins > 120 ? ' tv-trip-late' : ''}`}>
              <div className="tv-trip-plate">{t.drivers?.vehicle_plate || '-'}</div>
              <div className="tv-trip-driver">{t.drivers?.profiles?.full_name || 'Motorista'}</div>
              <div className="tv-trip-route">{t.origin} → {t.destination}</div>
              <div className="tv-trip-stage">{t.lastStage ? STAGE_LABELS[t.lastStage.status] || t.lastStage.status : 'Atribuída'}</div>
              <div className="tv-trip-elapsed">{Math.floor(t.elapsedMins / 60)}h{String(Math.floor(t.elapsedMins % 60)).padStart(2, '0')}m parado</div>
            </div>
          ))}
          {trips.length === 0 && <p className="tv-empty">Nenhuma viagem em andamento no momento.</p>}
        </div>
      </div>
    </div>
  );
}
