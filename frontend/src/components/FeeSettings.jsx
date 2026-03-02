import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const API_URL = '/api';

function fmtMonth(ym) {
    if (!ym) return '—';
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function nextCalendarMonth() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FeeSettings({ token }) {
    const [periods, setPeriods] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newPeriod, setNewPeriod] = useState({ valid_from: nextCalendarMonth(), regular_amount: '', student_amount: '' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const { setNotification } = useNotification();

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => { fetchPeriods(); }, [token]);

    const fetchPeriods = async () => {
        try {
            const res = await axios.get(`${API_URL}/fee-settings`, authHeader);
            setPeriods(res.data);
        } catch (err) {
            console.error('Error fetching fee settings', err);
        }
    };

    const addPeriod = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/fee-settings`, {
                valid_from: newPeriod.valid_from,
                regular_amount: parseFloat(newPeriod.regular_amount),
                student_amount: parseFloat(newPeriod.student_amount),
            }, authHeader);
            setIsAdding(false);
            setNewPeriod({ valid_from: nextCalendarMonth(), regular_amount: '', student_amount: '' });
            fetchPeriods();
            setNotification({ message: 'Fee period added', type: 'success' });
        } catch (err) {
            setNotification({ message: err.response?.data?.error || err.message, type: 'error' });
        }
    };

    const startEdit = (period) => {
        setEditingId(period.id);
        setEditForm({ regular_amount: period.regular_amount, student_amount: period.student_amount });
        setConfirmDeleteId(null);
        setIsAdding(false);
    };

    const saveEdit = async () => {
        try {
            await axios.put(`${API_URL}/fee-settings/${editingId}`, {
                regular_amount: parseFloat(editForm.regular_amount),
                student_amount: parseFloat(editForm.student_amount),
            }, authHeader);
            setEditingId(null);
            fetchPeriods();
            setNotification({ message: 'Fee period updated', type: 'success' });
        } catch (err) {
            setNotification({ message: err.response?.data?.error || err.message, type: 'error' });
        }
    };

    const deletePeriod = async (id) => {
        if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
        try {
            await axios.delete(`${API_URL}/fee-settings/${id}`, authHeader);
            setConfirmDeleteId(null);
            fetchPeriods();
            setNotification({ message: 'Fee period deleted', type: 'success' });
        } catch (err) {
            setNotification({ message: err.response?.data?.error || err.message, type: 'error' });
            setConfirmDeleteId(null);
        }
    };

    const latestId = periods.length > 0 ? periods[periods.length - 1].id : null;

    // Preview: previous open-ended period will close when adding new one
    const prevOpenEnded = periods.find(p => p.valid_to === null || p.valid_to === undefined);
    const newValidFrom = newPeriod.valid_from;
    const prevWillCloseTo = newValidFrom
        ? (() => {
            const [y, m] = newValidFrom.split('-').map(Number);
            const pm = m - 1 === 0 ? 12 : m - 1;
            const py = m - 1 === 0 ? y - 1 : y;
            return `${py}-${String(pm).padStart(2, '0')}`;
        })()
        : null;

    return (
        <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ margin: 0 }}>Fee Settings</h2>
                {!isAdding && (
                    <button type="button" className="btn btn-primary"
                        onClick={() => { setIsAdding(true); setEditingId(null); setConfirmDeleteId(null); }}>
                        <Plus size={18} /> New Period
                    </button>
                )}
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Fee periods define what members owe each month. Periods must be contiguous and non-overlapping.
            </p>

            {isAdding && (
                <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: 'var(--radius)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Add New Period</h3>
                    {prevOpenEnded && prevWillCloseTo && (
                        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fef9c3', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: '#854d0e' }}>
                            The current open-ended period starting <strong>{fmtMonth(prevOpenEnded.valid_from)}</strong> will automatically close at <strong>{fmtMonth(prevWillCloseTo)}</strong>.
                        </div>
                    )}
                    <form onSubmit={addPeriod}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Valid From (YYYY-MM) *</label>
                                <input required type="month" value={newPeriod.valid_from}
                                    onChange={e => setNewPeriod({ ...newPeriod, valid_from: e.target.value })}
                                    min={nextCalendarMonth()} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Regular (Kč/month) *</label>
                                <input required type="number" min="0" step="1" value={newPeriod.regular_amount}
                                    onChange={e => setNewPeriod({ ...newPeriod, regular_amount: e.target.value })}
                                    placeholder="e.g. 1350" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Student (Kč/month) *</label>
                                <input required type="number" min="0" step="1" value={newPeriod.student_amount}
                                    onChange={e => setNewPeriod({ ...newPeriod, student_amount: e.target.value })}
                                    placeholder="e.g. 1000" />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>Save</button>
                                <button type="button" className="btn" onClick={() => setIsAdding(false)} style={{ background: '#e2e8f0', padding: '0.625rem 1rem' }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Valid From</th>
                            <th>Valid To</th>
                            <th>Regular (Kč/mo)</th>
                            <th>Student (Kč/mo)</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {periods.map(period => (
                            <tr key={period.id}>
                                <td data-label="Valid From">
                                    <strong>{fmtMonth(period.valid_from)}</strong>
                                </td>
                                <td data-label="Valid To">
                                    {period.valid_to
                                        ? fmtMonth(period.valid_to)
                                        : <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Current</span>}
                                </td>
                                <td data-label="Regular (Kč/mo)">
                                    {editingId === period.id ? (
                                        <input type="number" min="0" step="1" value={editForm.regular_amount}
                                            onChange={e => setEditForm({ ...editForm, regular_amount: e.target.value })}
                                            style={{ width: '100px' }} />
                                    ) : (
                                        <span>{Number(period.regular_amount).toLocaleString('cs-CZ')} Kč</span>
                                    )}
                                </td>
                                <td data-label="Student (Kč/mo)">
                                    {editingId === period.id ? (
                                        <input type="number" min="0" step="1" value={editForm.student_amount}
                                            onChange={e => setEditForm({ ...editForm, student_amount: e.target.value })}
                                            style={{ width: '100px' }} />
                                    ) : (
                                        <span>{Number(period.student_amount).toLocaleString('cs-CZ')} Kč</span>
                                    )}
                                </td>
                                <td data-label="Actions" style={{ textAlign: 'right' }}>
                                    {editingId === period.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn btn-primary" onClick={saveEdit} style={{ padding: '0.25rem 0.5rem' }}><Check size={16} /></button>
                                            <button type="button" className="btn" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0' }}><X size={16} /></button>
                                        </div>
                                    ) : confirmDeleteId === period.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>Confirm?</span>
                                            <button type="button" className="btn" onClick={() => deletePeriod(period.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: 'white' }}>Yes</button>
                                            <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.6rem', background: '#e2e8f0' }}>No</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn" onClick={() => startEdit(period)}
                                                style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}>
                                                <Edit2 size={16} />
                                            </button>
                                            {period.id === latestId && (
                                                <button type="button" className="btn" onClick={() => deletePeriod(period.id)}
                                                    style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}
                                                    title="Delete current period">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {periods.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>No fee periods defined.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
