import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import client from '../api/client';

/**
 * AmbulanceLayer — Shfaq ambulancat në hartë.
 * Ngarkohet nga API-ja /routing/ambulances.
 */
export default function AmbulanceLayer({ visible, emergencyLocations = [], refreshKey = 0 }) {
  const map = useMap();
  const layerRef = useRef(L.layerGroup());
  const dispatchLayerRef = useRef(L.layerGroup());
  const [ambulances, setAmbulances] = useState([]);
  const [animations, setAnimations] = useState([]);

  // Ngarko ambulancat
  useEffect(() => {
    if (!visible) return;

    const loadAmbulances = async () => {
      try {
        const [{ data }, { data: dispatchData }] = await Promise.all([
          client.get('/routing/ambulances'),
          client.get('/routing/dispatches'),
        ]);
        setAmbulances(data.ambulances || []);
        setAnimations((dispatchData.dispatches || []).filter(
          (dispatch) => ['en_route', 'at_scene'].includes(dispatch.status),
        ));
      } catch (err) {
        console.warn('Ambulancat nuk u ngarkuan:', err.message);
        setAmbulances([]);
      }
    };

    loadAmbulances();
    const interval = setInterval(loadAmbulances, 10000);
    return () => clearInterval(interval);
  }, [visible, refreshKey]);

  // Dispatch automatik kur ka emergjenca
  useEffect(() => {
    if (!visible || emergencyLocations.length === 0) return;

    const doDispatch = async () => {
      try {
        const { data } = await client.post('/routing/dispatch', {
          emergencies: emergencyLocations.map((e, i) => ({
            district: e.district || `Zona ${i + 1}`,
            lat: e.lat,
            lon: e.lon,
            severity: e.severity || 3,
          })),
        });

        setAnimations((current) => [...data.dispatches, ...current]);
      } catch (err) {
        console.warn('Dispatch nuk funksionoi:', err.message);
      }
    };

    doDispatch();
  }, [visible, emergencyLocations]);

  // Shfaq ambulancat
  useEffect(() => {
    if (!map) return;
    const layer = layerRef.current;
    layer.clearLayers();

    if (!visible || ambulances.length === 0) {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
      return;
    }

    ambulances.forEach((amb) => {
      const color =
        amb.status === 'available' ? '#2ed573' :
        amb.status === 'en_route' ? '#ffa502' : '#ff4757';

      const icon = L.divIcon({
        className: 'ambulance-icon',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: rgba(10, 14, 39, 0.95);
            border: 2px solid ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 0 12px ${color}80;
          ">🚑</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([amb.current_lat, amb.current_lon], { icon })
        .bindPopup(`
          <div style="font-family: Inter; min-width: 200px;">
            <strong style="color: #00d4ff; font-size: 13px;">🚑 Ambulanca #${amb.id}</strong>
            <div style="margin-top: 8px; font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #9ca3af;">Spitali:</span>
                <b>${amb.hospital}</b>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #9ca3af;">Statusi:</span>
                <b style="color: ${color};">${amb.status}</b>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #9ca3af;">Lat:</span>
                <b>${amb.current_lat.toFixed(4)}</b>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #9ca3af;">Lon:</span>
                <b>${amb.current_lon.toFixed(4)}</b>
              </div>
            </div>
          </div>
        `, { className: 'custom-popup-clean' })
        .addTo(layer);
    });

    layer.addTo(map);

    return () => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, ambulances, visible]);

  // Shfaq rrugët e dispatcheve
  useEffect(() => {
    if (!map) return;
    const dispatchLayer = dispatchLayerRef.current;
    dispatchLayer.clearLayers();

    if (!visible || animations.length === 0) return;

    animations.forEach((dispatch) => {
      const amb = ambulances.find((a) => a.id === dispatch.ambulance_id);
      if (!amb) return;

      const points = dispatch.route?.length >= 2
        ? dispatch.route.map((point) => [point[0], point[1]])
        : [[amb.current_lat, amb.current_lon], [dispatch.lat, dispatch.lon]];

      L.polyline(points, {
        color: '#ffa502',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 6',
      })
        .bindPopup(`
          <div style="font-family: Inter; font-size: 12px;">
            <b style="color: #ffa502;">Rruga e ambulancës #${dispatch.ambulance_id}</b><br/>
            <b>Emergjenca:</b> ${dispatch.district || '—'}<br/>
            <b>Distanca:</b> ${dispatch.distance_km} km<br/>
            <b>Koha:</b> ${dispatch.time_minutes} min
          </div>
        `)
        .addTo(dispatchLayer);

      const severityColor = dispatch.severity >= 5
        ? '#ff4757'
        : dispatch.severity >= 3 ? '#ffa502' : '#2ed573';
      L.circleMarker([dispatch.lat, dispatch.lon], {
        radius: 9,
        color: severityColor,
        weight: 2,
        fillColor: severityColor,
        fillOpacity: 0.25,
      })
        .bindPopup(`
          <div style="font-family: Inter; font-size: 12px; min-width: 170px;">
            <b style="color: ${severityColor};">📍 Emergjencë aktive</b><br/>
            <b>Lagjja:</b> ${dispatch.district || '—'}<br/>
            <b>Severity:</b> ${dispatch.severity}<br/>
            <b>Statusi:</b> ${dispatch.status}<br/>
            <b>Ambulanca:</b> #${dispatch.ambulance_id}
          </div>
        `)
        .addTo(dispatchLayer);
    });

    dispatchLayer.addTo(map);

    return () => {
      if (map.hasLayer(dispatchLayer)) {
        map.removeLayer(dispatchLayer);
      }
    };
  }, [map, animations, ambulances, emergencyLocations, visible]);

  return null;
}
