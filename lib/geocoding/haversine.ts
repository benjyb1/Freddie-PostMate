const EARTH_RADIUS_MILES = 3958.8

/**
 * Calculate the great-circle distance between two lat/lng points (Haversine formula).
 * Returns distance in miles, rounded to 2 decimal places.
 */
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_MILES * c * 100) / 100
}

/**
 * Return a bounding box [minLat, maxLat, minLng, maxLng] for an approximate
 * radius in miles around a point. Useful for a cheap SQL pre-filter.
 */
export function boundingBox(
  lat: number,
  lng: number,
  radiusMiles: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDeg = radiusMiles / 69.0
  const lngDeg = radiusMiles / (69.0 * Math.cos((lat * Math.PI) / 180))
  return {
    minLat: lat - latDeg,
    maxLat: lat + latDeg,
    minLng: lng - lngDeg,
    maxLng: lng + lngDeg,
  }
}
