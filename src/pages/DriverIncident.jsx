import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useToast } from '../components/Toast.jsx';

export default function DriverIncident() {
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function handleSubmit() {
    if (!description.trim()) {
      toast('Descreva o que aconteceu.', 'error');
      return;
    }
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const { data: tripData } = await supabase
      .from('trips')
      .select('id')
      .eq('driver_id', userData.user.id)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let photoPath = null;
    if (photoFile) {
      photoPath = `${userData.user.id}/incidents/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('trip-photos').upload(photoPath, photoFile);
      if (uploadErr) {
        setSaving(false);
        toast('Erro ao enviar foto: ' + uploadErr.message, 'error');
        return;
      }
    }

    const { error } = await supabase.from('incidents').insert({
      trip_id: tripData?.id || null,
      driver_id: userData.user.id,
      description,
      photo_storage_path: photoPath,
    });

    setSaving(false);

    if (error) {
      toast('Erro ao registrar: ' + error.message, 'error');
      return;
    }

    toast('Ocorrência enviada — a central vai revisar.', 'success');
    navigate('/');
  }

  return (
    <div className="driver-home">
      <header className="camera-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h3>Reportar Ocorrência</h3>
      </header>

      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
        Avaria, atraso justificado, problema na estrada — descreva aqui. Fica pendente até a central revisar.
      </p>

      <label>O que aconteceu?</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva com detalhes..." />

      <label style={{ marginTop: 12, display: 'block' }}>Foto (opcional)</label>
      <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />

      <button className="primary-button" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={saving}>
        {saving ? 'Enviando...' : 'Enviar Ocorrência'}
      </button>
    </div>
  );
}
