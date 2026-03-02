import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GroupManagement from './components/GroupManagement';
import TransactionsDashboard from './components/TransactionsDashboard';
import CategoryManagement from './components/CategoryManagement';
import FeeSettings from './components/FeeSettings';
import OverviewDashboard from './components/OverviewDashboard';
import { LogOut, Users, Layers, Settings as SettingsIcon, Menu, X, Receipt, Tag, BarChart2, ChevronDown } from 'lucide-react';
import Settings from './components/Settings';
import GDPRForm from './components/GDPRForm';

const ProtectedRoute = ({ token, children }) => {
    if (!token) return <Navigate to="/login" replace />;
    return children;
};

const AuthInterceptor = ({ setToken }) => {
    const navigate = useNavigate();

    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            res => res,
            err => {
                if (err.response?.status === 401) {
                    localStorage.removeItem('token');
                    setToken(null);
                    navigate('/login', { replace: true });
                }
                return Promise.reject(err);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, [navigate, setToken]);

    return null;
};

const MANAGE_PATHS = ['/groups', '/categories', '/fee-settings', '/settings'];

const Navigation = ({ token, setToken }) => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const manageRef = useRef(null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setIsMenuOpen(false);
    };

    useEffect(() => {
        const handler = (e) => {
            if (manageRef.current && !manageRef.current.contains(e.target)) {
                setIsManageOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!token || location.pathname.startsWith('/gdpr/')) return null;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => { setIsMenuOpen(false); setIsManageOpen(false); };
    const isManageActive = MANAGE_PATHS.includes(location.pathname);

    const navBtn = (path) => ({
        background: location.pathname === path ? '' : 'transparent',
        color: location.pathname === path ? '' : 'var(--text)',
    });

    return (
        <header className="navbar glass">
            <div className="nav-brand">
                <h1 style={{ margin: 0, color: 'var(--primary)' }}>Aquamen</h1>
                <nav className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
                    <Link to="/members" onClick={closeMenu} className={`btn ${location.pathname === '/members' ? 'btn-primary' : ''}`} style={navBtn('/members')}>
                        <Users size={18} /> Members
                    </Link>
                    <Link to="/transactions" onClick={closeMenu} className={`btn ${location.pathname === '/transactions' ? 'btn-primary' : ''}`} style={navBtn('/transactions')}>
                        <Receipt size={18} /> Transactions
                    </Link>
                    <Link to="/overview" onClick={closeMenu} className={`btn ${location.pathname === '/overview' ? 'btn-primary' : ''}`} style={navBtn('/overview')}>
                        <BarChart2 size={18} /> Overview
                    </Link>

                    {/* Manage dropdown — desktop */}
                    <div ref={manageRef} className="nav-manage-dropdown" style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className={`btn ${isManageActive ? 'btn-primary' : ''}`}
                            style={isManageActive ? {} : { background: 'transparent', color: 'var(--text)' }}
                            onClick={() => setIsManageOpen(v => !v)}
                        >
                            <Layers size={18} /> Manage <ChevronDown size={14} style={{ marginLeft: '2px' }} />
                        </button>
                        {isManageOpen && (
                            <div className="nav-dropdown-menu glass">
                                <Link to="/groups" onClick={closeMenu} className={`nav-dropdown-item ${location.pathname === '/groups' ? 'active' : ''}`}>
                                    <Layers size={15} /> Groups
                                </Link>
                                <Link to="/categories" onClick={closeMenu} className={`nav-dropdown-item ${location.pathname === '/categories' ? 'active' : ''}`}>
                                    <Tag size={15} /> Categories
                                </Link>
                                <Link to="/fee-settings" onClick={closeMenu} className={`nav-dropdown-item ${location.pathname === '/fee-settings' ? 'active' : ''}`}>
                                    <BarChart2 size={15} /> Fee Settings
                                </Link>
                                <Link to="/settings" onClick={closeMenu} className={`nav-dropdown-item ${location.pathname === '/settings' ? 'active' : ''}`}>
                                    <SettingsIcon size={15} /> Settings
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Manage items flat on mobile */}
                    <div className="nav-manage-mobile">
                        <Link to="/groups" onClick={closeMenu} className={`btn ${location.pathname === '/groups' ? 'btn-primary' : ''}`} style={navBtn('/groups')}>
                            <Layers size={18} /> Groups
                        </Link>
                        <Link to="/categories" onClick={closeMenu} className={`btn ${location.pathname === '/categories' ? 'btn-primary' : ''}`} style={navBtn('/categories')}>
                            <Tag size={18} /> Categories
                        </Link>
                        <Link to="/fee-settings" onClick={closeMenu} className={`btn ${location.pathname === '/fee-settings' ? 'btn-primary' : ''}`} style={navBtn('/fee-settings')}>
                            <BarChart2 size={18} /> Fee Settings
                        </Link>
                        <Link to="/settings" onClick={closeMenu} className={`btn ${location.pathname === '/settings' ? 'btn-primary' : ''}`} style={navBtn('/settings')}>
                            <SettingsIcon size={18} /> Settings
                        </Link>
                    </div>

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
            <NotificationProvider>
            <AuthInterceptor setToken={setToken} />
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

                        <Route path="/transactions" element={
                            <ProtectedRoute token={token}>
                                <TransactionsDashboard token={token} />
                            </ProtectedRoute>
                        } />

                        <Route path="/categories" element={
                            <ProtectedRoute token={token}>
                                <CategoryManagement token={token} />
                            </ProtectedRoute>
                        } />

                        <Route path="/fee-settings" element={
                            <ProtectedRoute token={token}>
                                <FeeSettings token={token} />
                            </ProtectedRoute>
                        } />

                        <Route path="/overview" element={
                            <ProtectedRoute token={token}>
                                <OverviewDashboard token={token} />
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
            </NotificationProvider>
        </BrowserRouter>
    );
}

export default App;
