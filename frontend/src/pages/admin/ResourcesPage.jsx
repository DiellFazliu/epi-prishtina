import { useEffect, useMemo, useState } from 'react';
import client from '../../api/client';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../contexts/AuthContext';

const RESOURCE_INFO = {
  ambulance: { label: 'Ambulanca', icon: '🚑', color: '#ff4757' },
  testing_unit: { label: 'Njësi testimi', icon: '🧪', color: '#ffa502' },
  bed: { label: 'Shtretër spitalorë', icon: '🛏️', color: '#00d4ff' },
  vaccine: { label: 'Doza vaksine', icon: '💉', color: '#2ed573' },
  staff: { label: 'Personel mjekësor', icon: '🧑‍⚕️', color: '#7b2ff7' },
};

export default function ResourcesPage() {
  const { isAdmin, hasRole } = useAuth();
  const canOptimize = hasRole(['admin', 'health_worker']);
  const [allocations, setAllocations] = useState([]);
  const [inventory, setInventory] = useState({});
  const [inventoryUpdatedAt, setInventoryUpdatedAt] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingType, setEditingType] = useState(null);
  const [savingType, setSavingType] = useState(null);
  const { lastEvent } = useWebSocket();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      client.get('/resources'),
      client.get('/resources/summary'),
      client.get('/resources/runs'),
    ]).then(([allocationResponse, summaryResponse, runsResponse]) => {
      if (!mounted) return;
      setAllocations(allocationResponse.data);
      setInventory(summaryResponse.data.inventory || {});
      setInventoryUpdatedAt(summaryResponse.data.inventory_updated_at || null);
      setRuns(Array.isArray(runsResponse.data) ? runsResponse.data : []);
    })
      .catch((reason) => { if (mounted) setError(reason.response?.data?.detail || 'Alokimet nuk mund të ngarkohen.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!['resource:allocated', 'resource:inventory_updated'].includes(lastEvent?.type)) return;
    Promise.all([client.get('/resources'), client.get('/resources/summary'), client.get('/resources/runs')])
      .then(([allocationResponse, summaryResponse, runsResponse]) => {
        setAllocations(allocationResponse.data);
        setInventory(summaryResponse.data.inventory || {});
        setInventoryUpdatedAt(summaryResponse.data.inventory_updated_at || null);
        setRuns(Array.isArray(runsResponse.data) ? runsResponse.data : []);
      })
      .catch((reason) => setError(reason.response?.data?.detail || 'Alokimet nuk mund të rifreskohen.'));
  }, [lastEvent]);

  const totals = useMemo(() => Object.entries(RESOURCE_INFO).map(([type, info]) => ({
    type,
    ...info,
    allocated: allocations.filter((item) => item.resource_type === type).reduce((sum, item) => sum + item.quantity, 0),
    capacity: inventory[type] ?? 0,
  })), [allocations, inventory]);

  const districts = useMemo(() => [...new Set(allocations.map((item) => item.district))].sort(), [allocations]);
  const optimize = async () => {
    setOptimizing(true);
    setError('');
    setNotice('');
    try {
      const { data } = await client.post('/resources/optimize');
      setAllocations(data.allocations);
      const { data: history } = await client.get('/resources/runs');
      setRuns(Array.isArray(history) ? history : []);
      setNotice(`Alokimi u rillogarit me ${data.allocation_count} caktime. Kostoja totale: ${Number(data.total_cost).toLocaleString()}.`);
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Optimizimi dështoi. Kontrollo të dhënat e parashikimeve dhe autorizimin.');
    } finally {
      setOptimizing(false);
    }
  };

  const updateInventory = async (type, value) => {
    const totalQuantity = Number(value);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 0) {
      setError('Kapaciteti duhet të jetë numër i plotë pozitiv ose zero.');
      return;
    }
    setSavingType(type);
    setError('');
    setNotice('');
    try {
      const { data } = await client.patch(`/resources/inventory/${type}`, { total_quantity: totalQuantity });
      setInventory((current) => ({ ...current, [type]: data.total_quantity }));
      setInventoryUpdatedAt(data.updated_at);
      setEditingType(null);
      setNotice(`Kapaciteti për ${RESOURCE_INFO[type].label.toLowerCase()} u përditësua.`);
    } catch (reason) {
      setError(reason.response?.data?.detail || 'Kapaciteti nuk mund të përditësohet.');
    } finally {
      setSavingType(null);
    }
  };

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '.5rem' }}>🚑 Menaxhimi i burimeve</h1>
          <p style={{ color: '#9ca3af' }}>Rillogarit alokimin nga parashikimet ML dhe kapacitetet aktuale të inventarit.</p>
        </div>
        <button type="button" onClick={optimize} disabled={!canOptimize || optimizing} style={{ padding: '.75rem 1.1rem', background: 'linear-gradient(135deg,#00d4ff,#7b2ff7)', color: 'white', border: 0, borderRadius: '.5rem', fontWeight: 700, cursor: !canOptimize || optimizing ? 'not-allowed' : 'pointer', opacity: !canOptimize || optimizing ? .65 : 1 }}>
          {optimizing ? 'Duke optimizuar…' : '✨ Rillogarit alokimin'}
        </button>
      </header>

      {error && <p role="alert" style={{ color: '#ff7b86', marginBottom: '1rem' }}>{error}</p>}
      {notice && <p role="status" style={{ color: '#2ed573', marginBottom: '1rem' }}>{notice}</p>}
      <p style={{ color: '#9ca3af', fontSize: '.75rem', marginBottom: '1rem' }}>
        Kapacitetet lexohen nga inventari i PostgreSQL; alokimet janë rezultat i fundit i optimizuesit.
        {inventoryUpdatedAt && ` Përditësuar: ${new Date(inventoryUpdatedAt).toLocaleString('sq-AL')}.`}
      </p>
      {loading ? <p role="status" style={{ color: '#9ca3af' }}>Duke ngarkuar alokimet…</p> : <>
        <section aria-label="Përmbledhje e burimeve" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {totals.map((item) => {
            const percent = item.capacity ? Math.min(100, item.allocated / item.capacity * 100) : 0;
            return <article key={item.type} style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.6rem' }}><span style={{ fontSize: '1.35rem' }}>{item.icon}</span><strong style={{ color: item.color }}>{percent.toFixed(0)}%</strong></div>
              <p style={{ color: '#9ca3af', fontSize: '.7rem', textTransform: 'uppercase', marginBottom: '.35rem' }}>{item.label}</p>
              {editingType === item.type ? (
                <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
                  <input
                    aria-label={`Kapaciteti për ${item.label}`}
                    type="number"
                    min="0"
                    defaultValue={item.capacity}
                    style={inputStyle}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') updateInventory(item.type, event.currentTarget.value);
                      if (event.key === 'Escape') setEditingType(null);
                    }}
                  />
                  <button type="button" disabled={savingType === item.type} onClick={(event) => updateInventory(item.type, event.currentTarget.previousElementSibling.value)} style={smallButtonStyle}>Ruaj</button>
                </div>
              ) : (
                <p style={{ color: '#e8eaf6', fontSize: '1.15rem', fontWeight: 800 }}>{item.allocated.toLocaleString()} / {item.capacity.toLocaleString()}</p>
              )}
              {isAdmin && editingType !== item.type && <button type="button" onClick={() => setEditingType(item.type)} style={editButtonStyle}>Ndrysho kapacitetin</button>}
              <div style={{ height: 4, background: '#1e2655', borderRadius: 4, marginTop: '.65rem' }}><div style={{ height: '100%', width: `${percent}%`, background: item.color, borderRadius: 4 }} /></div>
            </article>;
          })}
        </section>
        <section style={{ marginTop: '1.25rem', background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e2655' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Historiku i alokimeve</h2>
            <p style={{ color: '#9ca3af', fontSize: '.75rem', margin: '.35rem 0 0' }}>Çdo rillogaritje ruhet si run i veçantë.</p>
          </div>
          {runs.length === 0 ? <p style={{ padding: '1.25rem', color: '#9ca3af' }}>Nuk ka historik të ruajtur.</p> : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
              <thead><tr>{['Run ID', 'Alokime', 'Kosto totale', 'Gjeneruar'].map((label) => <th key={label} style={thStyle}>{label}</th>)}</tr></thead>
              <tbody>{runs.map((run) => <tr key={run.run_id}>
                <td style={tdStyle}>{run.run_id}</td>
                <td style={tdStyle}>{run.count}</td>
                <td style={tdStyle}>{Number(run.total_cost || 0).toLocaleString()}</td>
                <td style={tdStyle}>{new Date(run.generated_at).toLocaleString('sq-AL')}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>

        <section style={{ background: '#131938', border: '1px solid #1e2655', borderRadius: '.75rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1e2655' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Caktimet sipas lagjes</h2>
          </div>
          {districts.length === 0 ? <p style={{ padding: '1.25rem', color: '#9ca3af' }}>Nuk ka alokime të ruajtura. Shtyp “Rillogarit alokimin” për të ekzekutuar algoritmin.</p> : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead><tr>{['Lagjja', 'Ambulanca', 'Testimi', 'Shtretër', 'Vaksina', 'Personel'].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr></thead>
              <tbody>{districts.map((district) => <tr key={district}>
                <td style={tdStyle}>{district}</td>
                {['ambulance', 'testing_unit', 'bed', 'vaccine', 'staff'].map((type) => <td key={type} style={tdStyle}>{allocations.find((item) => item.district === district && item.resource_type === type)?.quantity ?? 0}</td>)}
              </tr>)}</tbody>
            </table>
          </div>}
        </section>
      </>}
    </main>
  );
}

const thStyle = { textAlign: 'left', padding: '.75rem 1rem', color: '#9ca3af', fontSize: '.7rem', textTransform: 'uppercase', borderBottom: '1px solid #1e2655' };
const tdStyle = { padding: '.75rem 1rem', color: '#e8eaf6', borderBottom: '1px solid rgba(30,38,85,.65)', fontSize: '.85rem' };
const inputStyle = { width: '7rem', background: '#0a0e27', border: '1px solid #34417d', borderRadius: '.35rem', color: '#e8eaf6', padding: '.35rem' };
const smallButtonStyle = { background: '#00d4ff', border: 0, borderRadius: '.35rem', color: '#071126', padding: '.4rem .5rem', cursor: 'pointer', fontWeight: 700 };
const editButtonStyle = { marginTop: '.55rem', background: 'none', border: 0, color: '#9ca3af', cursor: 'pointer', fontSize: '.7rem', padding: 0 };
