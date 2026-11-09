import { useState } from 'react';
import { reportsAPI } from '../api/reports';

const SYMPTOMS = [
  { id: 'fever', label: 'Ethe', icon: '🌡️' },
  { id: 'cough', label: 'Kollë', icon: '😷' },
  { id: 'fatigue', label: 'Lodhje', icon: '😴' },
  { id: 'loss_of_smell', label: 'Humbje e nuhatjes', icon: '👃' },
  { id: 'loss_of_taste', label: 'Humbje e shijes', icon: '👅' },
  { id: 'sore_throat', label: 'Dhimbje fyti', icon: '🗣️' },
  { id: 'headache', label: 'Dhimbje koke', icon: '🤕' },
  { id: 'muscle_pain', label: 'Dhimbje muskujsh', icon: '💪' },
  { id: 'shortness_of_breath', label: 'Vështirësi në frymëmarrje', icon: '😰' },
  { id: 'diarrhea', label: 'Diarre', icon: '🤢' },
];

const DISTRICTS = [
  'Qendra', 'Dardania', 'Ulpiana', 'Arbëria', 'Kalabria',
  'Bregu i Diellit', 'Sunny Hill', 'Lakrishte', 'Mat', 'Tophane',
  'Vranjevc', 'Kodra e Trimave', 'Kolovica', 'Sofali', 'Bardhosh',
];

export default function CitizenReport() {
  const [formData, setFormData] = useState({
    report_type: 'symptom',
    symptoms: [],
    severity: 3,
    district: 'Qendra',
    age_range: '30-44',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleSymptom = (id) => {
    setFormData((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(id)
        ? prev.symptoms.filter((s) => s !== id)
        : [...prev.symptoms, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await reportsAPI.createAuthenticated(formData);
      setSubmitted(true);
      setFormData({
        report_type: 'symptom',
        symptoms: [],
        severity: 3,
        district: 'Qendra',
        age_range: '30-44',
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Gabim gjatë dërgimit');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#131938',
        border: '1px solid #1e2655',
        borderRadius: '0.75rem',
        padding: '3rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✓</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#2ed573' }}>
          Raporti u Dërgua!
        </h2>
        <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
          Faleminderit për kontributin tuaj në monitorimin e shëndetit publik.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="btn-primary"
        >
          Dërgo një raport tjetër
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        Raporto Simptomat
      </h1>
      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>
        Raporti është anonim dhe ndihmon në monitorimin e shëndetit publik
      </p>

      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          background: 'rgba(255, 71, 87, 0.1)',
          border: '1px solid rgba(255, 71, 87, 0.3)',
          borderRadius: '0.5rem',
          color: '#ff4757',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Report Type */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
            Lloji i raportit
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {[
              { value: 'symptom', label: 'Simptoma', icon: '🤒' },
              { value: 'confirmed', label: 'Konfirmuar Pozitiv', icon: '🧪' },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, report_type: type.value })}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: formData.report_type === type.value ? 'rgba(0, 212, 255, 0.15)' : '#0a0e27',
                  border: formData.report_type === type.value ? '1px solid #00d4ff' : '1px solid #1e2655',
                  borderRadius: '0.5rem',
                  color: formData.report_type === type.value ? '#00d4ff' : '#9ca3af',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Symptoms */}
        {formData.report_type === 'symptom' && (
          <div style={{
            background: '#131938',
            border: '1px solid #1e2655',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
              Zgjidh simptomat ({formData.symptoms.length} të zgjedhura)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.5rem'
            }}>
              {SYMPTOMS.map((s) => {
                const selected = formData.symptoms.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSymptom(s.id)}
                    style={{
                      padding: '0.75rem',
                      background: selected ? 'rgba(0, 212, 255, 0.15)' : '#0a0e27',
                      border: selected ? '1px solid #00d4ff' : '1px solid #1e2655',
                      borderRadius: '0.5rem',
                      color: selected ? '#00d4ff' : '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Severity */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
            Sa të forta janë simptomat? ({formData.severity}/5)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFormData({ ...formData, severity: n })}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: formData.severity >= n ? 'linear-gradient(135deg, #00d4ff, #7b2ff7)' : '#0a0e27',
                  border: '1px solid #1e2655',
                  borderRadius: '0.5rem',
                  color: formData.severity >= n ? 'white' : '#9ca3af',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {n === 1 && 'Shumë e lehtë'}
                {n === 2 && 'E lehtë'}
                {n === 3 && 'Mesatare'}
                {n === 4 && 'E rëndë'}
                {n === 5 && 'Shumë e rëndë'}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
              Lagjja
            </label>
            <select
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              style={{
                width: '100%',
                background: '#0a0e27',
                border: '1px solid #1e2655',
                borderRadius: '0.5rem',
                padding: '0.625rem 1rem',
                color: 'white',
                fontSize: '0.875rem'
              }}
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
              Grupmosha
            </label>
            <select
              value={formData.age_range}
              onChange={(e) => setFormData({ ...formData, age_range: e.target.value })}
              style={{
                width: '100%',
                background: '#0a0e27',
                border: '1px solid #1e2655',
                borderRadius: '0.5rem',
                padding: '0.625rem 1rem',
                color: 'white',
                fontSize: '0.875rem'
              }}
            >
              <option value="0-17">0-17</option>
              <option value="18-29">18-29</option>
              <option value="30-44">30-44</option>
              <option value="45-59">45-59</option>
              <option value="60+">60+</option>
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || (formData.report_type === 'symptom' && formData.symptoms.length === 0)}
          className="btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
        >
          {loading ? 'Duke dërguar...' : '📤 Dërgo Raportin'}
        </button>
      </form>
    </div>
  );
}