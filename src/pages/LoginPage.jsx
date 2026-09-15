import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleRoutes = {
  owner: '/owner',
  manager: '/manager',
  engineer: '/engineer',
  customer: '/customer',
};

const demoUsers = [
  { label: 'Owner', email: 'owner@portal.com', password: 'Password123' },
  { label: 'Manager', email: 'manager@portal.com', password: 'Password123' },
  { label: 'Engineer', email: 'engineer@portal.com', password: 'Password123' },
  { label: 'Customer', email: 'customer@portal.com', password: 'Password123' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('owner@portal.com');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      navigate(roleRoutes[result.user.role] || '/');
    } catch (loginError) {
      setError(loginError.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-logo large">S</div>
          <div>
            <p className="eyebrow">Machine Service Portal</p>
            <h1>Welcome back</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>

        <div className="demo-grid">
          {demoUsers.map((demoUser) => (
            <button
              key={demoUser.label}
              type="button"
              className="demo-user"
              onClick={() => {
                setEmail(demoUser.email);
                setPassword(demoUser.password);
              }}
            >
              {demoUser.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
