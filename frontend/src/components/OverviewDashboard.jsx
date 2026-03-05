import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { RefreshCw, Search, Edit2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const API_URL = '/api';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMonth = (ym) => {
    const [y, m] = ym.split('-');
    return `${MONTH_NAMES[Number(m) - 1]} '${y.slice(2)}`;
};

const fmtCurrency = (n) => `${Number(n).toLocaleString('cs-CZ')} Kč`;

function cellColors(cell) {
    if (!cell || !cell.is_active) return { bg: '#f8fafc', text: '#94a3b8' };
    if (cell.amount_paid >= cell.amount_due) return { bg: '#dcfce7', text: '#166534' };
    if (cell.amount_paid > 0)               return { bg: '#fef9c3', text: '#854d0e' };
    return { bg: '#fee2e2', text: '#991b1b' };
}

function outstandingStyle(fd) {
    if (!fd) return { color: 'var(--text-muted)' };
    if (fd.outstanding <= 0)    return { color: '#166534', fontWeight: 600 };
    if (fd.outstanding < 1000)  return { color: '#b45309', fontWeight: 600 };
    return { color: 'var(--danger)', fontWeight: 600 };
}

// ─── Override modal ─────────────────────────────────────────────────────────

function OverrideModal({ member, onSave, onClear, onClose }) {
    const [form, setForm] = useState({
        override_amount: member.fees_due?.override_amount != null ? String(member.fees_due.override_amount) : '',
        override_note:   member.fees_due?.override_note || '',
    });

    const canSave = form.override_amount !== '' && !isNaN(parseFloat(form.override_amount));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass" onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', borderRadius: '16px', boxShadow: 'var(--shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Override Fees Due</h3>
                    <button className="btn" onClick={onClose} style={{ padding: '0.25rem', background: 'transparent' }}>
                        <X size={20} />
                    </button>
                </div>

                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    <strong>{member.surname} {member.name}</strong> · Current outstanding:{' '}
                    <strong style={outstandingStyle(member.fees_due)}>
                        {member.fees_due ? fmtCurrency(member.fees_due.outstanding) : '—'}
                    </strong>
                </p>

                {member.fees_due?.override_amount != null && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef9c3', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: '#854d0e' }}>
                        <div>
                            Active override: <strong>{fmtCurrency(member.fees_due.override_amount)}</strong>
                            {member.fees_due.override_note && <> — {member.fees_due.override_note}</>}
                        </div>
                        {member.fees_due.override_at && (
                            <div style={{ marginTop: '3px', fontSize: '0.8rem', opacity: 0.8 }}>
                                Set as of: <strong>{fmtMonth(member.fees_due.override_at.slice(0, 7))}</strong>
                            </div>
                        )}
                        <button className="btn" onClick={() => onClear(member.id)}
                            style={{ marginTop: '0.5rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem', background: '#fee2e2', color: 'var(--danger)' }}>
                            Clear
                        </button>
                    </div>
                )}

                {member.fees_due?.unpaid_months?.length > 0 && (
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: '#991b1b' }}>
                        Unpaid months ({member.fees_due.unpaid_months.length}):
                        <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {member.fees_due.unpaid_months.map(m => (
                                <span key={m} style={{ background: '#fca5a5', borderRadius: 4, padding: '1px 6px', fontSize: '0.8rem' }}>
                                    {fmtMonth(m)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label>Override Amount (Kč)</label>
                    <input type="number" step="1" value={form.override_amount}
                        onChange={e => setForm({ ...form, override_amount: e.target.value })}
                        placeholder="e.g. 2700" autoFocus />
                </div>
                <div className="form-group">
                    <label>Note (optional)</label>
                    <input value={form.override_note}
                        onChange={e => setForm({ ...form, override_note: e.target.value })}
                        placeholder="e.g. Agreed payment plan" />
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                    New override will be anchored to the last transaction month.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0' }}>
                    <button className="btn" onClick={onClose} style={{ background: '#e2e8f0' }}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => onSave(member.id, form)} disabled={!canSave}>
                        <Check size={16} /> Save Override
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Mobile member card ──────────────────────────────────────────────────────

function MobileCard({ member, months, onOverride }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="glass overview-mobile-card">
            <div className="overview-mobile-card-header" onClick={() => setExpanded(v => !v)}>
                <div>
                    <div style={{ fontWeight: 600 }}>{member.surname} {member.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {member.member_type}
                    </div>
                    <div style={{ display: 'flex', gap: '3px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {months.map(month => {
                            const c = cellColors(member.payments[month]);
                            return (
                                <span key={month} title={`${fmtMonth(month)}: paid ${member.payments[month]?.amount_paid ?? 0}`}
                                    style={{ width: 10, height: 10, borderRadius: '50%', background: c.bg, border: `1px solid ${c.text}40`, flexShrink: 0 }} />
                            );
                        })}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                        {member.fees_due ? (
                            <>
                                <div style={outstandingStyle(member.fees_due)}>
                                    {fmtCurrency(member.fees_due.outstanding)}
                                </div>
                                {member.fees_due.override_amount != null && (
                                    <div style={{ fontSize: '0.7rem', color: '#b45309' }}>override</div>
                                )}
                            </>
                        ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                    </div>
                    {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>
            </div>

            {expanded && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)' }}>
                                <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 600 }}>Month</th>
                                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Paid</th>
                                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 600 }}>Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            {months.map(month => {
                                const cell = member.payments[month];
                                if (!cell || !cell.is_active) return null;
                                const c = cellColors(cell);
                                return (
                                    <tr key={month}>
                                        <td style={{ padding: '3px 6px' }}>{fmtMonth(month)}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right', color: c.text, fontWeight: 600 }}>
                                            {Number(cell.amount_paid).toLocaleString('cs-CZ')}
                                        </td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {Number(cell.amount_due).toLocaleString('cs-CZ')}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <button className="btn" onClick={() => onOverride(member)}
                        style={{ marginTop: '0.75rem', width: '100%', background: '#f1f5f9', fontSize: '0.875rem' }}>
                        <Edit2 size={14} /> Edit Fees Override
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OverviewDashboard({ token }) {
    const [data, setData] = useState({ months: [], members: [] });
    const [search, setSearch] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [loading, setLoading] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [overrideMember, setOverrideMember] = useState(null);
    const [statusFilter, setStatusFilter] = useState('active');
    const [availableMonths, setAvailableMonths] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [monthPickerOpen, setMonthPickerOpen] = useState(false);
    const monthPickerRef = useRef(null);
    const { setNotification } = useNotification();

    // Fetch all available months once on mount
    useEffect(() => {
        axios.get(`${API_URL}/transactions/months`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                setAvailableMonths(res.data);
                setSelectedMonths(res.data.slice(0, 6));
            })
            .catch(() => {});
    }, [token]);

    // Close month picker when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (monthPickerRef.current && !monthPickerRef.current.contains(e.target))
                setMonthPickerOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleMonth = (m) => {
        setSelectedMonths(prev =>
            prev.includes(m) ? prev.filter(x => x !== m)
                : prev.length < 12 ? [...prev, m] : prev
        );
    };

    const fetchPivot = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${API_URL}/overview/pivot?status=${statusFilter}` +
                (selectedMonths.length ? `&months=${selectedMonths.join(',')}` : ''),
                { headers: { Authorization: `Bearer ${token}` } });
            // Reverse so oldest month is on the left, newest on the right
            setData({ ...res.data, months: [...res.data.months].reverse() });
        } catch (err) {
            setNotification({ message: 'Error loading overview: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [token, statusFilter, selectedMonths]);

    useEffect(() => { fetchPivot(); }, [fetchPivot]);

    const recalculate = async () => {
        setRecalculating(true);
        try {
            const res = await axios.post(`${API_URL}/overview/recalculate`, {},
                { headers: { Authorization: `Bearer ${token}` } });
            setNotification({ message: `Recalculated ${res.data.updated} member(s)`, type: 'success' });
            await fetchPivot();
        } catch (err) {
            setNotification({ message: 'Recalculate failed: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally {
            setRecalculating(false);
        }
    };

    const saveOverride = async (memberId, form) => {
        try {
            await axios.put(`${API_URL}/overview/members/${memberId}/fees-override`,
                { override_amount: parseFloat(form.override_amount), override_note: form.override_note },
                { headers: { Authorization: `Bearer ${token}` } });
            setNotification({ message: 'Override saved', type: 'success' });
            setOverrideMember(null);
            await fetchPivot();
        } catch (err) {
            setNotification({ message: err.response?.data?.error || err.message, type: 'error' });
        }
    };

    const clearOverride = async (memberId) => {
        try {
            await axios.delete(`${API_URL}/overview/members/${memberId}/fees-override`,
                { headers: { Authorization: `Bearer ${token}` } });
            setNotification({ message: 'Override cleared', type: 'success' });
            setOverrideMember(null);
            await fetchPivot();
        } catch (err) {
            setNotification({ message: err.response?.data?.error || err.message, type: 'error' });
        }
    };

    const filtered = data.members.filter(m => {
        const q = search.toLowerCase();
        return `${m.name} ${m.surname}`.toLowerCase().includes(q) ||
               `${m.surname} ${m.name}`.toLowerCase().includes(q);
    });

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div>
            {/* Filter bar */}
            <div className="overview-filter-bar glass">
                <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: '300px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search members…"
                        style={{ paddingLeft: '2.1rem', width: '100%' }} />
                </div>

                {/* Status filter */}
                <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', borderRadius: 'var(--radius)', padding: '2px' }}>
                    {[['active', 'Active'], ['canceled', 'Cancelled'], ['all', 'All']].map(([val, label]) => (
                        <button key={val} type="button"
                            className={`btn ${statusFilter === val ? 'btn-primary' : ''}`}
                            style={statusFilter === val
                                ? { padding: '0.3rem 0.75rem', fontSize: '0.875rem' }
                                : { padding: '0.3rem 0.75rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--text)' }}
                            onClick={() => setStatusFilter(val)}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Month picker */}
                <div ref={monthPickerRef} style={{ position: 'relative' }}>
                    <button type="button" className="btn"
                        style={{ background: '#f1f5f9', whiteSpace: 'nowrap' }}
                        onClick={() => setMonthPickerOpen(v => !v)}>
                        {selectedMonths.length} month{selectedMonths.length !== 1 ? 's' : ''} <ChevronDown size={14} style={{ marginLeft: 2 }} />
                    </button>
                    {monthPickerOpen && (
                        <div className="nav-dropdown-menu glass"
                            style={{ right: 0, left: 'auto', minWidth: 150, maxHeight: 280, overflowY: 'auto', padding: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.25rem 0.4rem', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem' }}>
                                Select up to 12 months
                            </div>
                            {availableMonths.map(m => {
                                const checked = selectedMonths.includes(m);
                                const disabled = !checked && selectedMonths.length >= 12;
                                return (
                                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.25rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, fontSize: '0.875rem' }}>
                                        <input type="checkbox" checked={checked} disabled={disabled}
                                            onChange={() => toggleMonth(m)} style={{ width: 'auto', margin: 0 }} />
                                        {fmtMonth(m)}
                                    </label>
                                );
                            })}
                            {availableMonths.length === 0 && (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem' }}>No transactions found</div>
                            )}
                        </div>
                    )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.9rem', userSelect: 'none' }}>
                    <input type="checkbox" style={{ width: 'auto', margin: 0 }}
                        checked={showDetails} onChange={e => setShowDetails(e.target.checked)} />
                    Paid / Due
                </label>

                <button className="btn btn-primary" onClick={recalculate} disabled={recalculating} style={{ whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                    <RefreshCw size={15} className={recalculating ? 'animate-spin' : ''} />
                    {recalculating ? 'Recalculating…' : 'Recalculate'}
                </button>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading…</div>
            )}

            {!loading && data.members.length === 0 && (
                <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: '20px', marginTop: '1rem' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        No data yet. Make sure a category is marked as <strong>Membership Fee</strong>, then run Recalculate.
                    </p>
                    <button className="btn btn-primary" onClick={recalculate} disabled={recalculating}>
                        <RefreshCw size={16} className={recalculating ? 'animate-spin' : ''} />
                        Recalculate Now
                    </button>
                </div>
            )}

            {!loading && data.months.length > 0 && (
                <>
                    {/* ── Desktop pivot table ── */}
                    <div className="overview-table-wrap glass">
                        <table className="overview-table">
                            <thead>
                                <tr>
                                    <th className="overview-sticky-left overview-col-member">Member</th>
                                    {data.months.map(m => (
                                        <th key={m} className="overview-col-month">{fmtMonth(m)}</th>
                                    ))}
                                    <th className="overview-sticky-right overview-col-fees">Fees Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(member => (
                                    <tr key={member.id}>
                                        <td className="overview-sticky-left overview-col-member">
                                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {member.surname} {member.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                                {member.member_type}
                                            </div>
                                        </td>

                                        {data.months.map(month => {
                                            const cell = member.payments[month];
                                            const { bg, text } = cellColors(cell);
                                            if (!cell || !cell.is_active) {
                                                return (
                                                    <td key={month} className="overview-col-month overview-cell"
                                                        style={{ background: bg, color: text }}>—</td>
                                                );
                                            }
                                            return (
                                                <td key={month} className="overview-col-month overview-cell"
                                                    style={{ background: bg, color: text }}>
                                                    {showDetails ? (
                                                        <div style={{ lineHeight: 1.3 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                                                                {Number(cell.amount_paid).toLocaleString('cs-CZ')}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>
                                                                / {Number(cell.amount_due).toLocaleString('cs-CZ')}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.85rem', fontWeight: cell.amount_paid >= cell.amount_due ? 600 : 400 }}>
                                                            {Number(cell.amount_paid).toLocaleString('cs-CZ')}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}

                                        <td className="overview-sticky-right overview-col-fees">
                                            {member.fees_due ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between' }}>
                                                    <div>
                                                        <span style={outstandingStyle(member.fees_due)}>
                                                            {fmtCurrency(member.fees_due.outstanding)}
                                                        </span>
                                                        {member.fees_due.override_amount != null && (
                                                            <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: 1 }}>override</div>
                                                        )}
                                                    </div>
                                                    <button className="btn" onClick={() => setOverrideMember(member)}
                                                        style={{ padding: '0.2rem 0.4rem', background: '#f1f5f9', flexShrink: 0 }}
                                                        title="Edit fees override">
                                                        <Edit2 size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={data.months.length + 2}
                                            style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontStyle: 'italic' }}>
                                            No members match your search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── Mobile cards ── */}
                    <div className="overview-mobile-cards">
                        {filtered.map(member => (
                            <MobileCard key={member.id} member={member} months={data.months}
                                onOverride={setOverrideMember} />
                        ))}
                        {filtered.length === 0 && (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem' }}>
                                No members match your search.
                            </p>
                        )}
                    </div>

                    {/* ── Legend ── */}
                    <div className="overview-legend">
                        {[
                            { bg: '#dcfce7', border: '#86efac', label: 'Paid' },
                            { bg: '#fef9c3', border: '#fde047', label: 'Partial' },
                            { bg: '#fee2e2', border: '#fca5a5', label: 'Unpaid' },
                            { bg: '#f8fafc', border: '#e2e8f0', label: 'Inactive' },
                        ].map(({ bg, border, label }) => (
                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${border}`, flexShrink: 0 }} />
                                {label}
                            </span>
                        ))}
                    </div>
                </>
            )}

            {/* Override modal */}
            {overrideMember && (
                <OverrideModal
                    member={overrideMember}
                    onSave={saveOverride}
                    onClear={clearOverride}
                    onClose={() => setOverrideMember(null)}
                />
            )}
        </div>
    );
}
