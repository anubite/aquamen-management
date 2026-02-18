import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Loader2, Mail, Globe, Server, CheckCircle2 } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

function Settings({ token }) {
    const [settings, setSettings] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings', authHeader);
            setSettings(res.data);
        } catch (err) {
            console.error('Error fetching settings', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setNotification(null);
        try {
            await axios.put('/api/settings', settings, authHeader);
            setNotification({ message: 'Settings saved successfully!', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Save failed: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (isLoading) return <div className="text-center p-10"><Loader2 className="animate-spin inline-block" /> Loading...</div>;

    return (
        <div className="glass p-8" style={{ maxWidth: '1000px', margin: '0 auto' }}>
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
            <div className="flex-between mb-8">
                <h2 className="flex items-center gap-2"><Mail size={24} color="var(--primary)" /> Email Settings</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-10">
                <section>
                    <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Server size={20} /> SMTP Configuration</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>SMTP Host</label>
                            <input value={settings.smtp_host || ''} onChange={e => updateSetting('smtp_host', e.target.value)} placeholder="smtp.example.com" />
                        </div>
                        <div className="form-group">
                            <label>Port</label>
                            <input value={settings.smtp_port || ''} onChange={e => updateSetting('smtp_port', e.target.value)} placeholder="587" />
                        </div>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>SMTP User</label>
                            <input value={settings.smtp_user || ''} onChange={e => updateSetting('smtp_user', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>SMTP Password</label>
                            <input type="password" value={settings.smtp_pass || ''} onChange={e => updateSetting('smtp_pass', e.target.value)} />
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Mail size={20} /> Sender Info</h3>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="form-group">
                            <label>From Name</label>
                            <input value={settings.email_from_name || ''} onChange={e => updateSetting('email_from_name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>From Email</label>
                            <input type="email" value={settings.email_from_address || ''} onChange={e => updateSetting('email_from_address', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Reply-To Address</label>
                            <input type="email" value={settings.email_reply_to || ''} onChange={e => updateSetting('email_reply_to', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Always CC (Optional, comma separated)</label>
                        <input value={settings.email_cc || ''} onChange={e => updateSetting('email_cc', e.target.value)} />
                    </div>
                </section>

                <div className="grid grid-cols-2 gap-10">
                    <section>
                        <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Globe size={20} /> Czech Template</h3>
                        <div className="form-group">
                            <label>Subject (CZ)</label>
                            <input value={settings.template_cz_subject || ''} onChange={e => updateSetting('template_cz_subject', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email Body (CZ)</label>
                            <ReactQuill
                                theme="snow"
                                value={settings.template_cz_body || ''}
                                onChange={val => updateSetting('template_cz_body', val)}
                                className="bg-white rounded"
                            />
                        </div>
                    </section>

                    <section>
                        <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Globe size={20} /> English Template</h3>
                        <div className="form-group">
                            <label>Subject (EN)</label>
                            <input value={settings.template_en_subject || ''} onChange={e => updateSetting('template_en_subject', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email Body (EN)</label>
                            <ReactQuill
                                theme="snow"
                                value={settings.template_en_body || ''}
                                onChange={val => updateSetting('template_en_body', val)}
                                className="bg-white rounded"
                            />
                        </div>
                    </section>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded text-sm text-blue-700">
                    <strong>Placeholders:</strong> You can use the following placeholders in subjects and bodies:
                    <code>{"{{first_name}}"}</code>, <code>{"{{surname}}"}</code>, <code>{"{{group_id}}"}</code>, <code>{"{{group_trainer}}"}</code>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save All Settings
                    </button>
                </div>
            </form>
        </div>
    );
}

export default Settings;
