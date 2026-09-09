import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useToast } from '../components/Toast.jsx';

const ITEMS = [
  { key: 'pneus', label: 'Pneus (calibragem e estado)' },
  { key: 'oleo', label: 'Nível de óleo' },
  { key: 'freios', label: 'Freios' },
  { key: 'luzes', label: 'Luzes e setas' },
  { key: 'espelhos', label: 'Espelhos e vidros' },
  { key: 'documentos', label: 'CRLV e documentos no veículo' },
];

export default function DriverChecklist() {
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  function toggle(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const allChecked = ITEMS.every((i) => checked[i.key]);

  async function handleSubmit() {
    if (!allChecked) {
      toast('Confira todos os itens antes de continuar.', 'error');
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

    if (!tripData) {
      setSaving(false);
      toast('Nenhuma viagem atribuída no momento.', 'error');
      return;
    }

    const { error } = await supabase.from('vehicle_checklists').insert({
      trip_id: tripData.id,
      driver_id: userData.user.id,
      items: checked,
      notes: notes || null,
    });

    setSaving(false);

    if (error) {
      if (error.message.includes('duplicate')) {
        toast('Checklist já feito pra essa viagem.', 'success');
        navigate('/');
        return;
      }
      toast('Erro ao salvar: ' + error.message, 'error');
      return;
    }

    toast('Checklist registrado. Boa viagem!', 'success');
    navigate('/');
  }

  return (
    <div className="driver-home">
      <header className="camera-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h3>Checklist de Saída</h3>
      </header>

      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
        Confira o veículo antes de sair. Isso fica registrado como prova em caso de problema na estrada.
      </p>

      <div className="stops-list">
        {ITEMS.map((item) => (
          <label key={item.key} className="checklist-item">
            <input type="checkbox" checked={!!checked[item.key]} onChange={() => toggle(item.key)} />
            {item.label}
          </label>
        ))}
      </div>

      <label style={{ marginTop: 16, display: 'block' }}>Observação (opcional)</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ex: risco no para-choque traseiro, já existente" />

      <button className="primary-button" style={{ marginTop: 16 }} onClick={handleSubmit} disabled={saving || !allChecked}>
        {saving ? 'Salvando...' : 'Confirmar Checklist'}
      </button>
    </div>
  );
}
