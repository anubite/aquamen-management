import React, { useState, useEffect } from 'react';
import { X, Tag, User, CreditCard, Building2, Hash, MessageSquare, Save, UserX } from 'lucide-react';
import axios from 'axios';

function ReadOnlyField({ label, value, valueStyle }) {
    return (
        <div className="form-group">
            <label>{label}</label>
            <div style={{
                padding: '0.625rem', background: '#f8fafc', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', fontSize: '0.875rem', minHeight: '38px', ...valueStyle
            }}>
                {value !== null && value !== undefined && value !== ''
                    ? value
                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
            </div>
        </div>
    );
}

function TransactionDetailPanel({ transaction, isOpen, onClose, categories, members, token, onUpdate }) {
    const [categoryId, setCategoryId] = useState('');
    const [memberId, setMemberId] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [isSavingCat, setIsSavingCat] = useState(false);
    const [isSavingMember, setIsSavingMember] = useState(false);
    const [notification, setNotification] = useState(null);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        if (transaction) {
            setCategoryId(transaction.category_id ? String(transaction.category_id) : '');
            setMemberId(transaction.member_id ? String(transaction.member_id) : '');
            setMemberSearch(transaction.member_name
                ? `${transaction.member_name} ${transaction.member_surname}`
                : '');
        }
    }, [transaction]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    if (!isOpen || !transaction) return null;

    const handleCategorize = async () => {
        setIsSavingCat(true);
        try {
            await axios.put(`/api/transactions/${transaction.id}/categorize`,
                { category_id: categoryId || null }, authHeader);
            onUpdate();
            setNotification({ message: 'Category saved', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally {
            setIsSavingCat(false);
        }
    };

    const handleLinkMember = async () => {
        setIsSavingMember(true);
        try {
            await axios.put(`/api/transactions/${transaction.id}/link-member`,
                { member_id: memberId || null }, authHeader);
            onUpdate();
            setNotification({ message: 'Member link saved', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally {
            setIsSavingMember(false);
        }
    };

    const handleUnlinkMember = () => {
        setMemberId('');
        setMemberSearch('');
    };

    // Client-side member search
    const filteredMembers = memberSearch.length >= 2
        ? members.filter(m =>
            `${m.name} ${m.surname} ${m.email}`.toLowerCase().includes(memberSearch.toLowerCase())
          ).slice(0, 10)
        : [];

    const amountStyle = {
        fontWeight: '700',
        color: transaction.amount >= 0 ? 'var(--success)' : 'var(--danger)'
    };

    return (
        <div className="side-panel-overlay" onClick={onClose}>
            <div className="side-panel glass" onClick={e => e.stopPropagation()}>
                {notification && (
                    <div style={{
                        position: 'absolute', top: '1rem', left: '1rem', right: '1rem',
                        padding: '0.75rem 1rem', borderRadius: 'var(--radius)',
                        background: notification.type === 'error' ? 'var(--danger)' : 'var(--success)',
                        color: 'white', fontWeight: 'bold', zIndex: 10, animation: 'fadeIn 0.3s'
                    }}>
                        {notification.message}
                    </div>
                )}

                <div className="side-panel-header">
                    <h2>Transaction Detail</h2>
                    <button className="btn-icon" onClick={onClose}><X /></button>
                </div>

                <div className="side-panel-content">
                    {/* Read-only: Transaction Info */}
                    <section style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            <CreditCard size={16} /> Transaction Info
                        </h3>
                        <ReadOnlyField label="Type" value={transaction.transaction_type} />
                        <ReadOnlyField label="Date" value={transaction.transaction_date} />
                        <ReadOnlyField
                            label="Amount"
                            value={`${transaction.amount >= 0 ? '+' : ''}${Number(transaction.amount).toLocaleString('cs-CZ')} CZK`}
                            valueStyle={amountStyle}
                        />
                    </section>

                    {/* Read-only: Counterparty */}
                    <section style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            <Building2 size={16} /> Counterparty
                        </h3>
                        <ReadOnlyField label="Name" value={transaction.counterparty_name} />
                        <ReadOnlyField label="Account" value={transaction.counterparty_account} />
                        <ReadOnlyField label="IBAN" value={transaction.iban} />
                        <ReadOnlyField label="BIC" value={transaction.bic} />
                    </section>

                    {/* Read-only: References & Messages */}
                    <section style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            <Hash size={16} /> References & Messages
                        </h3>
                        <ReadOnlyField label="Variable Symbol" value={transaction.variable_symbol} />
                        <ReadOnlyField label="Message for Recipient" value={transaction.message_for_recipient} />
                        <ReadOnlyField label="Message for Me" value={transaction.message_for_me} />
                    </section>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

                    {/* Editable: Category */}
                    <section style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            <Tag size={16} /> Category
                        </h3>
                        <div className="form-group">
                            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                                <option value="">— Uncategorized —</option>
                                {categories.map(c => (
                                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleCategorize} disabled={isSavingCat}
                            style={{ width: '100%' }}>
                            <Save size={16} /> {isSavingCat ? 'Saving…' : 'Save Category'}
                        </button>
                    </section>

                    {/* Editable: Member Link */}
                    <section>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            <User size={16} /> Linked Member
                        </h3>

                        {memberId && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem', background: '#ecfdf5', borderRadius: 'var(--radius)', border: '1px solid #a7f3d0', marginBottom: '0.75rem' }}>
                                <span style={{ fontWeight: '600', color: '#059669' }}>
                                    {members.find(m => String(m.id) === String(memberId))
                                        ? (() => { const m = members.find(mm => String(mm.id) === String(memberId)); return `${m.name} ${m.surname}`; })()
                                        : memberSearch || `Member ID ${memberId}`}
                                </span>
                                <button type="button" className="btn" onClick={handleUnlinkMember}
                                    style={{ padding: '0.2rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}>
                                    <UserX size={14} />
                                </button>
                            </div>
                        )}

                        <div className="form-group" style={{ position: 'relative' }}>
                            <label>Search member (type 2+ chars)</label>
                            <input
                                value={memberSearch}
                                onChange={e => {
                                    setMemberSearch(e.target.value);
                                    if (!e.target.value) setMemberId('');
                                }}
                                placeholder="Name, surname or email…"
                            />
                            {filteredMembers.length > 0 && (
                                <div style={{
                                    position: 'absolute', left: 0, right: 0,
                                    background: 'white', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)', marginTop: '2px',
                                    maxHeight: '180px', overflowY: 'auto', zIndex: 100,
                                    boxShadow: 'var(--shadow)'
                                }}>
                                    {filteredMembers.map(m => (
                                        <div key={m.id}
                                            onClick={() => { setMemberId(String(m.id)); setMemberSearch(`${m.name} ${m.surname}`); }}
                                            style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}
                                            onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <strong>{m.name} {m.surname}</strong>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{m.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="btn btn-primary" onClick={handleLinkMember} disabled={isSavingMember}
                            style={{ width: '100%', marginTop: '0.5rem' }}>
                            <Save size={16} /> {isSavingMember ? 'Saving…' : 'Save Member Link'}
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default TransactionDetailPanel;
