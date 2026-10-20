// Qibla direction from a place on Earth: the great-circle bearing to the Ka'bah, clockwise from true north.
const RAD = Math.PI / 180;
const KAABA = { lat: 21.4225, lon: 39.8262 };

export function qiblaBearing(lat: number, lon: number) {
  const p1 = lat * RAD;
  const p2 = KAABA.lat * RAD;
  const dl = (KAABA.lon - lon) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

// haversine on a sphere of 6371 km: good to a fraction of a percent
export function distanceToKaabaKm(lat: number, lon: number) {
  const dp = (KAABA.lat - lat) * RAD;
  const dl = (KAABA.lon - lon) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(lat * RAD) * Math.cos(KAABA.lat * RAD) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const compass8 = (deg: number) => ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// signed shortest turn from b to a, in -180..180
export const angleDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;
