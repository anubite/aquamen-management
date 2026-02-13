import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X, Search } from 'lucide-react';

const API_URL = '/api';

function Dashboard() {
    const [members, setMembers] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isAdding, setIsAdding] = useState(false);
    const [newMember, setNewMember] = useState({ name: '', surname: '', email: '', group_name: 'A', status: 'Active' });
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const res = await axios.get(`${API_URL}/members`);
            setMembers(res.data);
        } catch (err) {
            console.error('Error fetching members', err);
        }
    };

    const startEdit = (member) => {
        setEditingId(member.id);
        setEditForm({ ...member });
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const saveEdit = async () => {
        try {
            await axios.put(`${API_URL}/members/${editingId}`, editForm);
            setEditingId(null);
            fetchMembers();
        } catch (err) {
            alert('Error saving member');
        }
    };

    const deleteMember = async (id) => {
        if (window.confirm('Delete this member?')) {
            try {
                await axios.delete(`${API_URL}/members/${id}`);
                fetchMembers();
            } catch (err) {
                alert('Error deleting member');
            }
        }
    };

    const addMember = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/members`, newMember);
            setIsAdding(false);
            setNewMember({ name: '', surname: '', email: '', group_name: 'A', status: 'Active' });
            fetchMembers();
        } catch (err) {
            alert('Error adding member: ' + (err.response?.data?.error || err.message));
        }
    };

    const filteredMembers = members.filter(m =>
        `${m.name} ${m.surname} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
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
                            <select value={newMember.group_name} onChange={(e) => setNewMember({ ...newMember, group_name: e.target.value })}>
                                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
                            <button type="submit" className="btn btn-primary">Save</button>
                            <button type="button" className="btn" onClick={() => setIsAdding(false)} style={{ background: '#e2e8f0' }}>Cancel</button>
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
                            <th>Email</th>
                            <th>Group</th>
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
                                <td data-label="Email">
                                    {editingId === member.id ?
                                        <input name="email" type="email" value={editForm.email} onChange={handleEditChange} /> :
                                        member.email
                                    }
                                </td>
                                <td data-label="Group">
                                    {editingId === member.id ?
                                        <select name="group_name" value={editForm.group_name} onChange={handleEditChange}>
                                            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                                        </select> :
                                        member.group_name
                                    }
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
                                            <button className="btn btn-primary" onClick={saveEdit} style={{ padding: '0.25rem 0.5rem' }}><Check size={16} /></button>
                                            <button className="btn" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0' }}><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button className="btn" onClick={() => startEdit(member)} style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}><Edit2 size={16} /></button>
                                            <button className="btn" onClick={() => deleteMember(member.id)} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}><Trash2 size={16} /></button>
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
