import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, Wallet, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (n) =>
    Number(n ?? 0).toLocaleString('cs-CZ', { minimumFractionDigits: 2 }) + ' Kč';

function Row({ label, value, labelWeight = 400, valueColor = 'inherit' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem' }}>
            <span style={{ fontWeight: labelWeight }}>{label}</span>
            <span style={{ fontWeight: labelWeight, color: valueColor }}>{value}</span>
        </div>
    );
}

function SectionHeader({ icon, label, total, color }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.5rem 0.2rem', borderTop: '1px solid var(--border)', fontWeight: 600, color }}>
            {icon} {label}
            <span style={{ marginLeft: 'auto' }}>{total}</span>
        </div>
    );
}

function CategoryRow({ category, color }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.2rem 0.5rem 0.2rem 1.5rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: category.color, flexShrink: 0 }} />
                {category.name}
            </div>
            <span style={{ color }}>{fmt(category.total)}</span>
        </div>
    );
}

export default function FinancialSummary({ token, filters }) {
    const [data, setData]         = useState(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const params = {};
        if (filters.months)   params.months    = filters.months;
        if (filters.month)    params.month     = filters.month;
        if (filters.dateFrom) params.date_from = filters.dateFrom;
        if (filters.dateTo)   params.date_to   = filters.dateTo;

        axios
            .get('/api/transactions/summary', {
                params,
                headers: { Authorization: `Bearer ${token}` },
            })
            .then(res  => { if (!cancelled) { setData(res.data); setLoading(false); } })
            .catch((err) => { if (!cancelled) { setError(err.response?.data?.error || err.message || 'Failed to load summary'); setLoading(false); } });

        return () => { cancelled = true; };
    }, [filters.months, filters.month, filters.dateFrom, filters.dateTo, token]);

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="summary-card glass" style={{ minHeight: '72px', opacity: 0.5 }} />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ marginBottom: '1.5rem', color: 'var(--danger)', fontSize: '0.875rem' }}>
                {error}
            </div>
        );
    }

    const closingColor = data.closing_balance >= 0 ? 'var(--success)' : 'var(--danger)';
    const netColor     = data.net >= 0 ? 'var(--success)' : 'var(--danger)';

    const incomeCategories  = data.categories.filter(c => c.total > 0);
    const expenseCategories = data.categories.filter(c => c.total < 0);

    return (
        <div style={{ marginBottom: '1.5rem' }}>
            {/* ── Summary bar (always visible) ── */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
                {/* Opening Balance */}
                <div className="summary-card glass" style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Opening Balance
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Wallet size={16} style={{ color: 'var(--text-muted)' }} />
                        {fmt(data.opening_balance)}
                    </div>
                </div>

                {/* Income */}
                <div className="summary-card glass" style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Income
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <TrendingUp size={16} />
                        +{fmt(data.income)}
                    </div>
                </div>

                {/* Expense */}
                <div className="summary-card glass" style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Expense
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <TrendingDown size={16} />
                        {fmt(data.expense)}
                    </div>
                </div>

                {/* Closing Balance */}
                <div className="summary-card glass" style={{ flex: '1 1 160px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Closing Balance
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: closingColor, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <BarChart2 size={16} />
                        {fmt(data.closing_balance)}
                    </div>
                </div>

                {/* Expand toggle */}
                <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setExpanded(v => !v)}
                    title={expanded ? 'Hide breakdown' : 'Show breakdown'}
                    style={{ alignSelf: 'center', flexShrink: 0 }}
                >
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>

            {/* ── Expanded breakdown ── */}
            {expanded && (
                <div className="glass" style={{ marginTop: '0.75rem', borderRadius: 'var(--radius)', padding: '1.25rem', fontSize: '0.875rem' }}>
                    {/* Opening balance */}
                    <Row label="Opening Balance" value={fmt(data.opening_balance)} />

                    {/* Income section */}
                    {incomeCategories.length > 0 && <>
                        <SectionHeader icon={<TrendingUp size={14} />} label="Income" total={fmt(data.income)} color="var(--success)" />
                        {incomeCategories.map(c => (
                            <CategoryRow key={c.id ?? 'uncategorized-income'} category={c} color="var(--success)" />
                        ))}
                    </>}

                    {/* Expense section */}
                    {expenseCategories.length > 0 && <>
                        <SectionHeader icon={<TrendingDown size={14} />} label="Expense" total={fmt(data.expense)} color="var(--danger)" />
                        {expenseCategories.map(c => (
                            <CategoryRow key={c.id ?? 'uncategorized-expense'} category={c} color="var(--danger)" />
                        ))}
                    </>}

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

                    {/* Net + Closing */}
                    <Row label="Net" value={fmt(data.net)} labelWeight={600} valueColor={netColor} />
                    <Row label="Closing Balance" value={fmt(data.closing_balance)} labelWeight={700} valueColor={closingColor} />
                </div>
            )}
        </div>
    );
}
