import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GroupManagement from './components/GroupManagement';
import { LogOut, Users, Layers } from 'lucide-react';

const ProtectedRoute = ({ token, children }) => {
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

const Navigation = ({ token, setToken }) => {
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
    };

    if (!token) return null;

    return (
        <header className="glass" style={{ marginBottom: '2rem', padding: '1rem 2rem', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)' }}>Aquamen Management</h1>
                <nav style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/members" className={`btn ${location.pathname === '/members' ? 'btn-primary' : ''}`} style={{ background: location.pathname === '/members' ? '' : 'transparent', color: location.pathname === '/members' ? '' : 'var(--text)' }}>
                        <Users size={18} /> Members
                    </Link>
                    <Link to="/groups" className={`btn ${location.pathname === '/groups' ? 'btn-primary' : ''}`} style={{ background: location.pathname === '/groups' ? '' : 'transparent', color: location.pathname === '/groups' ? '' : 'var(--text)' }}>
                        <Layers size={18} /> Groups
                    </Link>
                </nav>
            </div>
            <button className="btn" onClick={handleLogout} style={{ background: '#fee2e2', color: 'var(--danger)' }}>
                <LogOut size={18} /> Logout
            </button>
        </header>
    );
};

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));

    return (
        <BrowserRouter>
            <div className="container" style={{ padding: '2rem 1rem' }}>
                <Navigation token={token} setToken={setToken} />
                <main>
                    <Routes>
                        <Route path="/login" element={!token ? <Login setToken={(t) => {
                            localStorage.setItem('token', t);
                            setToken(t);
                        }} /> : <Navigate to="/members" replace />} />

                        <Route path="/members" element={
                            <ProtectedRoute token={token}>
                                <Dashboard token={token} />
                            </ProtectedRoute>
                        } />

                        <Route path="/groups" element={
                            <ProtectedRoute token={token}>
                                <GroupManagement token={token} />
                            </ProtectedRoute>
                        } />

                        <Route path="/" element={<Navigate to="/members" replace />} />
                    </Routes>
                </main>
                <footer style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    &copy; 2026 Aquamen Swimming Team Administration
                </footer>
            </div>
        </BrowserRouter>
    );
}

export default App;
