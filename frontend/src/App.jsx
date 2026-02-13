import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const API_URL = '/api';

// Initialize axios header from localStorage immediately on load
const savedToken = localStorage.getItem('token');
if (savedToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
}

function App() {
    const [token, setToken] = useState(savedToken);

    const handleSetToken = (newToken) => {
        if (newToken) {
            localStorage.setItem('token', newToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        } else {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
        }
        setToken(newToken);
    };

    if (!token) {
        return <Login setToken={handleSetToken} />;
    }

    return (
        <div className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Aquamen Management</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Swimming Team Administration</p>
                </div>
                <button className="btn" onClick={() => handleSetToken(null)} style={{ border: '1px solid var(--border)' }}>
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
