import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';

export default function AdminMapa() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const [points, setPoints] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.L) return; // Leaflet carregado via CDN no index.html
    mapInstance.current = window.L.map(mapRef.current).setView([-23.55, -46.63], 6);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(mapInstance.current);
    markersLayer.current = window.L.layerGroup().addTo(mapInstance.current);

    loadPoints();
    const channel = supabase
      .channel('mapa_trip_stages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_stages' }, loadPoints)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_pings' }, loadPoints)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      mapInstance.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!markersLayer.current || !window.L) return;
    markersLayer.current.clearLayers();

    points.forEach((p) => {
      const bgColor = p.status === 'in_progress' ? '#f46101' : '#4f80b8';
      const icon = window.L.divIcon({
        className: 'truck-marker',
        html: `<div class="truck-marker-pin" style="background:${bgColor}"><span>🚚</span></div><div class="truck-marker-plate">${p.plate}</div>`,
        iconSize: [36, 50],
        iconAnchor: [18, 40],
        popupAnchor: [0, -40],
      });

      const marker = window.L.marker([p.latitude, p.longitude], { icon }).addTo(markersLayer.current);

      marker.bindPopup(
        `<strong>${p.driverName}</strong><br/>${p.plate}<br/>${p.stageLabel}<br/>${p.recordedAt}`
      );
    });

    if (points.length > 0) {
      const bounds = window.L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points]);

  async function loadPoints() {
    const { data } = await supabase
      .from('trips')
      .select(`
        id, status,
        drivers ( vehicle_plate, profiles ( full_name ) ),
        trip_stages ( status, recorded_at, latitude, longitude ),
        location_pings ( latitude, longitude, recorded_at )
      `)
      .eq('status', 'in_progress');

    const STAGE_LABELS = {
      apresentacao_base_origem: 'Apresentação na Base Origem',
      saida_base_origem: 'Saída da Base Origem',
      chegada_base_destino: 'Chegada na Base Destino',
      fim_descarga: 'Fim da Descarga',
      parada_eventual: 'Parada Eventual',
    };

    const result = [];
    (data || []).forEach((trip) => {
      // Compara o ping mais recente (rastreamento por intervalo) com a última etapa
      // registrada por foto, e usa o que for mais atual — o mapa reflete a posição real.
      const stagesWithCoords = (trip.trip_stages || []).filter((s) => s.latitude && s.longitude);
      const lastStage = stagesWithCoords.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
      const pings = trip.location_pings || [];
      const lastPing = [...pings].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];

      let last = lastStage;
      let isPing = false;
      if (lastPing && (!lastStage || new Date(lastPing.recorded_at) > new Date(lastStage.recorded_at))) {
        last = lastPing;
        isPing = true;
      }
      if (!last) return;

      result.push({
        latitude: last.latitude,
        longitude: last.longitude,
        driverName: trip.drivers?.profiles?.full_name || 'Motorista',
        plate: trip.drivers?.vehicle_plate || '-',
        stageLabel: isPing ? 'Posição automática (em trânsito)' : (STAGE_LABELS[last.status] || last.status),
        recordedAt: new Date(last.recorded_at).toLocaleString('pt-BR'),
        status: trip.status,
      });
    });
    setPoints(result);
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Mapa em Tempo Real</h1>

      {points.length === 0 && (
        <p className="empty-state" style={{ marginBottom: 12 }}>
          Nenhuma viagem "Em Trânsito" agora. O mapa só mostra viagens em andamento — assim que
          uma etapa for registrada ou o motorista estiver com o app aberto em viagem, o caminhão aparece aqui.
        </p>
      )}

      <div ref={mapRef} style={{ width: '100%', height: '70vh', border: '1px solid var(--line)' }} />
    </div>
  );
}
