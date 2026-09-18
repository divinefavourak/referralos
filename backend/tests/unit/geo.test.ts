import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineDistanceKm, estimateRoadTravel } from '../../src/utils/geo.js';

test('Geospatial Math: Haversine distance calculates accurate kilometers', () => {
  // St. Mary's coordinates to Hospital B coordinates
  const stMarys = { latitude: 6.5244, longitude: 3.3792 };
  const hospitalB = { latitude: 6.6000, longitude: 3.3400 };

  const distance = calculateHaversineDistanceKm(stMarys, hospitalB);

  // Expected straight-line distance is ~9.4 - 9.5 km
  assert.ok(distance > 9.0 && distance < 10.5, `Distance ${distance} was out of expected range`);
});

test('Geospatial Math: Same origin and destination yields zero distance', () => {
  const coord = { latitude: 6.5244, longitude: 3.3792 };
  const distance = calculateHaversineDistanceKm(coord, coord);
  assert.equal(distance, 0);
});

test('Geospatial Math: estimateRoadTravel applies detour winding factor and realistic minutes', () => {
  const stMarys = { latitude: 6.5244, longitude: 3.3792 };
  const hospitalB = { latitude: 6.6000, longitude: 3.3400 };

  const travel = estimateRoadTravel(stMarys, hospitalB);

  // Detour road distance should be strictly greater than euclidean
  const euclidean = calculateHaversineDistanceKm(stMarys, hospitalB);
  assert.ok(travel.distanceKm > euclidean, 'Road distance must exceed straight-line distance');

  // Emergency travel time calculation should be positive and realistic
  assert.ok(travel.durationMinutes >= 10 && travel.durationMinutes <= 35, `Travel duration ${travel.durationMinutes} min out of expected range`);
});
