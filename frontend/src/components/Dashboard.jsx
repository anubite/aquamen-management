import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X, Search } from 'lucide-react';

const API_URL = '/api';

function Dashboard({ token }) {
    const [members, setMembers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isAdding, setIsAdding] = useState(false);
    const [newMember, setNewMember] = useState({ name: '', surname: '', email: '', group_id: 'A', status: 'Active' });
    const [search, setSearch] = useState('');
    const [notification, setNotification] = useState(null);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchMembers();
        fetchGroups();
    }, [token]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchMembers = async () => {
        try {
            const res = await axios.get(`${API_URL}/members`, authHeader);
            setMembers(res.data);
        } catch (err) {
            console.error('Error fetching members', err);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await axios.get(`${API_URL}/groups`, authHeader);
            setGroups(res.data);
        } catch (err) {
            console.error('Error fetching groups', err);
        }
    };

    const startEdit = (member) => {
        setEditingId(member.id);
        setEditForm({ ...member });
        setConfirmDeleteId(null);
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const saveEdit = async () => {
        try {
            await axios.put(`${API_URL}/members/${editingId}`, editForm, authHeader);
            setEditingId(null);
            fetchMembers();
            setNotification({ message: 'Member updated successfully', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error saving member', type: 'error' });
        }
    };

    const deleteMember = async (id) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            setEditingId(null);
            return;
        }

        try {
            await axios.delete(`${API_URL}/members/${id}`, authHeader);
            setConfirmDeleteId(null);
            fetchMembers();
            setNotification({ message: 'Member deleted successfully', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error deleting member', type: 'error' });
            setConfirmDeleteId(null);
        }
    };

    const addMember = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/members`, newMember, authHeader);
            setIsAdding(false);
            setNewMember({ name: '', surname: '', email: '', group_id: groups[0]?.id || 'A', status: 'Active' });
            fetchMembers();
            setNotification({ message: 'Member added successfully', type: 'success' });
        } catch (err) {
            setNotification({
                message: 'Error adding member: ' + (err.response?.data?.error || err.message),
                type: 'error'
            });
        }
    };

    const filteredMembers = Array.isArray(members) ? members.filter(m =>
        `${m.name} ${m.surname} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    ) : [];

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search members..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
                <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                    <Plus size={18} /> New Member
                </button>
            </div>

            {isAdding && (
                <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: 'var(--radius)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Add New Member</h3>
                    <form onSubmit={addMember} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="form-group"><label>Name</label><input required name="name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} /></div>
                        <div className="form-group"><label>Surname</label><input required name="surname" value={newMember.surname} onChange={(e) => setNewMember({ ...newMember, surname: e.target.value })} /></div>
                        <div className="form-group"><label>Email</label><input required type="email" name="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} /></div>
                        <div className="form-group">
                            <label>Group</label>
                            <select value={newMember.group_id} onChange={(e) => setNewMember({ ...newMember, group_id: e.target.value })}>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.id} {g.trainer ? `(${g.trainer})` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={{ visibility: 'hidden' }}>Action</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>Save</button>
                                <button type="button" className="btn" onClick={() => setIsAdding(false)} style={{ background: '#e2e8f0', padding: '0.625rem 1.5rem' }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Surname</th>
                            <th>Group</th>
                            <th>Trainer</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMembers.map(member => (
                            <tr key={member.id}>
                                <td data-label="ID">{member.id}</td>
                                <td data-label="Name">
                                    {editingId === member.id ?
                                        <input name="name" value={editForm.name} onChange={handleEditChange} /> :
                                        member.name
                                    }
                                </td>
                                <td data-label="Surname">
                                    {editingId === member.id ?
                                        <input name="surname" value={editForm.surname} onChange={handleEditChange} /> :
                                        member.surname
                                    }
                                </td>
                                <td data-label="Group">
                                    {editingId === member.id ?
                                        <select name="group_id" value={editForm.group_id} onChange={handleEditChange}>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.id}</option>
                                            ))}
                                        </select> :
                                        <span style={{ fontWeight: 'bold' }}>{member.group_id}</span>
                                    }
                                </td>
                                <td data-label="Trainer">
                                    <span style={{ color: 'var(--text-muted)' }}>{member.group_trainer || '—'}</span>
                                </td>
                                <td data-label="Status">
                                    {editingId === member.id ?
                                        <select name="status" value={editForm.status} onChange={handleEditChange}>
                                            <option value="Active">Active</option><option value="Canceled">Canceled</option>
                                        </select> :
                                        <span className={`badge badge-${member.status.toLowerCase()}`}>{member.status}</span>
                                    }
                                </td>
                                <td data-label="Actions" style={{ textAlign: 'right' }}>
                                    {editingId === member.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn btn-primary" onClick={saveEdit} style={{ padding: '0.25rem 0.5rem' }}><Check size={16} /></button>
                                            <button type="button" className="btn" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0' }}><X size={16} /></button>
                                        </div>
                                    ) : confirmDeleteId === member.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>Confirm?</span>
                                            <button type="button" className="btn" onClick={() => deleteMember(member.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: 'white' }}>Yes</button>
                                            <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.6rem', background: '#e2e8f0' }}>No</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn" onClick={() => startEdit(member)} style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}><Edit2 size={16} /></button>
                                            <button type="button" className="btn" onClick={() => deleteMember(member.id)} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}><Trash2 size={16} /></button>
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

export default Dashboard;
