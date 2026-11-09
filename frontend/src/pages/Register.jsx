import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    role: 'citizen',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const validate = () => {
    if (formData.full_name.length < 2) {
      return 'Emri i plotë duhet të ketë të paktën 2 karaktere';
    }
    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      return 'Email-i është i pavlefshëm';
    }
    if (formData.username.length < 3) {
      return 'Username-i duhet të ketë të paktën 3 karaktere';
    }
    if (formData.password.length < 8) {
      return 'Password-i duhet të ketë të paktën 8 karaktere';
    }
    if (!/[A-Z]/.test(formData.password)) {
      return 'Password-i duhet të ketë të paktën një shkronjë të madhe';
    }
    if (!/[0-9]/.test(formData.password)) {
      return 'Password-i duhet të ketë të paktën një numër';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    // Pastro district (nuk është në skemë)
    const cleanData = { ...formData };

    console.log('Duke dërguar:', cleanData);

    const result = await register(cleanData);

    if (result.success) {
      navigate('/login');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e27',
      padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            EpiPrishtina
          </h1>
          <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>
            Krijo llogari të re
          </p>
        </div>

        <div style={{
          background: '#131938',
          border: '1px solid #1e2655',
          borderRadius: '0.75rem',
          padding: '2rem'
        }}>
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
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Emri i plotë
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Arben Maloku"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={inputStyle}
                placeholder="email@shembull.com"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                style={inputStyle}
                placeholder="username"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={inputStyle}
                placeholder="Min 8 karaktere, 1 e madhe, 1 numër"
                required
                minLength={8}
              />
              <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Shembull: <code style={{ color: '#00d4ff' }}>Test2025!</code>
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Roli
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="citizen">Qytetar</option>
                <option value="analyst">Analist</option>
                <option value="health_worker">Punonjës Shëndetësor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
                color: 'white',
                fontWeight: '600',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Duke u regjistruar...' : 'Regjistrohu'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#9ca3af' }}>
            Ke llogari?{' '}
            <Link to="/login" style={{ color: '#00d4ff', textDecoration: 'none' }}>
              Hyr
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#0a0e27',
  border: '1px solid #1e2655',
  borderRadius: '0.5rem',
  padding: '0.625rem 1rem',
  color: 'white',
  fontSize: '0.875rem',
  outline: 'none',
  fontFamily: 'inherit'
};
