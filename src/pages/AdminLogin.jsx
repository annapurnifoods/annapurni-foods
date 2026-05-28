import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductContext } from '../context/ProductContext';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, token } = useContext(ProductContext);

  useEffect(() => {
    if (token) navigate('/admin/dashboard');
  }, [token, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="admin-container" style={{justifyContent: 'center', alignItems: 'center'}}>
      <div className="admin-card" style={{width: '100%', maxWidth: '400px'}}>
        <h2 className="admin-title" style={{textAlign: 'center', marginBottom: '1.5rem', color: 'var(--dark)'}}>Admin Login</h2>
        {error && <div style={{color: 'red', marginBottom: '1rem', textAlign: 'center'}}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="admin-form-group">
            <label>Username</label>
            <input type="text" className="admin-input" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="admin-form-group">
            <label>Password</label>
            <input type="password" className="admin-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="admin-btn" style={{width: '100%'}}>Login</button>
        </form>
      </div>
    </div>
  );
};
export default AdminLogin;
