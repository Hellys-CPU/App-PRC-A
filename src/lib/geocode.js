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
