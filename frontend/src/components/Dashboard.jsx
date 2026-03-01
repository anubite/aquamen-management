import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search, FileUp, MoreHorizontal, Mail as MailIcon, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import MemberSidePanel from './MemberSidePanel';
import ImportDashboard from './ImportDashboard';
import EmailDraftPanel from './EmailDraftPanel';

const API_URL = '/api';
const PAGE_SIZE = 20;

function Dashboard({ token }) {
    const [members, setMembers] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);

    const [groups, setGroups] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [emailMember, setEmailMember] = useState(null);
    const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [search, setSearch] = useState('');
    const [notification, setNotification] = useState(null);

    const [statusFilter, setStatusFilter] = useState('All');
    const [groupFilter, setGroupFilter] = useState('All');

    const [editingCell, setEditingCell] = useState(null); // { memberId: id, field: 'status'|'group_id' }

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const fetchMembers = async (currentPage = page) => {
        try {
            const params = {
                page: currentPage,
                limit: PAGE_SIZE,
                search,
                status: statusFilter,
                group_id: groupFilter,
            };
            const res = await axios.get(`${API_URL}/members`, { ...authHeader, params });
            setMembers(res.data.members);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
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

    // Refetch when filters change — reset to page 1
    useEffect(() => {
        setPage(1);
        fetchMembers(1);
    }, [search, statusFilter, groupFilter]);

    // Refetch when page changes (without resetting page)
    useEffect(() => {
        fetchMembers(page);
    }, [page]);

    useEffect(() => {
        fetchGroups();
    }, [token]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleOpenPanel = (member = null) => {
        setSelectedMember(member || { status: 'Active' });
        setIsPanelOpen(true);
        setConfirmDeleteId(null);
    };

    const handleInlineSave = async (member, field, value) => {
        if (member[field] === value) {
            setEditingCell(null);
            return;
        }

        const updatedData = { ...member, [field]: value };
        try {
            await axios.put(`${API_URL}/members/${member.id}`, updatedData, authHeader);
            fetchMembers();
            setNotification({ message: `Member ${field} updated`, type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error updating member', type: 'error' });
        }
        setEditingCell(null);
    };

    const handleSaveMember = async (memberData) => {
        try {
            if (memberData.id) {
                await axios.put(`${API_URL}/members/${memberData.id}`, memberData, authHeader);
            } else {
                await axios.post(`${API_URL}/members`, memberData, authHeader);
            }
            fetchMembers();
            setNotification({ message: 'Member saved successfully', type: 'success' });
        } catch (err) {
            setNotification({
                message: 'Error saving member: ' + (err.response?.data?.error || err.message),
                type: 'error'
            });
            throw err;
        }
    };

    const deleteMember = async (id) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
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

    const paginationBar = (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {total} member{total !== 1 ? 's' : ''}{totalPages > 1 ? ` — page ${page} of ${totalPages}` : ''}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                    style={{ padding: '0.35rem 0.75rem', background: page <= 1 ? '#e2e8f0' : 'var(--primary)', color: page <= 1 ? 'var(--text-muted)' : 'white', cursor: page <= 1 ? 'default' : 'pointer' }}>
                    <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', minWidth: '3rem', textAlign: 'center' }}>
                    {page} / {totalPages}
                </span>
                <button className="btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                    style={{ padding: '0.35rem 0.75rem', background: page >= totalPages ? '#e2e8f0' : 'var(--primary)', color: page >= totalPages ? 'var(--text-muted)' : 'white', cursor: page >= totalPages ? 'default' : 'pointer' }}>
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <div className="glass" style={{ padding: '2rem', borderRadius: '20px', position: 'relative', minHeight: '70vh' }}>
                {notification && (
                    <div style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        padding: '1rem 2rem',
                        borderRadius: 'var(--radius)',
                        background: notification.type === 'error' ? 'var(--danger)' : 'var(--success)',
                        color: 'white',
                        fontWeight: 'bold',
                        boxShadow: 'var(--shadow)',
                        zIndex: 2000,
                        animation: 'fadeIn 0.3s'
                    }}>
                        {notification.message}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '250px', maxWidth: '400px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: '2.5rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
                                <option value="All">All Statuses</option>
                                <option value="Active">Active</option>
                                <option value="Canceled">Canceled</option>
                            </select>

                            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} style={{ width: 'auto' }}>
                                <option value="All">All Groups</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>Group {g.id}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn" style={{ background: '#f1f5f9' }} onClick={() => setIsImportOpen(true)}>
                            <FileUp size={18} /> Import Excel
                        </button>
                        <button className="btn btn-primary" onClick={() => handleOpenPanel()}>
                            <Plus size={18} /> New Member
                        </button>
                    </div>
                </div>

                {paginationBar}

                <div className="table-container" style={{ margin: '1rem 0' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Surname</th>
                                <th>Email</th>
                                <th>Group</th>
                                <th>Status</th>
                                <th>GDPR</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.id} className="member-row" onClick={() => handleOpenPanel(member)} style={{ cursor: 'pointer' }}>
                                    <td data-label="ID">{member.id}</td>
                                    <td data-label="Name">{member.name}</td>
                                    <td data-label="Surname">{member.surname}</td>
                                    <td data-label="Email" style={{ color: 'var(--text-muted)' }}>{member.email}</td>
                                    <td data-label="Group">
                                        {editingCell?.memberId === member.id && editingCell?.field === 'group_id' ? (
                                            <select
                                                autoFocus
                                                value={member.group_id}
                                                onChange={(e) => handleInlineSave(member, 'group_id', e.target.value)}
                                                onBlur={() => setEditingCell(null)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ padding: '0.25rem', margin: '-0.25rem 0' }}
                                            >
                                                {groups.map(g => <option key={g.id} value={g.id}>{g.id}</option>)}
                                            </select>
                                        ) : (
                                            <div
                                                className="inline-edit-trigger"
                                                onClick={(e) => { e.stopPropagation(); setEditingCell({ memberId: member.id, field: 'group_id' }); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600' }}
                                            >
                                                {member.group_id} <MoreHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                        )}
                                    </td>
                                    <td data-label="Status">
                                        {editingCell?.memberId === member.id && editingCell?.field === 'status' ? (
                                            <select
                                                autoFocus
                                                value={member.status}
                                                onChange={(e) => handleInlineSave(member, 'status', e.target.value)}
                                                onBlur={() => setEditingCell(null)}
                                                onClick={e => e.stopPropagation()}
                                                style={{ padding: '0.25rem', margin: '-0.25rem 0' }}
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Canceled">Canceled</option>
                                            </select>
                                        ) : (
                                            <div
                                                className="inline-edit-trigger"
                                                onClick={(e) => { e.stopPropagation(); setEditingCell({ memberId: member.id, field: 'status' }); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                            >
                                                <span className={`badge badge-${member.status.toLowerCase()}`}>{member.status}</span>
                                                <MoreHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
                                            </div>
                                        )}
                                    </td>
                                    <td data-label="GDPR">
                                        <div className="flex items-center gap-1">
                                            {member.gdpr_consent ? (
                                                <span className="badge badge-active flex items-center gap-1" style={{ background: '#ecfdf5', color: '#059669' }}>
                                                    <Shield size={12} /> Consented
                                                </span>
                                            ) : (
                                                <span className="badge" style={{ background: '#fff7ed', color: '#d97706', border: '1px solid #ffedd5' }}>
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label="Actions" style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        {confirmDeleteId === member.id ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>Confirm?</span>
                                                <button type="button" className="btn" onClick={() => deleteMember(member.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: 'white' }}>Yes</button>
                                                <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.6rem', background: '#e2e8f0' }}>No</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    type="button"
                                                    className="btn"
                                                    onClick={() => { setEmailMember(member); setIsEmailPanelOpen(true); }}
                                                    style={{ padding: '0.25rem 0.5rem', background: '#e0f2fe', color: '#0369a1' }}
                                                    title="Send Welcome Email"
                                                >
                                                    <MailIcon size={16} />
                                                </button>
                                                <button type="button" className="btn" onClick={() => handleOpenPanel(member)} style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}><Edit2 size={16} /></button>
                                                <button type="button" className="btn" onClick={() => deleteMember(member.id)} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {paginationBar}
            </div>

            <MemberSidePanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                member={selectedMember}
                groups={groups}
                onSave={handleSaveMember}
            />

            <ImportDashboard
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                token={token}
                onComplete={fetchMembers}
            />

            <EmailDraftPanel
                isOpen={isEmailPanelOpen}
                onClose={() => setIsEmailPanelOpen(false)}
                member={emailMember}
                token={token}
                groups={groups}
                setNotification={setNotification}
            />
        </>
    );
}

export default Dashboard;
