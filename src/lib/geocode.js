// Converte latitude/longitude em endereço legível usando o Nominatim
// (OpenStreetMap), gratuito — mesmo provedor já usado no mapa do admin.
export async function reverseGeocode(lat, lon) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=0`,
      { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null; // sem internet ou serviço fora — quem usa a foto trata o fallback
  }
}

// Converte um endereço em coordenadas (o inverso do de cima). Usado pra
// calcular rota entre origem e destino de uma rota cadastrada.
export async function forwardGeocode(address) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// Calcula distância e tempo estimado de carro entre dois pontos, usando o
// servidor de demonstração PÚBLICO e GRATUITO do OSRM (Open Source Routing
// Machine). Aviso importante: esse servidor é de demonstração, sem SLA e com
// limite informal de uso — serve bem pra uso interno/moderado, mas se o
// volume de cálculos crescer muito, vale considerar um serviço pago
// (Google Directions, Mapbox, OSRM próprio hospedado) pra ter garantia de
// disponibilidade.
export async function calculateRoute(origin, destination) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMinutes: Math.round(route.duration / 60),
    };
  } catch {
    return null;
  }
}
