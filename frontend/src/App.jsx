import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const API_URL = '/api';

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    if (!token) {
        return <Login setToken={setToken} />;
    }

    return (
        <div className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Aquamen Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Swimming Team Administration</p>
                </div>
                <button className="btn" onClick={() => setToken(null)} style={{ border: '1px solid var(--border)' }}>
                    Logout
                </button>
            </header>
            <main>
                <Dashboard />
            </main>
        </div>
    );
}

export default App;
