import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GroupManagement from './components/GroupManagement';
import { LogOut, Users, Layers, Settings as SettingsIcon, Menu, X } from 'lucide-react';
import Settings from './components/Settings';
import GDPRForm from './components/GDPRForm';

const ProtectedRoute = ({ token, children }) => {
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

const Navigation = ({ token, setToken }) => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setIsMenuOpen(false);
    };

    if (!token || location.pathname.startsWith('/gdpr/')) return null;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

    return (
        <header className="navbar glass">
            <div className="nav-brand">
                <h1 style={{ margin: 0, color: 'var(--primary)' }}>Aquamen</h1>
                <nav className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
                    <Link to="/members" onClick={closeMenu} className={`btn ${location.pathname === '/members' ? 'btn-primary' : ''}`} style={{ background: location.pathname === '/members' ? '' : 'transparent', color: location.pathname === '/members' ? '' : 'var(--text)' }}>
                        <Users size={18} /> Members
                    </Link>
                    <Link to="/groups" onClick={closeMenu} className={`btn ${location.pathname === '/groups' ? 'btn-primary' : ''}`} style={{ background: location.pathname === '/groups' ? '' : 'transparent', color: location.pathname === '/groups' ? '' : 'var(--text)' }}>
                        <Layers size={18} /> Groups
                    </Link>
                    <Link to="/settings" onClick={closeMenu} className={`btn ${location.pathname === '/settings' ? 'btn-primary' : ''}`} style={{ background: location.pathname === '/settings' ? '' : 'transparent', color: location.pathname === '/settings' ? '' : 'var(--text)' }}>
                        <SettingsIcon size={18} /> Settings
                    </Link>
                    <button className="btn logout-btn-mobile" onClick={handleLogout} style={{ background: '#fee2e2', color: 'var(--danger)', display: 'none' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button className="btn logout-btn" onClick={handleLogout} style={{ background: '#fee2e2', color: 'var(--danger)' }}>
                    <LogOut size={18} /> Logout
                </button>
                <button className="nav-toggle" onClick={toggleMenu}>
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>
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

                        <Route path="/settings" element={
                            <ProtectedRoute token={token}>
                                <Settings token={token} />
                            </ProtectedRoute>
                        } />

                        <Route path="/gdpr/:token" element={<GDPRForm />} />

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
