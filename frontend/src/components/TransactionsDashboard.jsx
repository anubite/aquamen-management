import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Search, FileUp, ChevronLeft, ChevronRight, ChevronDown, Eye,
    TrendingUp, TrendingDown, Minus, Wand2, Link2, X, Trash2
} from 'lucide-react';
import TransactionImport from './TransactionImport';
import TransactionDetailPanel from './TransactionDetailPanel';
import { useNotification } from '../context/NotificationContext';

const API_URL = '/api';
const PAGE_SIZE = 20;
const formatMonth = (ym) => { const [y, m] = ym.split('-'); return `${m}.${y}`; };
const normalize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function TransactionsDashboard({ token }) {
    const [transactions, setTransactions] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, net: 0 });

    const [categories, setCategories] = useState([]);
    const [transactionTypes, setTransactionTypes] = useState([]);
    const [months, setMonths] = useState([]);
    const [members, setMembers] = useState([]);

    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [memberLinkedFilter, setMemberLinkedFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const [showClearCategoriesConfirm, setShowClearCategoriesConfirm] = useState(false);
    const [showDeleteByMonthModal, setShowDeleteByMonthModal]         = useState(false);
    const [deleteSelectedMonths, setDeleteSelectedMonths]             = useState(new Set());
    const [showDeleteByMonthConfirm, setShowDeleteByMonthConfirm]     = useState(false);
    const [deleteMonthDropdownOpen, setDeleteMonthDropdownOpen]       = useState(false);
    const deleteMonthDropdownRef = useRef(null);

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkCategoryId, setBulkCategoryId] = useState('');
    const [bulkMemberSearch, setBulkMemberSearch] = useState('');
    const [bulkMemberId, setBulkMemberId] = useState('');

    const { setNotification } = useNotification();
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const fetchTransactions = async (currentPage = page) => {
        try {
            const params = {
                page: currentPage,
                limit: PAGE_SIZE,
                search,
                category_id: categoryFilter,
                date_from: dateFrom,
                date_to: dateTo,
                month: monthFilter,
                member_linked: memberLinkedFilter,
                transaction_type: typeFilter,
            };
            const res = await axios.get(`${API_URL}/transactions`, { ...authHeader, params });
            setTransactions(res.data.transactions);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
            setSummary(res.data.summary || { total_income: 0, total_expense: 0, net: 0 });
        } catch (err) {
            console.error('Error fetching transactions', err);
        }
    };

    const fetchMeta = async () => {
        try {
            const [catRes, typeRes, monthRes, memberRes] = await Promise.all([
                axios.get(`${API_URL}/transaction-categories`, authHeader),
                axios.get(`${API_URL}/transactions/types`, authHeader),
                axios.get(`${API_URL}/transactions/months`, authHeader),
                axios.get(`${API_URL}/members`, { ...authHeader, params: { limit: 500 } }),
            ]);
            setCategories(catRes.data);
            setTransactionTypes(typeRes.data);
            setMonths(monthRes.data);
            setMembers(memberRes.data.members || []);
        } catch (err) {
            console.error('Error fetching meta', err);
        }
    };

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
        fetchTransactions(1);
    }, [search, categoryFilter, typeFilter, memberLinkedFilter, monthFilter, dateFrom, dateTo]);

    // Fetch new page without resetting
    useEffect(() => {
        setSelectedIds(new Set());
        fetchTransactions(page);
    }, [page]);

    useEffect(() => { fetchMeta(); }, [token]);

    useEffect(() => {
        const handler = (e) => {
            if (deleteMonthDropdownRef.current && !deleteMonthDropdownRef.current.contains(e.target))
                setDeleteMonthDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAutoCategories = async () => {
        try {
            const res = await axios.post(`${API_URL}/transactions/auto-categorize`, {}, authHeader);
            fetchTransactions();
            setNotification({ message: `Auto-categorized ${res.data.categorized} transaction(s)`, type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const handleAutoLinkMembers = async () => {
        try {
            const res = await axios.post(`${API_URL}/transactions/auto-link-members`, {}, authHeader);
            fetchTransactions();
            setNotification({ message: `Linked ${res.data.linked} transaction(s) to members`, type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const handleDeleteByMonth = async () => {
        try {
            const monthsArr = [...deleteSelectedMonths];
            const res = await axios.delete(`${API_URL}/transactions/by-months`,
                { ...authHeader, data: { months: monthsArr } });
            setShowDeleteByMonthConfirm(false);
            setShowDeleteByMonthModal(false);
            setDeleteSelectedMonths(new Set());
            fetchTransactions(1);
            setPage(1);
            fetchMeta();
            setNotification({ message: res.data.message, type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
            setShowDeleteByMonthConfirm(false);
        }
    };

    const handleClearCategories = async () => {
        try {
            const res = await axios.post(`${API_URL}/transactions/clear-categories`, {}, authHeader);
            setShowClearCategoriesConfirm(false);
            fetchTransactions(1);
            setPage(1);
            setNotification({ message: res.data.message, type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
            setShowClearCategoriesConfirm(false);
        }
    };

    const handleBulkCategorize = async () => {
        const ids = [...selectedIds];
        try {
            const res = await axios.put(`${API_URL}/transactions/bulk-categorize`,
                { ids, category_id: bulkCategoryId || null }, authHeader);
            setNotification({ message: res.data.message, type: 'success' });
            setSelectedIds(new Set());
            fetchTransactions(page);
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const handleBulkLinkMember = async () => {
        const ids = [...selectedIds];
        try {
            const res = await axios.put(`${API_URL}/transactions/bulk-link-member`,
                { ids, member_id: bulkMemberId || null }, authHeader);
            setNotification({ message: res.data.message, type: 'success' });
            setSelectedIds(new Set());
            setBulkMemberSearch('');
            setBulkMemberId('');
            fetchTransactions(page);
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const handleClearFilters = () => {
        setSearch('');
        setDateFrom('');
        setDateTo('');
        setMonthFilter('');
        setCategoryFilter('All');
        setTypeFilter('All');
        setMemberLinkedFilter('');
    };

    const fmt = (n) => n != null ? Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0';

    const paginationBar = (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {total} transaction{total !== 1 ? 's' : ''}{totalPages > 1 ? ` — page ${page} of ${totalPages}` : ''}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                    style={{ padding: '0.35rem 0.75rem', background: page <= 1 ? '#e2e8f0' : 'var(--primary)', color: page <= 1 ? 'var(--text-muted)' : 'white', cursor: page <= 1 ? 'default' : 'pointer' }}>
                    <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', minWidth: '3rem', textAlign: 'center' }}>{page} / {totalPages}</span>
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
                {/* Summary bar */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div className="summary-card glass">
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Income</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <TrendingUp size={18} /> +{fmt(summary.total_income)} CZK
                        </div>
                    </div>
                    <div className="summary-card glass">
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Expense</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <TrendingDown size={18} /> {fmt(summary.total_expense)} CZK
                        </div>
                    </div>
                    <div className="summary-card glass">
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Net</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: summary.net >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Minus size={18} /> {fmt(summary.net)} CZK
                        </div>
                    </div>
                </div>

                {/* Filter bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {/* Row 1: Search + action buttons */}
                    <div className="filter-row" style={{ justifyContent: 'space-between' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '160px' }}>
                            <label>Search</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input type="text" placeholder="Search counterparty, VS, message…" value={search}
                                    onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem', width: '100%' }} />
                            </div>
                        </div>
                        <div className="action-buttons">
                            <button className="btn" style={{ background: '#f1f5f9' }} onClick={handleAutoCategories} title="Re-run categorization rules on uncategorized transactions">
                                <Wand2 size={16} /> Auto-categorize
                            </button>
                            <button className="btn" style={{ background: '#f1f5f9' }} onClick={handleAutoLinkMembers} title="Auto-link transactions to members by variable symbol">
                                <Link2 size={16} /> Auto-link Members
                            </button>
                            <button className="btn" style={{ background: '#fee2e2', color: 'var(--danger)' }}
                                onClick={() => setShowClearCategoriesConfirm(true)} title="Remove category from all transactions">
                                <X size={16} /> Clear Categories
                            </button>
                            <button className="btn" style={{ background: '#fee2e2', color: 'var(--danger)' }}
                                onClick={() => { setDeleteSelectedMonths(new Set()); setShowDeleteByMonthModal(true); }}
                                title="Delete all transactions for selected months">
                                <Trash2 size={16} /> Delete Transactions
                            </button>
                            <button className="btn btn-primary" onClick={() => setIsImportOpen(true)}>
                                <FileUp size={16} /> Import
                            </button>
                        </div>
                    </div>

                    {/* Row 2: From / To / Month */}
                    <div className="filter-row">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>From</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 'auto' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>To</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 'auto' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Month</label>
                            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ width: 'auto' }}>
                                <option value="">All Months</option>
                                {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Category / Type / Member Link + Clear Filters */}
                    <div className="filter-row">
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                            <label>Category</label>
                            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: '100%' }}>
                                <option value="All">All Categories</option>
                                <option value="uncategorized">Uncategorized</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                            <label>Type</label>
                            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '100%' }}>
                                <option value="All">All Types</option>
                                {transactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '120px' }}>
                            <label>Member Link</label>
                            <select value={memberLinkedFilter} onChange={e => setMemberLinkedFilter(e.target.value)} style={{ width: '100%' }}>
                                <option value="">All</option>
                                <option value="yes">Linked to member</option>
                                <option value="no">Not linked</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ visibility: 'hidden', fontSize: '0.75rem' }}>x</label>
                            <button className="btn" onClick={handleClearFilters} style={{ background: '#e2e8f0', whiteSpace: 'nowrap' }}>
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bulk action panel */}
                {selectedIds.size > 0 && (
                    <div style={{ padding: '1rem', background: '#f5f5f5', border: '1px solid #e0e0e0',
                        borderRadius: 'var(--radius)', marginBottom: '1rem' }}>

                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '600', color: 'var(--primary)' }}>
                                {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
                            </span>
                            <button className="btn" onClick={() => setSelectedIds(new Set())}
                                style={{ background: '#eeeeee' }}>
                                Deselect all
                            </button>
                        </div>

                        {/* Action row */}
                        <div className="bulk-panel-actions">
                            {/* Category group */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flex: 1 }}>
                                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                    <label>Set Category</label>
                                    <select value={bulkCategoryId} onChange={e => setBulkCategoryId(e.target.value)} style={{ width: '100%' }}>
                                        <option value="">— Remove category —</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ visibility: 'hidden', fontSize: '0.75rem' }}>x</label>
                                    <button className="btn btn-primary" onClick={handleBulkCategorize}>Apply</button>
                                </div>
                            </div>

                            {/* Member group */}
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flex: 1 }}>
                                <div className="form-group" style={{ marginBottom: 0, position: 'relative', flex: 1 }}>
                                    <label>Set Member</label>
                                    <input value={bulkMemberSearch}
                                        onChange={e => { setBulkMemberSearch(e.target.value); if (!e.target.value) setBulkMemberId(''); }}
                                        placeholder="Search or leave blank to unlink…" style={{ width: '100%' }} />
                                    {bulkMemberSearch.length >= 2 && !bulkMemberId && (() => {
                                        const hits = members.filter(m =>
                                            normalize(`${m.name} ${m.surname} ${m.email}`).includes(normalize(bulkMemberSearch))
                                        ).slice(0, 8);
                                        return hits.length > 0 ? (
                                            <div style={{ position: 'absolute', left: 0, right: 0, background: 'white',
                                                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                                                maxHeight: '160px', overflowY: 'auto', zIndex: 100, boxShadow: 'var(--shadow)' }}>
                                                {hits.map(m => (
                                                    <div key={m.id}
                                                        onClick={() => { setBulkMemberId(String(m.id)); setBulkMemberSearch(`${m.name} ${m.surname}`); }}
                                                        style={{ padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}
                                                        onMouseOver={e => e.currentTarget.style.background = '#eeeeee'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                                        <strong>{m.name} {m.surname}</strong>
                                                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{m.email}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <label style={{ visibility: 'hidden', fontSize: '0.75rem' }}>x</label>
                                    <button className="btn btn-primary" onClick={handleBulkLinkMember}>Apply</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {paginationBar}

                <div className="table-container" style={{ margin: '1rem 0' }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '2rem' }}>
                                    <input type="checkbox"
                                        checked={transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id))}
                                        ref={el => { if (el) el.indeterminate = transactions.some(tx => selectedIds.has(tx.id)) && !transactions.every(tx => selectedIds.has(tx.id)); }}
                                        onChange={e => {
                                            if (e.target.checked) setSelectedIds(new Set(transactions.map(tx => tx.id)));
                                            else setSelectedIds(new Set());
                                        }}
                                    />
                                </th>
                                <th>Date</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th>Counterparty</th>
                                <th>VS</th>
                                <th>Category</th>
                                <th>Member</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => (
                                <tr key={tx.id} onClick={() => { setSelectedTransaction(tx); setIsDetailOpen(true); }} style={{ cursor: 'pointer' }} className="member-row">
                                    <td onClick={e => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedIds.has(tx.id)}
                                            onChange={e => {
                                                const next = new Set(selectedIds);
                                                e.target.checked ? next.add(tx.id) : next.delete(tx.id);
                                                setSelectedIds(next);
                                            }}
                                        />
                                    </td>
                                    <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>{tx.transaction_date}</td>
                                    <td data-label="Type" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.transaction_type}</td>
                                    <td data-label="Amount" style={{ textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                        {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                                    </td>
                                    <td data-label="Counterparty" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {tx.counterparty_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td data-label="VS" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                        {tx.variable_symbol || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td data-label="Category">
                                        {tx.category_name ? (
                                            <span className="badge" style={{
                                                background: tx.category_color + '22',
                                                color: tx.category_color,
                                                border: `1px solid ${tx.category_color}55`
                                            }}>
                                                {tx.category_name}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>Uncategorized</span>
                                        )}
                                    </td>
                                    <td data-label="Member">
                                        {tx.member_name
                                            ? <span style={{ fontWeight: '500' }}>{tx.member_name} {tx.member_surname}</span>
                                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td data-label="Actions" style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        <button type="button" className="btn"
                                            onClick={() => { setSelectedTransaction(tx); setIsDetailOpen(true); }}
                                            style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}
                                            title="View details">
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem' }}>
                                        No transactions found. Import an internet banking file to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {paginationBar}
            </div>

            {/* Clear categories confirmation modal */}
            {showClearCategoriesConfirm && (
                <div className="modal-overlay" onClick={() => setShowClearCategoriesConfirm(false)}>
                    <div className="glass" style={{ padding: '2rem', borderRadius: '20px', maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Remove All Categories?</h3>
                        <p style={{ color: 'var(--text-muted)' }}>
                            This will remove the category from <strong>all transactions</strong>. This cannot be undone. You can re-run Auto-categorize afterward.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setShowClearCategoriesConfirm(false)} style={{ background: '#e2e8f0' }}>Cancel</button>
                            <button className="btn" onClick={handleClearCategories} style={{ background: 'var(--danger)', color: 'white' }}>Remove All</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete by month — month picker modal */}
            {showDeleteByMonthModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteByMonthModal(false)}>
                    <div className="glass" style={{ padding: '2rem', borderRadius: '20px', maxWidth: '420px', width: '90%' }}
                        onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Delete Transactions by Month</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Select one or more months to permanently delete all their transactions.
                        </p>
                        <div ref={deleteMonthDropdownRef} style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <button type="button" className="btn"
                                style={{ width: '100%', justifyContent: 'space-between', background: '#f1f5f9' }}
                                onClick={() => setDeleteMonthDropdownOpen(v => !v)}>
                                <span>{deleteSelectedMonths.size === 0 ? 'Select months…' : `${deleteSelectedMonths.size} month${deleteSelectedMonths.size > 1 ? 's' : ''} selected`}</span>
                                <ChevronDown size={14} />
                            </button>
                            {deleteMonthDropdownOpen && (
                                <div className="nav-dropdown-menu glass"
                                    style={{ left: 0, right: 0, minWidth: 'unset', maxHeight: 240, overflowY: 'auto', padding: '0.5rem' }}>
                                    {months.map(m => {
                                        const checked = deleteSelectedMonths.has(m);
                                        return (
                                            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.25rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                                <input type="checkbox" checked={checked} style={{ width: 'auto', margin: 0 }}
                                                    onChange={() => {
                                                        const next = new Set(deleteSelectedMonths);
                                                        checked ? next.delete(m) : next.add(m);
                                                        setDeleteSelectedMonths(next);
                                                    }} />
                                                {formatMonth(m)}
                                            </label>
                                        );
                                    })}
                                    {months.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem' }}>No transaction months found.</div>}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setShowDeleteByMonthModal(false)} style={{ background: '#e2e8f0' }}>Cancel</button>
                            <button className="btn" disabled={deleteSelectedMonths.size === 0}
                                onClick={() => setShowDeleteByMonthConfirm(true)}
                                style={{ background: 'var(--danger)', color: 'white', opacity: deleteSelectedMonths.size === 0 ? 0.5 : 1 }}>
                                Delete {deleteSelectedMonths.size > 0 ? `${deleteSelectedMonths.size} month${deleteSelectedMonths.size > 1 ? 's' : ''}` : ''}…
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete by month — confirmation modal */}
            {showDeleteByMonthConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteByMonthConfirm(false)}>
                    <div className="glass" style={{ padding: '2rem', borderRadius: '20px', maxWidth: '400px', width: '90%' }}
                        onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0, color: 'var(--danger)' }}>Confirm Deletion</h3>
                        <p style={{ color: 'var(--text-muted)' }}>
                            All transactions from the following month{deleteSelectedMonths.size > 1 ? 's' : ''} will be <strong>permanently deleted</strong> and fees will be recalculated:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.25rem' }}>
                            {[...deleteSelectedMonths].sort().map(m => (
                                <span key={m} style={{ background: '#fee2e2', color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '2px 10px', fontSize: '0.875rem', fontWeight: 600 }}>{m}</span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setShowDeleteByMonthConfirm(false)} style={{ background: '#e2e8f0' }}>Cancel</button>
                            <button className="btn" onClick={handleDeleteByMonth} style={{ background: 'var(--danger)', color: 'white' }}>
                                <Trash2 size={15} /> Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TransactionImport
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                token={token}
                onComplete={() => { fetchTransactions(); fetchMeta(); }}
            />

            <TransactionDetailPanel
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                transaction={selectedTransaction}
                categories={categories}
                members={members}
                token={token}
                onUpdate={fetchTransactions}
            />
        </>
    );
}

export default TransactionsDashboard;
