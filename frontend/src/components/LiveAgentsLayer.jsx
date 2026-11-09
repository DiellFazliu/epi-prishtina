import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import client from '../api/client';

/**
 * LiveAgentsLayer — Shfaq agjentët virtualë në pozicionin
 * e tyre sipas orës së ditës.
 */
export default function LiveAgentsLayer({
  visible = false,
  currentHour = 12,
  agents: externalAgents = [],
  maxAgents = 200,
}) {
  const map = useMap();
  const layerRef = useRef(L.layerGroup());
  const [agents, setAgents] = useState([]);

  // Ngarko agjentët nëse nuk janë dhënë
  useEffect(() => {
    if (!visible || externalAgents.length > 0) return;
    if (agents.length > 0) return;

    const loadAgents = async () => {
      try {
        // Provo të lexosh nga API
        const { data } = await client.get('/population/sample', {
          params: { limit: maxAgents },
        });
        setAgents(data.agents || []);
      } catch (err) {
        console.warn('Agjentët realë nuk u ngarkuan nga API:', err.message);
        setAgents([]);
      }
    };

    loadAgents();
  }, [visible, externalAgents, maxAgents, agents.length]);

  const agentsList = externalAgents.length > 0 ? externalAgents : agents;

  // Shfaq agjentët
  useEffect(() => {
    if (!map) return;
    layerRef.current.clearLayers();

    if (!visible || agentsList.length === 0) {
      if (map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
      return;
    }

    // Për performancë — kufizo numrin
    const sample = agentsList.slice(0, maxAgents);

    sample.forEach((agent) => {
      // Zgjidh lokacionin sipas orës dhe aktivitetit
      let lat, lon, activityLabel;

      const isChildOrRetired =
        agent.activity_type === 'child' || agent.activity_type === 'retired';

      if (isChildOrRetired) {
        lat = agent.home_lat;
        lon = agent.home_lon;
        activityLabel = '🏠 Shtëpi';
      } else if (currentHour >= 8 && currentHour <= 17) {
        lat = agent.work_lat;
        lon = agent.work_lon;
        activityLabel =
          agent.work_type === 'school' ? '🏫 Shkollë' :
          agent.work_type === 'university' ? '🎓 Universitet' : '🏢 Punë';
      } else {
        lat = agent.home_lat;
        lon = agent.home_lon;
        activityLabel = '🏠 Shtëpi';
      }

      // Ngjyra sipas gjendjes shëndetësore
      const colors = {
        S: '#2ed573',
        E: '#ffa502',
        I_mild: '#ff6348',
        I_severe: '#ff4757',
        H: '#8B0000',
        ICU: '#8B0000',
        R: '#00d4ff',
        D: '#6b7280',
      };
      const color = colors[agent.health_state] || '#6b7280';

      L.circleMarker([lat, lon], {
        radius: 3.5,
        color: 'white',
        weight: 0.5,
        fillColor: color,
        fillOpacity: 0.85,
      })
        .bindPopup(`
          <div style="font-family: Inter; font-size: 11px;">
            <b>Agjenti #${agent.id}</b><br/>
            <b>Mosha:</b> ${agent.age}<br/>
            <b>Aktiviteti:</b> ${activityLabel}<br/>
            <b>Gjendja:</b> <span style="color: ${color}; font-weight: 700;">${agent.health_state}</span><br/>
            <b>Lagjja:</b> ${agent.home_district || '—'}
          </div>
        `)
        .addTo(layerRef.current);
    });

    layerRef.current.addTo(map);

    const layer = layerRef.current;
    return () => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [map, agentsList, currentHour, visible, maxAgents]);

  return null;
}
