import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';

const API_URL = '/api';

function GroupManagement({ token }) {
    const [groups, setGroups] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isAdding, setIsAdding] = useState(false);
    const [newGroup, setNewGroup] = useState({ id: '', trainer: '' });
    const [notification, setNotification] = useState(null);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchGroups();
    }, [token]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchGroups = async () => {
        try {
            const res = await axios.get(`${API_URL}/groups`, authHeader);
            setGroups(res.data);
        } catch (err) {
            console.error('Error fetching groups', err);
        }
    };

    const startEdit = (group) => {
        setEditingId(group.id);
        setEditForm({ ...group });
        setConfirmDeleteId(null);
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const saveEdit = async () => {
        try {
            await axios.put(`${API_URL}/groups/${editingId}`, editForm, authHeader);
            setEditingId(null);
            fetchGroups();
            setNotification({ message: 'Group updated successfully', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error saving group', type: 'error' });
        }
    };

    const deleteGroup = async (e, id) => {
        if (e) e.preventDefault();

        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            setEditingId(null);
            return;
        }

        console.log(`Attempting to delete group: ${id}`);
        try {
            const res = await axios.delete(`${API_URL}/groups/${id}`, authHeader);
            console.log('Delete successful:', res.data);
            setConfirmDeleteId(null);
            fetchGroups();
            setNotification({ message: 'Group deleted successfully', type: 'success' });
        } catch (err) {
            console.error('Delete failed:', err.response?.data || err.message);
            setNotification({
                message: 'Error deleting group: ' + (err.response?.data?.error || err.message),
                type: 'error'
            });
            setConfirmDeleteId(null);
        }
    };

    const addGroup = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/groups`, newGroup, authHeader);
            setIsAdding(false);
            setNewGroup({ id: '', trainer: '' });
            fetchGroups();
            setNotification({ message: 'Group added successfully', type: 'success' });
        } catch (err) {
            setNotification({
                message: 'Error adding group: ' + (err.response?.data?.error || err.message),
                type: 'error'
            });
        }
    };

    return (
        <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
            {notification && (
                <div style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius)',
                    marginBottom: '1rem',
                    background: notification.type === 'error' ? 'var(--danger)' : '#10b981',
                    color: 'white',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    animation: 'fadeIn 0.3s'
                }}>
                    {notification.message}
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Groups</h2>
                <button type="button" className="btn btn-primary" onClick={() => setIsAdding(true)}>
                    <Plus size={18} /> New Group
                </button>
            </div>

            {isAdding && (
                <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: 'var(--radius)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Add New Group</h3>
                    <form onSubmit={addGroup} style={{ display: 'grid', gridTemplateColumns: '100px 2fr auto', gap: '1rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Letter</label>
                            <input required name="id" value={newGroup.id} onChange={(e) => setNewGroup({ ...newGroup, id: e.target.value })} maxLength="1" />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Trainer</label>
                            <input name="trainer" value={newGroup.trainer} onChange={(e) => setNewGroup({ ...newGroup, trainer: e.target.value })} placeholder="Trainer Name (Optional)" />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '2px' }}>
                            <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>Save</button>
                            <button type="button" className="btn" onClick={() => setIsAdding(false)} style={{ background: '#e2e8f0', padding: '0.625rem 1.5rem' }}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Identifier</th>
                            <th>Trainer</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map(group => (
                            <tr key={group.id}>
                                <td data-label="Identifier" style={{ fontWeight: 'bold' }}>{group.id}</td>
                                <td data-label="Trainer">
                                    {editingId === group.id ?
                                        <input name="trainer" value={editForm.trainer} onChange={handleEditChange} autoFocus /> :
                                        (group.trainer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not assigned</span>)
                                    }
                                </td>
                                <td data-label="Actions" style={{ textAlign: 'right' }}>
                                    {editingId === group.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn btn-primary" onClick={saveEdit} style={{ padding: '0.25rem 0.5rem' }}><Check size={16} /></button>
                                            <button type="button" className="btn" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0' }}><X size={16} /></button>
                                        </div>
                                    ) : confirmDeleteId === group.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>Confirm?</span>
                                            <button type="button" className="btn" onClick={(e) => deleteGroup(e, group.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: 'white' }}>Yes</button>
                                            <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.6rem', background: '#e2e8f0' }}>No</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn" onClick={() => startEdit(group)} style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}><Edit2 size={16} /></button>
                                            <button type="button" className="btn" onClick={(e) => deleteGroup(e, group.id)} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default GroupManagement;
