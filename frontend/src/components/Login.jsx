import React, { useState } from 'react';
import axios from 'axios';

const API_URL = '/api';

function Login({ setToken }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/login`, { username, password });
            setToken(res.data.token);
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
            background: 'linear-gradient(135deg, #0077be 0%, #00a8e8 100%)'
        }}>
            <div className="glass" style={{
                padding: '2.5rem',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
            }}>
                <h1 style={{ textAlign: 'center', color: '#fff', marginBottom: '2rem' }}>Aquamen</h1>
                {error && <div style={{ color: '#fff', background: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label style={{ color: '#fff' }}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="aquamen"
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label style={{ color: '#fff' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#fff', color: 'var(--primary)', fontWeight: '700' }}>
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
