import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users } from 'lucide-react';

export default function MembersSummary({ token }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        axios
            .get('/api/members/summary', { headers: { Authorization: `Bearer ${token}` } })
            .then(res  => { setData(res.data); setLoading(false); })
            .catch(err => { setError(err.response?.data?.error || err.message || 'Failed to load summary'); setLoading(false); });
    }, [token]);

    if (loading) {
        return (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[0, 1].map(i => (
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

    const total = data.total_active + data.total_canceled;

    return (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
            {/* Total card */}
            <div className="summary-card glass" style={{ flex: '0 0 auto', minWidth: '160px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Members
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--success)' }}>{data.total_active}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>/ {total}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    active
                </div>
            </div>

            {/* By-group card */}
            {data.by_group.length > 0 && (
                <div className="summary-card glass" style={{ flex: '1 1 auto', minWidth: '220px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        By Group
                    </div>
                    {data.by_group.map(g => (
                        <div
                            key={g.group_id ?? '__none__'}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}
                        >
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                {g.group_id ? `Group ${g.group_id}` : 'No group'}
                                {g.trainer && (
                                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.35rem', fontSize: '0.78rem' }}>
                                        {g.trainer}
                                    </span>
                                )}
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)', marginLeft: '1rem' }}>
                                {g.active}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
