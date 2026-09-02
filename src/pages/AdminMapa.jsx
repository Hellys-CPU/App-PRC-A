import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

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
      const marker = window.L.circleMarker([p.latitude, p.longitude], {
        radius: 9,
        color: p.status === 'in_progress' ? '#f2a93b' : '#4f80b8',
        fillColor: p.status === 'in_progress' ? '#f2a93b' : '#4f80b8',
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(markersLayer.current);

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
        trip_stages ( status, recorded_at, latitude, longitude )
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
      const stagesWithCoords = (trip.trip_stages || []).filter((s) => s.latitude && s.longitude);
      const last = stagesWithCoords.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
      if (!last) return;
      result.push({
        latitude: last.latitude,
        longitude: last.longitude,
        driverName: trip.drivers?.profiles?.full_name || 'Motorista',
        plate: trip.drivers?.vehicle_plate || '-',
        stageLabel: STAGE_LABELS[last.status] || last.status,
        recordedAt: new Date(last.recorded_at).toLocaleString('pt-BR'),
        status: trip.status,
      });
    });
    setPoints(result);
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Mapa em Tempo Real</h1>
      </header>

      {points.length === 0 && (
        <p className="empty-state" style={{ marginBottom: 12 }}>
          Nenhuma viagem em andamento com localização registrada no momento.
        </p>
      )}

      <div ref={mapRef} style={{ width: '100%', height: '70vh', border: '1px solid var(--line)' }} />
    </div>
  );
}
