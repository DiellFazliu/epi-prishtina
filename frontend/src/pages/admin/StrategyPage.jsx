import { useEffect, useState } from 'react';
import client from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const INITIAL_MEASURES = [
  { id: 'movement_restriction', icon: '🛡️', title: 'Kufizim i lëvizjes', description: 'Kufizim i lëvizjes në zona me rrezik të lartë', target: 'Dardania, Qendra', enabled: false },
  { id: 'venue_closures', icon: '🏪', title: 'Mbyllja e lokaleve', description: 'Mbyllja e lokaleve pas orës 22:00', target: 'E gjithë Prishtina', enabled: false },
  { id: 'testing', icon: '🧪', title: 'Rritja e testimeve', description: 'Testim më i shpejtë dhe izolim i rasteve pozitive', target: 'Zonat me rrezik të lartë', enabled: false },
  { id: 'remote_work', icon: '🏢', title: 'Punë nga shtëpia', description: 'Ul kontaktet në vendet e punës', target: 'Sektori privat', enabled: false },
  { id: 'vaccination', icon: '💉', title: 'Fushatë vaksinimi', description: 'Rrit mbulimin e vaksinimit në popullsinë e ndjeshme', target: 'Shkolla, universitete', enabled: false },
  { id: 'transport_restriction', icon: '🚌', title: 'Kufizim transporti', description: 'Ul dendësinë dhe kontaktet në transport publik', target: 'E gjithë Prishtina', enabled: false },
];

export default function StrategyPage() {
  const { hasRole } = useAuth();
  const canOperate = hasRole(['admin', 'health_worker']);
  const [measures, setMeasures] = useState(INITIAL_MEASURES);
  const [preview, setPreview] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    client.get('/simulation/strategy/status').then(({ data }) => {
      if (!mounted || !data.measures) return;
      const activeTypes = new Set(data.measures.map((measure) => measure.type));
      setMeasures((current) => current.map((measure) => ({ ...measure, enabled: activeTypes.has(measure.id) })));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const payload = () => ({
    days: 30,
    measures: measures.filter((measure) => measure.enabled).map(({ id, target }) => ({
      type: id,
      target_district: target,
      intensity: 1,
    })),
  });

  const calculateImpact = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await client.post('/simulation/strategy/preview', payload());
      setPreview(data);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Nuk u llogarit skenari. Kontrollo lidhjen me API-në.');
    } finally {
      setBusy(false);
    }
  };

  const calculateRecommendations = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await client.get('/simulation/strategy/recommendations', { params: { days: 30 } });
      setRecommendations(data);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Nuk u krijuan rekomandimet. Kontrollo lidhjen me API-në.');
    } finally {
      setBusy(false);
    }
  };

  const selectRecommendations = () => {
    const suggestedTypes = new Set((recommendations?.recommendations || []).slice(0, 3).map((item) => item.type));
    setMeasures((current) => current.map((measure) => ({ ...measure, enabled: suggestedTypes.has(measure.id) })));
    setMessage('Masat e renditura janë zgjedhur për simulim. Llogarit ndikimin dhe zbatoji veçmas.');
  };

  const applyMeasures = async () => {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await client.post('/simulation/strategy/apply', payload());
      setMessage(`Masat u ruajtën. Ndikojnë nga dita ${data.effective_from_day} e simulimit.`);
      const { data: updatedPreview } = await client.post('/simulation/strategy/preview', payload());
      setPreview(updatedPreview);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Masat nuk u ruajtën. Kontrollo API-në dhe të drejtat e llogarisë.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => setMeasures((current) => current.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
  const enabledCount = measures.filter((measure) => measure.enabled).length;

  return (
    <main>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '.5rem' }}>🎯 Strategji dhe masa</h1>
        <p style={{ color: '#9ca3af' }}>Llogarit skenarin, pastaj ruaji masat për hapat vijues të simulimit.</p>
      </header>

      <section aria-label="Masat që mund të zbatohen" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {measures.map((measure) => (
          <label key={measure.id} style={{ display: 'flex', gap: '.875rem', alignItems: 'flex-start', background: '#131938', border: `1px solid ${measure.enabled ? 'rgba(0,212,255,.45)' : '#1e2655'}`, borderRadius: '.75rem', padding: '1.1rem', cursor: 'pointer', opacity: measure.enabled ? 1 : .72 }}>
            <input type="checkbox" checked={measure.enabled} onChange={() => toggle(measure.id)} style={{ marginTop: '.35rem', accentColor: '#00d4ff' }} />
            <span style={{ fontSize: '1.4rem' }} aria-hidden="true">{measure.icon}</span>
            <span>
              <strong style={{ display: 'block', color: '#e8eaf6', marginBottom: '.35rem' }}>{measure.title}</strong>
              <span style={{ display: 'block', color: '#9ca3af', fontSize: '.8rem', lineHeight: 1.45 }}>{measure.description}</span>
              <span style={{ display: 'block', color: '#00d4ff', fontSize: '.7rem', marginTop: '.55rem' }}>Zona: {measure.target}</span>
            </span>
          </label>
        ))}
      </section>

      {preview && <section aria-live="polite" style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <strong>Projeksion {preview.baseline.days}-ditor · {preview.model}</strong>
        <p style={{ color: '#cbd5e1', marginTop: '.5rem', fontSize: '.85rem' }}>
          Raste të reja: {preview.baseline.new_cases.toLocaleString()} pa masa, {preview.with_measures.new_cases.toLocaleString()} me masa. Shmangie e vlerësuar: {preview.estimated_cases_avoided.toLocaleString()} ({preview.relative_reduction_percent}%).
        </p>
        <p style={{ color: '#9ca3af', marginTop: '.35rem', fontSize: '.75rem' }}>R(t) me masa: {preview.with_measures.rt_at_end} · Aktivë në kulm: {preview.with_measures.peak_active.toLocaleString()}</p>
        <p style={{ color: '#ffa502', marginTop: '.45rem', fontSize: '.72rem' }}>{preview.disclaimer}</p>
      </section>}
      {recommendations && <section aria-live="polite" style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <strong>Masat sipas ndikimit shtesë të vlerësuar · {recommendations.days} ditë</strong>
        <ol style={{ color: '#cbd5e1', margin: '.75rem 0 0', paddingLeft: '1.25rem' }}>
          {recommendations.recommendations.slice(0, 3).map((item) => (
            <li key={item.type} style={{ marginBottom: '.35rem' }}>
              {measures.find((measure) => measure.id === item.type)?.title || item.type}: rreth {item.estimated_additional_cases_avoided.toLocaleString()} raste më pak se projeksioni aktual.
            </li>
          ))}
        </ol>
        {!recommendations.recommendations.length && <p style={{ color: '#9ca3af', marginTop: '.5rem', fontSize: '.8rem' }}>Modeli nuk vlerëson ulje shtesë të rasteve nga masat e mbetura në këtë gjendje.</p>}
        <p style={{ color: '#ffa502', marginTop: '.5rem', fontSize: '.72rem' }}>{recommendations.disclaimer}</p>
        {canOperate && <button type="button" disabled={!recommendations.recommendations.length} onClick={selectRecommendations} style={{ ...buttonStyle('#1e2655', '#00d4ff'), marginTop: '.5rem', opacity: recommendations.recommendations.length ? 1 : .5 }}>Përzgjedh këto masa</button>}
      </section>}
      {message && <p role="status" style={{ color: message.startsWith('Masat u ruajtën') ? '#2ed573' : '#ffa502', marginBottom: '1rem', fontSize: '.85rem' }}>{message}</p>}

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1.25rem' }}>
        <div><span style={{ display: 'block', color: '#9ca3af', fontSize: '.8rem' }}>Masa të zgjedhura</span><strong style={{ fontSize: '1.25rem' }}>{enabledCount} / {measures.length}</strong></div>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy || !canOperate} onClick={calculateRecommendations} style={buttonStyle('#1e2655', '#00d4ff')}>
            {busy ? 'Duke llogaritur…' : 'Sugjero masa nga modeli'}
          </button>
          <button type="button" disabled={busy || !canOperate || enabledCount === 0} onClick={calculateImpact} style={buttonStyle('#1e2655', '#00d4ff')}>
            {busy ? 'Duke llogaritur…' : 'Llogarit ndikimin'}
          </button>
          <button type="button" disabled={busy || !canOperate || enabledCount === 0} onClick={applyMeasures} style={buttonStyle('linear-gradient(135deg,#2ed573,#00d4ff)', '#fff')}>
            {busy ? 'Duke ruajtur…' : 'Zbato planin e masave'}
          </button>
        </div>
      </footer>
    </main>
  );
}

function buttonStyle(background, color) {
  return { padding: '.8rem 1.1rem', background, color, border: '1px solid #304080', borderRadius: '.5rem', fontWeight: 700, cursor: 'pointer' };
}
