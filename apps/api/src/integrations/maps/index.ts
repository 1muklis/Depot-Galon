export interface Coordinate {
  lat: number;
  lng: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Jarak garis lurus (km) — rumus haversine */
export function haversineKm(a: Coordinate, b: Coordinate) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(x))).toFixed(2);
}

/** Estimasi menit tempuh dengan kecepatan rata-rata motor di kota (25 km/jam) */
export const estimateMinutes = (km: number, avgKmh = 25) => Math.max(1, Math.round((km / avgKmh) * 60));
