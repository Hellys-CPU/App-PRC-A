import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import PhotoLightbox from '../components/PhotoLightbox.jsx';

const LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

export default function DriverHistory() {
  const [stages, setStages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('trip_stages')
      .select('id, status, recorded_at, trips!inner(driver_id), photos(storage_path)')
      .eq('trips.driver_id', userData.user.id)
      .order('recorded_at', { ascending: false });

    const withUrls = await Promise.all(
      (data || []).map(async (stage) => {
        const path = stage.photos?.[0]?.storage_path;
        let url = null;
        if (path) {
          const { data: signed } = await supabase.storage.from('trip-photos').createSignedUrl(path, 3600);
          url = signed?.signedUrl;
        }
        return { ...stage, photoUrl: url };
      })
    );
    setStages(withUrls);
  }

  return (
    <div className="history-screen">
      <header className="camera-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h3>Histórico</h3>
      </header>

      {stages.length === 0 && <p className="empty-state">Nenhum registro ainda.</p>}

      <div className="history-list">
        {stages.map((s) => (
          <div key={s.id} className="history-item">
            {s.photoUrl && (
              <img
                src={s.photoUrl}
                alt=""
                className="history-thumb"
                onClick={() => setLightboxSrc(s.photoUrl)}
              />
            )}
            <div>
              <p className="history-status">{LABELS[s.status] || s.status}</p>
              <p className="history-time">{new Date(s.recorded_at).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        ))}
      </div>

      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
