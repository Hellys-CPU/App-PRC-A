import React, { useState } from 'react';
import { supabase } from '../supabase';

// Busca motorista (nome/placa), cliente e viagem (origem/destino/cliente) ao mesmo
// tempo. Fica disponível em qualquer tela do admin, direto na barra de navegação.
export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    if (q.trim().length < 2) { setResults(null); return; }

    setLoading(true);

    const [byPlate, clientsRes, tripsRes, matchingProfiles] = await Promise.all([
      supabase.from('drivers').select('id, vehicle_plate, profiles(full_name)').ilike('vehicle_plate', `%${q}%`).limit(5),
      supabase.from('clients').select('id, name, contact_phone').ilike('name', `%${q}%`).limit(5),
      supabase.from('trips')
        .select('id, origin, destination, client_name, status, drivers(profiles(full_name))')
        .or(`client_name.ilike.%${q}%,origin.ilike.%${q}%,destination.ilike.%${q}%`)
        .limit(5),
      supabase.from('profiles').select('id, full_name').ilike('full_name', `%${q}%`).limit(5),
    ]);

    let byName = [];
    const profileIds = (matchingProfiles.data || []).map((p) => p.id);
    if (profileIds.length) {
      const { data } = await supabase.from('drivers').select('id, vehicle_plate').in('id', profileIds);
      byName = (data || []).map((d) => ({ ...d, name: matchingProfiles.data.find((p) => p.id === d.id)?.full_name }));
    }

    setResults({
      drivers: [
        ...byName,
        ...(byPlate.data || []).map((d) => ({ id: d.id, vehicle_plate: d.vehicle_plate, name: d.profiles?.full_name })),
      ].filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i),
      clients: clientsRes.data || [],
      trips: tripsRes.data || [],
    });
    setLoading(false);
  }

  const hasResults = results && (results.drivers.length || results.clients.length || results.trips.length);

  return (
    <div className="global-search">
      {!open ? (
        <button className="secondary-button" onClick={() => setOpen(true)} aria-label="Buscar">🔍</button>
      ) : (
        <div className="global-search-box">
          <input
            autoFocus
            type="text"
            placeholder="Buscar motorista, cliente, viagem..."
            value={query}
            onChange={handleChange}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          {query.length >= 2 && (
            <div className="global-search-results">
              {loading && <p className="empty-state">Buscando...</p>}
              {!loading && !hasResults && <p className="empty-state">Nada encontrado.</p>}
              {!loading && results?.drivers.length > 0 && (
                <>
                  <div className="global-search-group">Motoristas</div>
                  {results.drivers.map((d) => (
                    <div key={d.id} className="global-search-item">
                      {d.name || 'Motorista'} <span className="mono-data">{d.vehicle_plate}</span>
                    </div>
                  ))}
                </>
              )}
              {!loading && results?.clients.length > 0 && (
                <>
                  <div className="global-search-group">Clientes</div>
                  {results.clients.map((c) => (
                    <div key={c.id} className="global-search-item">{c.name}</div>
                  ))}
                </>
              )}
              {!loading && results?.trips.length > 0 && (
                <>
                  <div className="global-search-group">Viagens</div>
                  {results.trips.map((t) => (
                    <div key={t.id} className="global-search-item">
                      {t.origin} → {t.destination} · {t.client_name || 'sem cliente'} · {t.drivers?.profiles?.full_name || '-'}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
