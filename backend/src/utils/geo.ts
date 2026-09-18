export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates straight-line distance using the Haversine formula (km).
 */
export function calculateHaversineDistanceKm(
  coord1: GeoCoordinates,
  coord2: GeoCoordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Computes realistic road travel distance and travel duration in minutes.
 * Applies a regional road winding factor (detour index ~ 1.35x) and acute emergency vehicle speed (~50 km/h average in regional traffic).
 */
export function estimateRoadTravel(
  origin: GeoCoordinates,
  destination: GeoCoordinates
): { distanceKm: number; durationMinutes: number } {
  const euclideanKm = calculateHaversineDistanceKm(origin, destination);
  // Realistic road routing winding index:
  const windingFactor = 1.32;
  const roadDistanceKm = Math.round(euclideanKm * windingFactor * 10) / 10;

  // Emergency ambulance with siren: ~48 km/h in mixed traffic conditions
  const averageSpeedKmh = 48.0;
  const travelHours = roadDistanceKm / averageSpeedKmh;
  const durationMinutes = Math.max(3, Math.round(travelHours * 60 * 10) / 10);

  return {
    distanceKm: roadDistanceKm,
    durationMinutes,
  };
}
