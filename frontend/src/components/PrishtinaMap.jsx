import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import AmbulanceLayer from './AmbulanceLayer';
import RouteLayer from './RouteLayer';
import LiveAgentsLayer from './LiveAgentsLayer';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';

// ═══════════════════════════════════════════════════════════════════
// KONFIGURIMI
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line react-refresh/only-export-components
export const PRISHTINA_CENTER = [42.6629, 21.1655];

// eslint-disable-next-line react-refresh/only-export-components
export const SEVERITY_COLORS = {
  critical: '#ff4757',
  high: '#ff6348',
  medium: '#ffa502',
  low: '#2ed573',
  minimal: '#3b82f6',
};

// ═══════════════════════════════════════════════════════════════════
// MAP RESIZE OBSERVER
// ═══════════════════════════════════════════════════════════════════

function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [map]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// HEATMAP LAYER
// ═══════════════════════════════════════════════════════════════════

function HeatmapLayer({ points, visible, gradient }) {
  const map = useMap();
  const layerRef = useRef(null);
  const [zoom, setZoom] = useState(map?.getZoom() || 13);
  const [mapSize, setMapSize] = useState(() => map?.getSize() || { x: 0, y: 0 });

  useEffect(() => {
    if (!map) return;
    const onZoom = () => setZoom(map.getZoom());
    const container = map.getContainer();
    const observer = new ResizeObserver(() => setMapSize(map.getSize()));
    map.on('zoomend', onZoom);
    observer.observe(container);
    queueMicrotask(() => setMapSize(map.getSize()));
    return () => {
      map.off('zoomend', onZoom);
      observer.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (
      !visible
      || !points
      || points.length === 0
      || mapSize.x <= 0
      || mapSize.y <= 0
    ) return;

    const heatPoints = points
      .filter((point) => (
        Number.isFinite(Number(point.lat))
        && Number.isFinite(Number(point.lon))
        && Number.isFinite(Number(point.intensity))
      ))
      .map((point) => [Number(point.lat), Number(point.lon), Number(point.intensity)]);
    if (heatPoints.length === 0) return;
    const baseRadius = Math.min(96, Math.max(18, 20 * (2 ** ((zoom - 13) / 2))));
    const baseBlur = Math.round(baseRadius * 0.62);

    const heatLayer = L.heatLayer(heatPoints, {
      radius: baseRadius,
      blur: baseBlur,
      maxZoom: 20,
      max: 1.0,
      minOpacity: 0.25,
      gradient: gradient || {
        0.0: 'rgba(0, 0, 0, 0)',
        0.15: 'rgba(46, 213, 115, 0.5)',
        0.3: 'rgba(46, 213, 115, 0.8)',
        0.45: 'rgba(255, 217, 0, 0.85)',
        0.6: 'rgba(255, 145, 0, 0.9)',
        0.75: 'rgba(255, 71, 87, 0.95)',
        0.9: 'rgba(200, 30, 40, 1)',
        1.0: 'rgba(139, 0, 0, 1)',
      },
    }).addTo(map);
    layerRef.current = heatLayer;

    return () => {
      if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
      if (layerRef.current === heatLayer) layerRef.current = null;
    };
  }, [map, points, visible, zoom, gradient, mapSize]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// DISTRICT MARKERS
// ═══════════════════════════════════════════════════════════════════

function DistrictMarkersLayer({ districts, visible, selectedDistrict, onSelect, interactive }) {
  const map = useMap();
  const layerRef = useRef(L.layerGroup());

  useEffect(() => {
    if (!map) return;
    const districtLayer = layerRef.current;
    districtLayer.clearLayers();

    if (!visible || !districts || districts.length === 0) {
      if (map.hasLayer(districtLayer)) map.removeLayer(districtLayer);
      return;
    }

    districts.forEach((district) => {
      const color = SEVERITY_COLORS[district.severity] || '#6b7280';
      const isSelected = selectedDistrict === district.district;
      const size = isSelected ? 18 : 12;

      const icon = L.divIcon({
        className: 'district-marker-custom',
        html: `
          <div style="position: relative; width: ${size}px; height: ${size}px;">
            <div style="
              position: absolute; inset: 0;
              border-radius: 50%;
              background: ${color};
              border: 2px solid white;
              box-shadow: 0 0 ${isSelected ? 14 : 6}px ${color};
            "></div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker(district.center, { icon });

      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; min-width: 220px; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #1e2655;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></div>
            <div>
              <div style="color: ${color}; font-size: 14px; font-weight: 700;">${district.district}</div>
              <div style="color: #6b7280; font-size: 10px; text-transform: uppercase; font-weight: 700;">${district.severity.toUpperCase()}</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px;">
            <div style="padding: 6px; background: #0a0e27; border-radius: 4px;">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 700;">Raporte · 7 ditë</div>
              <div style="font-size: 13px; font-weight: 800; color: #00d4ff;">${district.reports.toLocaleString()}</div>
            </div>
            <div style="padding: 6px; background: #0a0e27; border-radius: 4px;">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 700;">Në pritje</div>
              <div style="font-size: 13px; font-weight: 800; color: #ff4757;">${(district.pending_reports || 0).toLocaleString()}</div>
            </div>
            <div style="padding: 6px; background: #0a0e27; border-radius: 4px;">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 700;">Konfirmuar</div>
              <div style="font-size: 13px; font-weight: 800; color: #ffa502;">${district.confirmed.toLocaleString()}</div>
            </div>
            <div style="padding: 6px; background: #0a0e27; border-radius: 4px;">
              <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 700;">Të verifikuara</div>
              <div style="font-size: 13px; font-weight: 800; color: #2ed573;">${(district.validated_reports || 0).toLocaleString()}</div>
            </div>
          </div>
          <div style="font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">Popullsia:</span><b>${district.population.toLocaleString()}</b></div>
            <p style="color: #9ca3af; font-size: 9px; margin: 5px 0 0;">Niveli tregon vëllimin e raporteve të verifikuara; nuk është vlerësim klinik i rrezikut.</p>
          </div>
        </div>
      `, { className: 'custom-popup-clean', maxWidth: 280 });

      if (interactive && onSelect) {
        marker.on('click', () => onSelect(district.district));
      }

      districtLayer.addLayer(marker);
    });

    districtLayer.addTo(map);

    return () => {
      if (map.hasLayer(districtLayer)) map.removeLayer(districtLayer);
    };
  }, [map, districts, visible, selectedDistrict, onSelect, interactive]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// HOSPITALS LAYER
// ═══════════════════════════════════════════════════════════════════

function HospitalsLayer({ hospitals, visible }) {
  const map = useMap();
  const layerRef = useRef(L.layerGroup());

  useEffect(() => {
    if (!map) return;
    const hospitalLayer = layerRef.current;
    hospitalLayer.clearLayers();
    if (!visible || !hospitals || hospitals.length === 0) return;

    hospitals.forEach((h) => {
      const colors = { normal: '#2ed573', high_load: '#ffa502', critical: '#ff4757' };
      const color = colors[h.status] || '#6b7280';

      const icon = L.divIcon({
        className: 'hosp-icon',
        html: `<div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(10, 14, 39, 0.95); border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 0 10px ${color}80;">🏥</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker(h.coords, { icon })
        .bindPopup(`
          <div style="font-family: Inter; min-width: 220px;">
            <h3 style="margin: 0 0 8px; color: #00d4ff; font-size: 13px;">🏥 ${h.name}</h3>
            <div style="font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">Shtretër:</span><b>${h.beds ?? '—'}</b></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">ICU:</span><b>${h.icu ?? '—'}</b></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">Ventilatorë:</span><b>${h.ventilators ?? '—'}</b></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">Statusi:</span><b style="color: ${color};">${h.status.replace('_', ' ')}</b></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">Tipi:</span><b>${h.type}</b></div>
              ${h.address ? `<div style="font-size: 10px; color: #6b7280; margin-top: 4px;">📍 ${h.address}</div>` : ''}
            </div>
          </div>
        `, { className: 'custom-popup-clean' })
        .addTo(hospitalLayer);
    });

    hospitalLayer.addTo(map);
    return () => { if (map.hasLayer(hospitalLayer)) map.removeLayer(hospitalLayer); };
  }, [map, hospitals, visible]);

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// KOMPONENTI KRYESOR
// ═══════════════════════════════════════════════════════════════════

export default function PrishtinaMap({ mode = 'full', refreshKey = 0 }) {
  const { eventCount } = useWebSocket();
  const [metric, setMetric] = useState('reports');
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [heatmapPoints, setHeatmapPoints] = useState([]);
  const [heatmapSource, setHeatmapSource] = useState(null);
  const [projectedPoints, setProjectedPoints] = useState([]);
  const [projectedSource, setProjectedSource] = useState(null);
  const [liveState, setLiveState] = useState(null);
  const previousActiveRef = useRef(null);
  const [activeDelta, setActiveDelta] = useState(0);
  const [dispatchSummary, setDispatchSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [routeFrom, setRouteFrom] = useState(null);
  const [routeTo, setRouteTo] = useState(null);
  const [layers, setLayers] = useState({
    heatmap: true,
    markers: true,
    hospitals: true,
    ambulances: true,
    projected: true,
    agents: false,
    route: false,
  });

  // Ngarko të dhënat nga API (me fallback)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [{ data: districtsRes }, { data: hospitalsRes }, { data: heatmapRes }, { data: projectedRes }, { data: liveRes }] = await Promise.all([
          client.get('/map/districts'),
          client.get('/map/hospitals'),
          client.get('/map/heatmap-points?metric=reports'),
          client.get('/map/heatmap-points?metric=projected'),
          client.get('/pipeline/live'),
        ]);

        const probabilities = new Map((liveRes.hotspots || []).map((item) => [item.district, Number(item.hotspot_probability) || 0]));
        setDistricts(districtsRes.map((district) => ({
          ...district,
          ml_probability: probabilities.get(district.district),
        })));
        setHospitals(hospitalsRes);
        setHeatmapPoints(heatmapRes.points || []);
        setHeatmapSource(heatmapRes.data_source || null);
        setProjectedPoints(projectedRes.points || []);
        setProjectedSource(projectedRes.data_source || null);
        if (liveRes.active_cases != null && previousActiveRef.current != null) {
          setActiveDelta(Number(liveRes.active_cases) - Number(previousActiveRef.current));
        }
        if (liveRes.active_cases != null) {
          previousActiveRef.current = liveRes.active_cases;
        }
        setLiveState(liveRes);
        setApiAvailable(true);
        console.log('✓ Të dhënat u ngarkuan nga API');
      } catch (err) {
        console.warn('⚠ API nuk është i disponueshëm, përdor të dhëna lokale:', err);
        setApiAvailable(false);
        setDistricts([]);
        setHospitals([]);
        setHeatmapPoints([]);
        setProjectedPoints([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [refreshKey, eventCount]);

  useEffect(() => {
    let disposed = false;
    const loadDispatchSummary = async () => {
      try {
        const { data } = await client.get('/routing/dispatches/summary');
        if (!disposed) setDispatchSummary(data);
      } catch (error) {
        if (!disposed) setDispatchSummary(null);
        console.warn('Përmbledhja e dispatch-eve nuk u ngarkua:', error.message);
      }
    };

    loadDispatchSummary();
    const interval = setInterval(loadDispatchSummary, 10000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [refreshKey, eventCount]);

  // Rifresko heatmap kur ndryshon metrika
  useEffect(() => {
    const loadHeatmap = async () => {
      if (apiAvailable) {
        try {
          const { data } = await client.get(`/map/heatmap-points?metric=${metric}`);
          setHeatmapPoints(data.points || []);
          setHeatmapSource(data.data_source || null);
          return;
        } catch (err) {
          console.warn('Fallback për heatmap:', err);
        }
      }
      setHeatmapPoints([]);
    };
    loadHeatmap();
  }, [metric, apiAvailable, districts, eventCount]);

  // Përditëso orën çdo minutë
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleLayer = (key) => {
    if (key === 'route' && !layers.route && districts.length > 0) {
      setRouteFrom([42.6467, 21.1653]);
      setRouteTo([42.6629, 21.1655]);
    }
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isMini = mode === 'mini';

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {loading ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#9ca3af', fontSize: '0.8rem',
          background: '#0a0e27',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '2.5rem', height: '2.5rem',
              border: '3px solid #1e2655', borderTopColor: '#00d4ff',
              borderRadius: '50%', animation: 'spin 1s linear infinite',
              margin: '0 auto 0.75rem',
            }} />
            Duke ngarkuar hartën...
          </div>
        </div>
      ) : (
        <MapContainer
          center={PRISHTINA_CENTER}
          zoom={isMini ? 12 : 13}
          style={{ height: '100%', width: '100%', background: '#0a0e27' }}
          zoomControl
          attributionControl
          dragging
          scrollWheelZoom
          doubleClickZoom
          maxZoom={19}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            minZoom={3}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapResizeObserver />
          <HeatmapLayer points={heatmapPoints} visible={layers.heatmap} />
          <HeatmapLayer
            points={projectedPoints}
            visible={layers.projected}
            gradient={{
              0.2: 'rgba(167, 139, 250, 0.35)',
              0.5: 'rgba(124, 58, 237, 0.7)',
              0.8: 'rgba(236, 72, 153, 0.9)',
              1.0: 'rgba(190, 24, 93, 1)',
            }}
          />
          <DistrictMarkersLayer
            districts={districts}
            visible={layers.markers}
            selectedDistrict={selectedDistrict}
            onSelect={setSelectedDistrict}
            interactive
          />
          <HospitalsLayer hospitals={hospitals} visible={layers.hospitals} />

          {/* Ambulancat */}
          <AmbulanceLayer
            visible={layers.ambulances}
            emergencyLocations={[]}
            refreshKey={eventCount}
          />

          {/* Rrugët */}
          {layers.route && routeFrom && routeTo && (
            <RouteLayer
              visible={true}
              fromLocation={routeFrom}
              toLocation={routeTo}
              color="#00d4ff"
              label="Rruga e ambulancës"
            />
          )}

          {/* Agjentët virtualë */}
          <LiveAgentsLayer
            visible={layers.agents}
            currentHour={currentHour}
            agents={[]}
            maxAgents={150}
          />
        </MapContainer>
      )}

      {!isMini && !loading && (
        <>
          <LayerControl layers={layers} onToggle={toggleLayer} />
          <MetricSelector value={metric} onChange={setMetric} />
          <MapLegend />
          <HourIndicator hour={currentHour} />
          <LiveTelemetryPanel
            liveState={liveState}
            activeDelta={activeDelta}
            heatmapSource={heatmapSource}
            projectedSource={projectedSource}
          />
          <DispatchTelemetryPanel summary={dispatchSummary} />
        </>
      )}

      {!loading && !apiAvailable && (
        <div role="status" style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 1000, background: '#131938', border: '1px solid #ffa502', borderRadius: '.5rem', padding: '.5rem .75rem', color: '#ffa502', fontSize: '.7rem' }}>
          API jo i disponueshëm · shfaqet vetëm gjeometria e lagjeve
        </div>
      )}

      {isMini && !loading && (
        <div style={{
          position: 'absolute', bottom: '0.75rem', left: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          background: 'rgba(19, 25, 56, 0.9)',
          border: `1px solid ${apiAvailable ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 71, 87, 0.4)'}`,
          borderRadius: '0.4rem', padding: '0.3rem 0.6rem',
          fontSize: '0.6rem', color: apiAvailable ? '#2ed573' : '#ff4757', fontWeight: '700',
          letterSpacing: '0.05em', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: apiAvailable ? '#2ed573' : '#ff4757',
            boxShadow: `0 0 6px ${apiAvailable ? '#2ed573' : '#ff4757'}`,
            animation: 'pulse 2s infinite',
          }} />
          {apiAvailable ? 'API ONLINE' : 'API OFFLINE'}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .custom-popup-clean .leaflet-popup-content-wrapper {
          background: #131938 !important;
          color: #e8eaf6 !important;
          border: 1px solid #1e2655 !important;
          border-radius: 10px !important;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7) !important;
          padding: 0 !important;
        }
        .custom-popup-clean .leaflet-popup-content { margin: 12px !important; }
        .custom-popup-clean .leaflet-popup-tip {
          background: #131938 !important;
          border: 1px solid #1e2655 !important;
        }
        .custom-popup-clean .leaflet-popup-close-button {
          color: #9ca3af !important;
          font-size: 18px !important;
          padding: 8px !important;
        }
        .leaflet-control-zoom {
          border: 1px solid #1e2655 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        .leaflet-control-zoom a {
          background: #131938 !important;
          color: #e8eaf6 !important;
          border: none !important;
          border-bottom: 1px solid #1e2655 !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 18px !important;
        }
        .leaflet-control-zoom a:hover { background: #1e2655 !important; color: #00d4ff !important; }
        .leaflet-control-attribution { background: rgba(10, 14, 39, 0.78) !important; color: #cbd5e1 !important; border-radius: 5px 0 0 0; padding: 2px 5px !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #00d4ff !important; }
      `}</style>
    </div>
  );
}

function LiveTelemetryPanel({ liveState, activeDelta, heatmapSource, projectedSource }) {
  if (!liveState) return null;

  const measures = liveState.active_measures || [];
  const deltaColor = activeDelta > 0 ? '#ff4757' : activeDelta < 0 ? '#2ed573' : '#9ca3af';
  const deltaLabel = activeDelta > 0 ? `+${activeDelta}` : `${activeDelta}`;

  return (
    <div style={{
      position: 'absolute', left: '1rem', top: '1rem', zIndex: 1000,
      width: '230px', background: 'rgba(10, 14, 39, 0.94)',
      border: '1px solid #26346d', borderRadius: '.65rem',
      padding: '.75rem', color: '#e8eaf6', backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 28px rgba(0, 0, 0, .35)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.65rem' }}>
        <strong style={{ fontSize: '.72rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>Gjendja epidemiologjike</strong>
        <span style={{ color: liveState.running ? '#2ed573' : '#ffa502', fontSize: '.6rem', fontWeight: 800 }}>
          {liveState.running ? 'SIMULIM AKTIV' : 'I NDALUR'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.45rem' }}>
        <TelemetryValue label="Dita modelit" value={liveState.day ?? '—'} color="#00d4ff" />
        <TelemetryValue label="Aktive" value={liveState.stats?.active ?? '—'} color="#ff4757" />
        <TelemetryValue label="R(t)" value={liveState.stats?.rt != null ? Number(liveState.stats.rt).toFixed(2) : '—'} color="#ffa502" />
        <TelemetryValue label="Ndryshimi/tick" value={activeDelta ? deltaLabel : '—'} color={deltaColor} />
      </div>
      <div style={{ marginTop: '.65rem', paddingTop: '.55rem', borderTop: '1px solid #1e2655', fontSize: '.63rem', color: '#9ca3af' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Masa aktive</span><b style={{ color: '#e8eaf6' }}>{measures.length}</b>
        </div>
        <div style={{ marginTop: '.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {measures.length ? measures.map((measure) => measure.type).join(' · ') : 'Asnjë masë aktive'}
        </div>
      </div>
      <div style={{ marginTop: '.5rem', fontSize: '.58rem', color: '#64748b' }}>
        Raporte: {formatMapSource(heatmapSource)} · ML: {formatMapSource(projectedSource)}
      </div>
    </div>
  );
}

function TelemetryValue({ label, value, color }) {
  return (
    <div style={{ background: '#131938', borderRadius: '.35rem', padding: '.4rem' }}>
      <div style={{ color: '#64748b', fontSize: '.52rem', textTransform: 'uppercase' }}>{label}</div>
      <strong style={{ color, fontSize: '.95rem' }}>{value}</strong>
    </div>
  );
}

function formatMapSource(source) {
  const labels = {
    database_coordinates: 'koordinata reale',
    district_aggregate: 'agregim lagjeje',
    postgresql_ml_prediction: 'parashikim PostgreSQL',
    validated_ml_prediction: 'parashikim i validuar',
    ml_prediction_unavailable: 'i padisponueshëm',
  };
  return labels[source] || 'pa të dhëna';
}

function DispatchTelemetryPanel({ summary }) {
  if (!summary) return null;

  const fleet = summary.fleet || {};
  const dispatches = summary.dispatches || {};
  return (
    <div style={{
      position: 'absolute', right: '1rem', bottom: '1rem', zIndex: 1000,
      width: '230px', background: 'rgba(10, 14, 39, 0.94)',
      border: '1px solid #26346d', borderRadius: '.65rem',
      padding: '.75rem', color: '#e8eaf6', backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 28px rgba(0, 0, 0, .35)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '.6rem',
      }}>
        <strong style={{ fontSize: '.7rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Operacionet e flotës
        </strong>
        <span style={{ color: '#00d4ff', fontSize: '.58rem', fontWeight: 800 }}>10s LIVE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.35rem' }}>
        <TelemetryValue label="Të lira" value={fleet.available ?? '—'} color="#2ed573" />
        <TelemetryValue label="Aktive" value={fleet.active ?? '—'} color="#ffa502" />
        <TelemetryValue label="Gjithsej" value={fleet.total ?? '—'} color="#00d4ff" />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.35rem',
        marginTop: '.5rem', paddingTop: '.5rem', borderTop: '1px solid #1e2655',
      }}>
        <TelemetryValue label="Përfunduar" value={dispatches.completed ?? '—'} color="#2ed573" />
        <TelemetryValue label="Koha mes." value={`${summary.average_response_minutes ?? 0} min`} color="#a78bfa" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KONTROLLET
// ═══════════════════════════════════════════════════════════════════

function LayerControl({ layers, onToggle }) {
  const list = [
    { key: 'heatmap', label: 'Heatmap', icon: '🔥' },
    { key: 'projected', label: 'ML · risk i projektuar', icon: '◈' },
    { key: 'markers', label: 'Lagjet', icon: '📍' },
    { key: 'hospitals', label: 'Spitale', icon: '🏥' },
    { key: 'ambulances', label: 'Ambulanca', icon: '🚑' },
    { key: 'agents', label: 'Agjentë virtualë', icon: '👥' },
    { key: 'route', label: 'Rruga A*', icon: '🛣️' },
  ];

  return (
    <div style={{
      position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000,
      background: 'rgba(19, 25, 56, 0.95)', border: '1px solid #1e2655',
      borderRadius: '0.5rem', padding: '0.625rem', fontSize: '0.7rem',
      backdropFilter: 'blur(8px)', minWidth: '190px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    }}>
      <div style={{
        fontWeight: '700', color: '#e8eaf6', marginBottom: '0.5rem',
        fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        🗂️ Shtresat
      </div>
      {list.map((l) => (
        <label key={l.key} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.25rem 0.375rem', borderRadius: '0.25rem',
          cursor: 'pointer', marginBottom: '0.125rem',
          color: layers[l.key] ? '#e8eaf6' : '#6b7280',
          background: layers[l.key] ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
        }}>
          <input
            type="checkbox"
            checked={layers[l.key]}
            onChange={() => onToggle(l.key)}
            style={{ cursor: 'pointer', accentColor: '#00d4ff', width: '12px', height: '12px' }}
          />
          <span style={{ fontSize: '0.85rem' }}>{l.icon}</span>
          <span style={{ fontSize: '0.7rem' }}>{l.label}</span>
        </label>
      ))}
    </div>
  );
}

function MetricSelector({ value, onChange }) {
  const metrics = [
    { key: 'reports', label: 'Raporte · 7 ditë', icon: '📊' },
    { key: 'confirmed', label: 'Konfirmuar', icon: '✓' },
  ];

  return (
    <div style={{
      position: 'absolute', top: '1rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 1000,
      background: 'rgba(19, 25, 56, 0.95)', border: '1px solid #1e2655',
      borderRadius: '0.5rem', padding: '0.3rem', display: 'flex',
      gap: '0.2rem', backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    }}>
      {metrics.map((m) => (
        <button key={m.key} onClick={() => onChange(m.key)} style={{
          padding: '0.35rem 0.65rem',
          background: value === m.key ? 'linear-gradient(135deg, #00d4ff, #7b2ff7)' : 'transparent',
          color: value === m.key ? 'white' : '#9ca3af',
          border: 'none', borderRadius: '0.35rem', fontSize: '0.65rem',
          fontWeight: '700', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.3rem',
        }}>
          <span>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function HourIndicator({ hour }) {
  const getPeriodLabel = () => {
    if (hour >= 0 && hour < 7) return '🌙 Natë (shtëpi)';
    if (hour >= 7 && hour < 9) return '🌅 Mëngjes (lëvizje)';
    if (hour >= 9 && hour < 17) return '☀️ Ditë (punë/shkollë)';
    if (hour >= 17 && hour < 20) return '🌆 Mbrëmje (lëvizje)';
    if (hour >= 20 && hour < 23) return '🌃 Natë (shtëpi)';
    return '🌙 Natë (shtëpi)';
  };

  return (
    <div style={{
      position: 'absolute', top: '1rem', right: '230px', zIndex: 1000,
      background: 'rgba(19, 25, 56, 0.95)', border: '1px solid #1e2655',
      borderRadius: '0.5rem', padding: '0.5rem 0.75rem',
      fontSize: '0.7rem', color: '#00d4ff', fontWeight: 700,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    }}>
      🕐 {String(hour).padStart(2, '0')}:00
      <span style={{ marginLeft: '0.5rem', color: '#9ca3af', fontWeight: 500 }}>
        {getPeriodLabel()}
      </span>
    </div>
  );
}

function MapLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: '1rem', left: '1rem', zIndex: 1000,
      background: 'rgba(19, 25, 56, 0.95)', border: '1px solid #1e2655',
      borderRadius: '0.5rem', padding: '0.625rem 0.875rem',
      fontSize: '0.65rem', color: '#9ca3af', backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    }}>
      <div style={{
        fontWeight: '700', color: '#e8eaf6', marginBottom: '0.4rem',
        fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        🎨 Vëllimi i raporteve
      </div>
      {[
        { color: '#ff4757', label: 'Kritik' },
        { color: '#ff6348', label: 'I lartë' },
        { color: '#ffa502', label: 'Mesatar' },
        { color: '#2ed573', label: 'I ulët' },
        { color: '#3b82f6', label: 'Minimal' },
      ].map((item) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.2rem', fontSize: '0.65rem',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: item.color, boxShadow: `0 0 6px ${item.color}`,
          }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}