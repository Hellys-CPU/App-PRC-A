import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import SignaturePad from '../components/SignaturePad.jsx';

export default function DriverSignature() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  async function handleConfirm(dataUrl) {
    const { data: userData } = await supabase.auth.getUser();
    const blob = await (await fetch(dataUrl)).blob();
    const storagePath = `${userData.user.id}/signatures/${tripId}.png`;

    const { error: uploadErr } = await supabase.storage
      .from('trip-photos')
      .upload(storagePath, blob, { contentType: 'image/png', upsert: true });

    if (!uploadErr) {
      await supabase.from('trips').update({ signature_storage_path: storagePath }).eq('id', tripId);
    }

    navigate('/');
  }

  return (
    <div className="camera-screen">
      <header className="camera-header">
        <h3>Assinatura de Recebimento</h3>
      </header>
      <SignaturePad onConfirm={handleConfirm} onSkip={() => navigate('/')} />
    </div>
  );
}
