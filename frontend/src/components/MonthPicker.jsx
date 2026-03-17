import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLabel(value, availableMonths) {
    if (value.size === 0) return null; // use placeholder
    if (availableMonths.length > 0 && value.size === availableMonths.length) return 'All months';

    const sorted = [...value].sort();

    if (value.size === 1) {
        const [y, m] = sorted[0].split('-');
        return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
    }

    const years = [...new Set(sorted.map(s => s.slice(0, 4)))];
    if (years.length === 1) {
        const y = years[0];
        const names = sorted.map(ym => MONTH_NAMES[parseInt(ym.slice(5)) - 1]);
        if (value.size <= 3) return `${names.join(', ')} ${y}`;
        return `${value.size} months in ${y}`;
    }
    return `${value.size} months`;
}

export default function MonthPicker({ availableMonths = [], value, onChange, placeholder = 'All time' }) {
    const [open, setOpen] = useState(false);
    const [expandedYears, setExpandedYears] = useState(new Set());
    const ref = useRef(null);

    // Group available months by year (newest year first) — memoized since availableMonths rarely changes
    const { years, byYear } = useMemo(() => {
        const byYear = availableMonths.reduce((acc, ym) => {
            const y = ym.slice(0, 4);
            if (!acc[y]) acc[y] = new Set();
            acc[y].add(ym);
            return acc;
        }, {});
        const years = Object.keys(byYear).sort().reverse();
        return { years, byYear };
    }, [availableMonths]);

    // Auto-expand years containing selected months — fires once when value first becomes non-empty
    // (handles async load where parent populates value after mount)
    const initialExpandDone = useRef(false);
    useEffect(() => {
        if (!initialExpandDone.current && value.size > 0) {
            initialExpandDone.current = true;
            setExpandedYears(new Set([...value].map(ym => ym.slice(0, 4))));
        }
    }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleExpand = (year) => {
        const next = new Set(expandedYears);
        next.has(year) ? next.delete(year) : next.add(year);
        setExpandedYears(next);
    };

    const toggleYearAll = (year, e) => {
        e.stopPropagation();
        const yearMonths = byYear[year] || new Set();
        const allSelected = [...yearMonths].every(ym => value.has(ym));
        const next = new Set(value);
        if (allSelected) {
            yearMonths.forEach(ym => next.delete(ym));
        } else {
            yearMonths.forEach(ym => next.add(ym));
        }
        onChange(next);
    };

    const toggleMonth = (ym) => {
        const next = new Set(value);
        next.has(ym) ? next.delete(ym) : next.add(ym);
        onChange(next);
    };

    const selectAll = () => onChange(new Set(availableMonths));
    const clearAll  = () => onChange(new Set());

    const label = formatLabel(value, availableMonths);
    const hasSelection = value.size > 0;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                className="btn"
                onClick={() => setOpen(v => !v)}
                style={{
                    background: hasSelection ? 'var(--primary)' : '#f1f5f9',
                    color: hasSelection ? 'white' : 'var(--text)',
                    whiteSpace: 'nowrap',
                    gap: '0.4rem',
                }}
            >
                <Calendar size={15} />
                {label ?? placeholder}
                {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {open && (
                <div
                    className="glass"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        zIndex: 200,
                        minWidth: '270px',
                        maxHeight: '380px',
                        overflowY: 'auto',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow)',
                        border: '1px solid var(--border)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--background)',
                        position: 'sticky', top: 0, zIndex: 1,
                    }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, flex: 1 }}>
                            {value.size > 0 ? `${value.size} month${value.size !== 1 ? 's' : ''} selected` : 'No selection'}
                        </span>
                        <button type="button" onClick={selectAll} className="btn"
                            style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                            All
                        </button>
                        <button type="button" onClick={clearAll} className="btn"
                            style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}>
                            Clear
                        </button>
                    </div>

                    {/* Years */}
                    {years.map(year => {
                        const yearMonths = byYear[year] || new Set();
                        const selectedCount = [...yearMonths].filter(ym => value.has(ym)).length;
                        const allSelected  = selectedCount === yearMonths.size && yearMonths.size > 0;
                        const someSelected = selectedCount > 0 && !allSelected;
                        const isExpanded   = expandedYears.has(year);

                        return (
                            <div key={year} style={{ borderBottom: '1px solid var(--border)' }}>
                                {/* Year row */}
                                <div
                                    onClick={() => toggleExpand(year)}
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        padding: '0.45rem 0.75rem',
                                        cursor: 'pointer',
                                        background: 'var(--background)',
                                        userSelect: 'none',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={el => { if (el) el.indeterminate = someSelected; }}
                                        onChange={(e) => toggleYearAll(year, e)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ width: 'auto', margin: '0 0.5rem 0 0', cursor: 'pointer', flexShrink: 0 }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{year}</span>
                                    {selectedCount > 0 && (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.5rem', fontWeight: 500 }}>
                                            {selectedCount}/{yearMonths.size}
                                        </span>
                                    )}
                                    {isExpanded
                                        ? <ChevronUp size={14} color="var(--text-muted)" />
                                        : <ChevronRight size={14} color="var(--text-muted)" />}
                                </div>

                                {/* Month grid */}
                                {isExpanded && (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: '5px',
                                        padding: '0.6rem 0.75rem',
                                        background: 'var(--surface)',
                                    }}>
                                        {MONTH_NAMES.map((name, i) => {
                                            const mm = String(i + 1).padStart(2, '0');
                                            const ym = `${year}-${mm}`;
                                            const available = yearMonths.has(ym);
                                            const selected  = value.has(ym);
                                            return (
                                                <button
                                                    key={mm}
                                                    type="button"
                                                    disabled={!available}
                                                    onClick={() => toggleMonth(ym)}
                                                    style={{
                                                        padding: '0.3rem 0',
                                                        borderRadius: '6px',
                                                        border: `1px solid ${selected ? 'var(--primary)' : available ? 'var(--border)' : 'transparent'}`,
                                                        background: selected ? 'var(--primary)' : available ? 'var(--surface)' : 'transparent',
                                                        color: selected ? 'white' : available ? 'var(--text)' : 'var(--text-muted)',
                                                        fontSize: '0.78rem',
                                                        fontWeight: selected ? 600 : 400,
                                                        cursor: available ? 'pointer' : 'default',
                                                        opacity: available ? 1 : 0.3,
                                                        transition: 'all 0.1s',
                                                    }}
                                                >
                                                    {name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {years.length === 0 && (
                        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            No transaction months found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
