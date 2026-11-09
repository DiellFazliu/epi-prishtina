import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import client from '../../api/client';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../contexts/AuthContext';

const PRISHTINA_CENTER = [42.6629, 21.1655];

const HOSPITALS = [
  { name: 'QKUK', lat: 42.6467, lon: 21.1653 },
  { name: 'Spitali i Prishtinës', lat: 42.6680, lon: 21.1580 },
  { name: 'Klinika Infektive', lat: 42.6447, lon: 21.1611 },
  { name: 'Klinika Pediatrike', lat: 42.6546, lon: 21.1714 },
  { name: 'Spitali Amerikan', lat: 42.6490, lon: 21.1690 },
  { name: 'Spitali Gjerman', lat: 42.6555, lon: 21.1580 },
];

const DISTRICTS = [
  { name: 'Qendra', lat: 42.6629, lon: 21.1655 },
  { name: 'Dardania', lat: 42.6555, lon: 21.1585 },
  { name: 'Ulpiana', lat: 42.6580, lon: 21.1720 },
  { name: 'Arbëria', lat: 42.6700, lon: 21.1480 },
  { name: 'Kalabria', lat: 42.6480, lon: 21.1610 },
  { name: 'Bregu i Diellit', lat: 42.6520, lon: 21.1780 },
  { name: 'Sunny Hill', lat: 42.6450, lon: 21.1700 },
];

function RouteVisualizer({ route }) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.length === 0) return;
    try {
      const bounds = L.latLngBounds(route.map(([lat, lon]) => [lat, lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (err) {
      console.warn('Nuk mund të fokusohet rruga:', err);
    }
  }, [map, route]);
  return null;
}

export default function RoutingPage() {
  const { hasRole } = useAuth();
  const canDispatch = hasRole(['admin', 'health_worker']);
  const [ambulances, setAmbulances] = useState([]);
  const [error, setError] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const { lastEvent } = useWebSocket();

  // Route form
  const [fromLocation, setFromLocation] = useState(HOSPITALS[0]);
  const [toLocation, setToLocation] = useState(DISTRICTS[0]);
  const [calculatedRoute, setCalculatedRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Dispatch
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  const loadAmbulances = async () => {
    setError(null);
    try {
      const { data } = await client.get('/routing/ambulances');
      setAmbulances(data.ambulances || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ambulancat nuk mund të ngarkohen');
      setAmbulances([]);
    }
  };

  const loadHotspots = async () => {
    try {
      const { data } = await client.get('/hotspots');
      setHotspots(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Hotspot-et nuk mund të ngarkohen.');
    }
  };

  useEffect(() => {
    const refresh = () => {
      loadAmbulances();
      loadHotspots();
    };
    queueMicrotask(refresh);
  }, []);

  useEffect(() => {
    if (!['routing:dispatch', 'hotspot:updated', 'simulation:update'].includes(lastEvent?.type)) return;
    queueMicrotask(() => {
      loadAmbulances();
      loadHotspots();
    });
  }, [lastEvent?.type]);

  const calculateRoute = async () => {
    setCalculating(true);
    setError(null);
    try {
      const { data } = await client.post('/routing/route', {
        from_lat: fromLocation.lat,
        from_lon: fromLocation.lon,
        to_lat: toLocation.lat,
        to_lon: toLocation.lon,
        algorithm: 'astar',
      });
      setCalculatedRoute(data.coordinates);
      setRouteInfo({
        distance_km: (data.distance_m / 1000).toFixed(2),
        time_minutes: (data.time_seconds / 60).toFixed(2),
        algorithm: data.algorithm,
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Rruga nuk mund të kalkulohet');
    } finally {
      setCalculating(false);
    }
  };

  const runDispatch = async () => {
    setDispatching(true);
    setError(null);
    try {
      const emergencies = hotspots
        .slice()
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5)
        .map((hotspot) => {
          const district = DISTRICTS.find((item) => item.name === hotspot.district);
          return district ? {
            district: district.name,
            lat: district.lat,
            lon: district.lon,
            severity: Math.max(1, Math.min(5, Math.ceil(hotspot.probability * 5))),
          } : null;
        })
        .filter(Boolean);
      if (!emergencies.length) throw new Error('Nuk ka hotspot-e të disponueshme për dispatch.');

      const { data } = await client.post('/routing/dispatch', { emergencies });
      setDispatchResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Dispatch nuk mund të ekzekutohet');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#e8eaf6', marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>
          🚑 Dispatch i Ambulancave
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Routing A* dhe caktim optimal me Hungarian Algorithm
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: '1rem', padding: '0.75rem 1rem',
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          borderRadius: '0.5rem',
          color: '#ff4757', fontSize: '0.875rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Ambulanca" value={ambulances.length} color="#00d4ff" icon="🚑" />
        <StatCard
          label="Të Disponueshme"
          value={ambulances.filter((a) => a.status === 'available').length}
          color="#2ed573"
          icon="✓"
        />
        <StatCard
          label="Në Rrugë"
          value={ambulances.filter((a) => a.status === 'en_route').length}
          color="#ffa502"
          icon="🛣️"
        />
        <StatCard label="Spitale" value={HOSPITALS.length} color="#7b2ff7" icon="🏥" />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Map */}
        <div style={{
          background: '#131938', border: '1px solid #1e2655',
          borderRadius: '0.75rem', overflow: 'hidden',
          height: '600px', position: 'relative',
        }}>
          <MapContainer
            center={PRISHTINA_CENTER}
            zoom={13}
            style={{ height: '100%', width: '100%', background: '#0a0e27' }}
            zoomControl
            attributionControl={false}
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            {/* Spitals */}
            {HOSPITALS.map((h) => (
              <Marker
                key={h.name}
                position={[h.lat, h.lon]}
                icon={L.divIcon({
                  className: 'hospital-marker',
                  html: `<div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(10, 14, 39, 0.95); border: 2px solid #2ed573; display: flex; align-items: center; justify-content: center; font-size: 13px;">🏥</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Popup><b style={{ color: '#2ed573' }}>🏥 {h.name}</b></Popup>
              </Marker>
            ))}

            {/* Districts (Emergencies) */}
            {DISTRICTS.map((d) => (
              <Marker
                key={d.name}
                position={[d.lat, d.lon]}
                icon={L.divIcon({
                  className: 'district-marker',
                  html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: rgba(10, 14, 39, 0.95); border: 2px solid #ff4757; display: flex; align-items: center; justify-content: center; font-size: 10px;">🔴</div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              >
                <Popup><b style={{ color: '#ff4757' }}>📍 {d.name}</b></Popup>
              </Marker>
            ))}

            {/* Ambulances */}
            {ambulances.map((amb) => {
              const color = amb.status === 'available' ? '#2ed573' :
                            amb.status === 'en_route' ? '#ffa502' : '#ff4757';
              return (
                <Marker
                  key={amb.id}
                  position={[amb.current_lat, amb.current_lon]}
                  icon={L.divIcon({
                    className: 'ambulance-marker',
                    html: `<div style="width: 28px; height: 28px; border-radius: 8px; background: rgba(10, 14, 39, 0.95); border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 0 10px ${color}80;">🚑</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                  })}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter', fontSize: '12px' }}>
                      <b style={{ color: '#00d4ff' }}>🚑 Ambulanca #{amb.id}</b><br />
                      <b>Spitali:</b> {amb.hospital}<br />
                      <b>Statusi:</b> <span style={{ color }}>{amb.status}</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Calculated Route */}
            {calculatedRoute && (
              <>
                <Polyline
                  positions={calculatedRoute}
                  pathOptions={{ color: '#00d4ff', weight: 4, opacity: 0.85 }}
                />
                <Marker
                  position={[fromLocation.lat, fromLocation.lon]}
                  icon={L.divIcon({
                    className: 'from-marker',
                    html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: #2ed573; border: 2px solid white;"></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  })}
                >
                  <Popup><b style={{ color: '#2ed573' }}>🚑 {fromLocation.name}</b></Popup>
                </Marker>
                <Marker
                  position={[toLocation.lat, toLocation.lon]}
                  icon={L.divIcon({
                    className: 'to-marker',
                    html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: #ff4757; border: 2px solid white;"></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  })}
                >
                  <Popup><b style={{ color: '#ff4757' }}>🎯 {toLocation.name}</b></Popup>
                </Marker>
                <RouteVisualizer route={calculatedRoute} />
              </>
            )}
          </MapContainer>

          {/* Route Info Overlay */}
          {routeInfo && (
            <div style={{
              position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000,
              background: 'rgba(19, 25, 56, 0.95)',
              border: '1px solid #00d4ff',
              borderRadius: '0.5rem', padding: '0.75rem 1rem',
              fontSize: '0.75rem', color: '#00d4ff', fontWeight: 600,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            }}>
              <div>🛣️ {routeInfo.distance_km} km</div>
              <div>⏱️ {routeInfo.time_minutes} min</div>
              <div>📐 {routeInfo.algorithm}</div>
            </div>
          )}
        </div>

        {/* Right Panel: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Route Calculator */}
          <div style={{
            background: '#131938', border: '1px solid #1e2655',
            borderRadius: '0.75rem', padding: '1.25rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8eaf6', marginBottom: '1rem' }}>
              🛣️ Kalkulo Rrugën A*
            </h3>

            <label style={labelStyle}>Nga (Spitali)</label>
            <select
              value={fromLocation.name}
              onChange={(e) => setFromLocation(HOSPITALS.find((h) => h.name === e.target.value))}
              style={selectStyle}
            >
              {HOSPITALS.map((h) => (
                <option key={h.name} value={h.name}>{h.name}</option>
              ))}
            </select>

            <label style={labelStyle}>Deri (Zona)</label>
            <select
              value={toLocation.name}
              onChange={(e) => setToLocation(DISTRICTS.find((d) => d.name === e.target.value))}
              style={selectStyle}
            >
              {DISTRICTS.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>

            <button
              onClick={calculateRoute}
              disabled={!canDispatch || calculating}
              disabled={calculating}
              style={{
                width: '100%', marginTop: '1rem',
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
                border: 'none', borderRadius: '0.5rem',
                color: 'white', fontWeight: 700, cursor: calculating ? 'wait' : 'pointer',
                fontSize: '0.875rem', opacity: calculating ? 0.6 : 1,
              }}
            >
              {calculating ? '⏳ Duke kalkuluar...' : '▶ Kalkulo Rrugën'}
            </button>

            {routeInfo && (
              <div style={{
                marginTop: '0.75rem', padding: '0.75rem',
                background: '#0a0e27', borderRadius: '0.5rem',
                fontSize: '0.75rem', color: '#9ca3af',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Distanca:</span>
                  <b style={{ color: '#00d4ff' }}>{routeInfo.distance_km} km</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Koha:</span>
                  <b style={{ color: '#00d4ff' }}>{routeInfo.time_minutes} min</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Algoritmi:</span>
                  <b style={{ color: '#2ed573' }}>{routeInfo.algorithm}</b>
                </div>
              </div>
            )}
          </div>

          {/* Dispatch Panel */}
          <div style={{
            background: '#131938', border: '1px solid #1e2655',
            borderRadius: '0.75rem', padding: '1.25rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8eaf6', marginBottom: '1rem' }}>
              🚨 Dispatch Automatik
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem', lineHeight: 1.5 }}>
              Krijon 5 emergjenca të rastësishme dhe cakton ambulancat optimale me Hungarian Algorithm.
            </p>

            <button
              onClick={runDispatch}
              disabled={!canDispatch || dispatching}
              disabled={dispatching}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #ff4757, #ffa502)',
                border: 'none', borderRadius: '0.5rem',
                color: 'white', fontWeight: 700, cursor: dispatching ? 'wait' : 'pointer',
                fontSize: '0.875rem', opacity: dispatching ? 0.6 : 1,
              }}
            >
              {dispatching ? '⏳ Duke dispatch-uar...' : '🚑 Ekzekuto Dispatch'}
            </button>
          </div>

          {/* Dispatch Results */}
          {dispatchResult && (
            <div style={{
              background: '#131938', border: '1px solid #1e2655',
              borderRadius: '0.75rem', padding: '1.25rem',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e8eaf6', marginBottom: '0.75rem' }}>
                ✓ Rezultati i Dispatch
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                {dispatchResult.dispatches?.slice(0, 8).map((d) => (
                  <div key={d.emergency_id} style={{
                    padding: '0.5rem 0.75rem',
                    background: '#0a0e27',
                    border: '1px solid #1e2655',
                    borderRadius: '0.4rem',
                    fontSize: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <b style={{ color: '#00d4ff' }}>🚑 #{d.ambulance_id}</b>
                      <span style={{ color: '#ffa502' }}>{d.time_minutes} min</span>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                      {d.district} · {d.distance_km} km
                    </div>
                  </div>
                ))}
              </div>
              {dispatchResult.stats && (
                <div style={{
                  marginTop: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid #1e2655',
                  fontSize: '0.75rem', color: '#9ca3af',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Koha mesatare:</span>
                    <b style={{ color: '#2ed573' }}>{dispatchResult.stats.avg_response_time?.toFixed(1)} min</b>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: '#131938', border: '1px solid #1e2655',
      borderRadius: '0.75rem', padding: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem',
  color: '#9ca3af',
  textTransform: 'uppercase',
  fontWeight: 700,
  letterSpacing: '0.05em',
  marginBottom: '0.375rem',
  marginTop: '0.75rem',
};

const selectStyle = {
  width: '100%',
  background: '#0a0e27',
  border: '1px solid #1e2655',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  color: 'white',
  fontSize: '0.825rem',
  outline: 'none',
  cursor: 'pointer',
};
