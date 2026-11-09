import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import client from '../api/client';

/**
 * RouteLayer — Shfaq rrugën më të shkurtër midis dy pikave në hartë.
 */
export default function RouteLayer({
  visible,
  fromLocation,  // [lat, lon]
  toLocation,    // [lat, lon]
  color = '#00d4ff',
  label = '',
}) {
  const map = useMap();
  const layerRef = useRef(L.layerGroup());

  useEffect(() => {
    if (!map) return;
    layerRef.current.clearLayers();

    if (!visible || !fromLocation || !toLocation) return;

    const loadRoute = async () => {
      try {
        const { data } = await client.post('/routing/route', {
          from_lat: fromLocation[0],
          from_lon: fromLocation[1],
          to_lat: toLocation[0],
          to_lon: toLocation[1],
          algorithm: 'astar',
        });

        if (!data.coordinates || data.coordinates.length === 0) return;

        // Vizato polyline
        const polyline = L.polyline(data.coordinates, {
          color,
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round',
        });

        // Marker për nisjen
        L.circleMarker(fromLocation, {
          radius: 8,
          color: 'white',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        })
          .bindPopup(`<b>${label || 'Nisja'}</b>`)
          .addTo(layerRef.current);

        // Marker për destinacionin
        L.circleMarker(toLocation, {
          radius: 8,
          color: 'white',
          weight: 2,
          fillColor: '#ff4757',
          fillOpacity: 1,
        })
          .bindPopup(`<b>Destinacioni</b>`)
          .addTo(layerRef.current);

        polyline
          .bindPopup(`
            <div style="font-family: Inter; font-size: 12px;">
              <b style="color: ${color};">${label || 'Rruga'}</b><br/>
              <b>Distanca:</b> ${(data.distance_m / 1000).toFixed(2)} km<br/>
              <b>Koha:</b> ${(data.time_seconds / 60).toFixed(2)} min
            </div>
          `)
          .addTo(layerRef.current);

        layerRef.current.addTo(map);
      } catch (err) {
        console.error('Gabim në kalkulimin e rrugës:', err);
      }
    };

    loadRoute();

    const layer = layerRef.current;
    return () => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, visible, fromLocation, toLocation, color, label]);

  return null;
}