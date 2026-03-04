import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api';

function Login({ setToken }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/login`, { username, password });
            setToken(res.data.token);
            navigate('/members');
        } catch (err) {
            setError('Invalid username or password');
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'rgb(206,0,55)'
        }}>
            <div style={{
                padding: '2.5rem',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '400px',
                background: 'rgba(255,255,255,0.96)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)'
            }}>
                <img src="/logo.png" alt="Aquamen Prague" style={{ height: '48px', display: 'block', margin: '0 auto 2rem' }} />
                {error && <div style={{ color: '#fff', background: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label style={{ color: 'var(--text)' }}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="off"
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label style={{ color: 'var(--text)' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="off"
                            required
                        />
                    </div>
                    <button type="submit" className="btn" style={{ width: '100%', background: '#111111', color: '#ffffff', fontWeight: '700' }}>
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
