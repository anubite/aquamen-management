import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Phone, MapPin, Hash, Mail, User } from 'lucide-react';
import axios from 'axios';

function MemberSidePanel({ member, isOpen, onClose, onSave, groups }) {
    const [form, setForm] = useState(member || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setForm(member || {});
    }, [member]);

    if (!isOpen) return null;

    const formatToDateInput = (val) => {
        if (!val) return '';
        // If already YYYY-MM-DD, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

        // Handle D.M.YYYY (common in their database)
        const parts = val.split('.');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
        return '';
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const today = new Date().toISOString().split('T')[0];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.date_of_birth) {
            const dob = new Date(form.date_of_birth);
            const now = new Date();
            if (dob > now) {
                alert('Date of Birth cannot be in the future.');
                return;
            }
        }

        setIsSaving(true);
        try {
            await onSave(form);
            onClose();
        } catch (err) {
            console.error('Error saving member', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="side-panel-overlay" onClick={onClose}>
            <div className="side-panel glass" onClick={e => e.stopPropagation()}>
                <div className="side-panel-header">
                    <h2>{member?.id ? 'Edit Member' : 'New Member'}</h2>
                    <button className="btn-icon" onClick={onClose}><X /></button>
                </div>

                <form onSubmit={handleSubmit} className="side-panel-content">
                    <section>
                        <h3><User size={18} /> Basic Info</h3>
                        <div className="form-group" style={{ opacity: 0.7 }}>
                            <label>Member ID (Auto-generated)</label>
                            <input readOnly name="id" value={form.id || ''} style={{ background: '#f1f5f9', cursor: 'default' }} />
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>First Name</label>
                                <input required name="name" value={form.name || ''} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>Surname</label>
                                <input required name="surname" value={form.surname || ''} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label><Mail size={14} /> Email</label>
                            <input required type="email" name="email" value={form.email || ''} onChange={handleChange} />
                        </div>
                    </section>

                    <section>
                        <h3><Hash size={18} /> Membership</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Group</label>
                                <select name="group_id" value={form.group_id || ''} onChange={handleChange}>
                                    <option value="">Select Group</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.id}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select name="status" value={form.status || 'Active'} onChange={handleChange}>
                                    <option value="Active">Active</option>
                                    <option value="Canceled">Canceled</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3><User size={18} /> Personal Info</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label><Phone size={14} /> Phone</label>
                                <input name="phone" placeholder="+420..." value={form.phone || ''} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label><Calendar size={14} /> Date of Birth</label>
                                <input type="date" name="date_of_birth" max={today} value={formatToDateInput(form.date_of_birth)} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-grid" style={{ gridTemplateColumns: '3fr 1fr', marginTop: '1rem' }}>
                            <div className="form-group">
                                <label><MapPin size={14} /> Street</label>
                                <input name="street" value={form.street || ''} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>No.</label>
                                <input name="street_number" value={form.street_number || ''} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Zip Code</label>
                                <input name="zip_code" placeholder="123 45" value={form.zip_code || ''} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>City</label>
                                <input name="city" value={form.city || ''} onChange={handleChange} />
                            </div>
                        </div>
                    </section>

                    <div className="side-panel-footer">
                        <button type="submit" className="btn btn-primary w-full" disabled={isSaving}>
                            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Member'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default MemberSidePanel;
