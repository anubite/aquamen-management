import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Loader2, Mail, Globe, Server, CheckCircle2, Shield, Wand2, CreditCard } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useNotification } from '../context/NotificationContext';

function Settings({ token }) {
    const [settings, setSettings] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { setNotification } = useNotification();
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        fetchSettings();
    }, []);

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
            <div className="flex-between mb-8">
                <h2 className="flex items-center gap-2"><Mail size={24} color="var(--primary)" /> Email Settings</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-10">
                <section>
                    <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><CreditCard size={20} /> Club Info</h3>
                    <div className="form-group" style={{ maxWidth: '400px' }}>
                        <label>Bank Account (for QR payment codes)</label>
                        <input value={settings.club_bank_account || ''} onChange={e => updateSetting('club_bank_account', e.target.value)} placeholder="192000145/0300" />
                        <small style={{ color: 'var(--text-muted)' }}>Format: accountNumber/bankCode</small>
                    </div>
                </section>

                <section>
                    <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Server size={20} /> SMTP Configuration</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>SMTP Host</label>
                            <input value={settings.smtp_host || ''} onChange={e => updateSetting('smtp_host', e.target.value)} placeholder="smtp.example.com" />
                        </div>
                        <div className="form-group flex items-end gap-10">
                            <div>
                                <label>Port</label>
                                <input style={{ width: '80px' }} value={settings.smtp_port || ''} onChange={e => updateSetting('smtp_port', e.target.value)} placeholder="587" />
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="smtp_secure"
                                    checked={settings.smtp_secure === 'true'}
                                    onChange={e => updateSetting('smtp_secure', e.target.checked ? 'true' : 'false')}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="smtp_secure" className="mb-0 cursor-pointer">Use SSL/TLS (required for Port 465)</label>
                            </div>
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
                    <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="form-group">
                            <label>From Name</label>
                            <input value={settings.email_from_name || ''} onChange={e => updateSetting('email_from_name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>From Email</label>
                            <input type="email" value={settings.email_from_address || ''} onChange={e => updateSetting('email_from_address', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Reply-To Address (comma-separated for multiple)</label>
                            <input value={settings.email_reply_to || ''} onChange={e => updateSetting('email_reply_to', e.target.value)} placeholder="admin@club.cz, board@club.cz" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Always CC (Optional, comma separated)</label>
                        <input value={settings.email_cc || ''} onChange={e => updateSetting('email_cc', e.target.value)} />
                    </div>
                </section>

                <section>
                    <div className="flex justify-between items-center border-b pb-2 mb-6">
                        <h3 className="flex items-center gap-2 mb-0"><Shield size={20} /> GDPR Policies</h3>
                        <button
                            type="button"
                            className="btn btn-sm flex items-center gap-2"
                            style={{ background: '#f8fafc' }}
                            onClick={() => {
                                const czPolicy = "<h1>Zásady ochrany osobních údajů (GDPR)</h1><p>V Aquamen bereme ochranu vašich osobních údajů vážně. Shromažďujeme vaše jméno, email, datum narození a adresu výhradně pro účely správy členství a informování o trénincích.</p><p>Vaše údaje nejsou předávány třetím stranám bez vašeho výslovného souhlasu.</p>";
                                const enPolicy = "<h1>Privacy Policy (GDPR)</h1><p>At Aquamen, we take your privacy seriously. We collect your name, email, date of birth, and address solely for membership management and training updates.</p><p>Your data is never shared with third parties without your explicit consent.</p>";
                                updateSetting('gdpr_policy_cz', czPolicy);
                                updateSetting('gdpr_policy_en', enPolicy);
                            }}
                        >
                            <Wand2 size={14} /> AI Generate Defaults
                        </button>
                    </div>
                    <div className="form-grid">
                        <div className="form-group">
                            <label><Globe size={14} /> Czech GDPR Policy</label>
                            <ReactQuill
                                theme="snow"
                                value={settings.gdpr_policy_cz || ''}
                                onChange={val => updateSetting('gdpr_policy_cz', val)}
                                className="bg-white rounded"
                            />
                        </div>
                        <div className="form-group">
                            <label><Globe size={14} /> English GDPR Policy</label>
                            <ReactQuill
                                theme="snow"
                                value={settings.gdpr_policy_en || ''}
                                onChange={val => updateSetting('gdpr_policy_en', val)}
                                className="bg-white rounded"
                            />
                        </div>
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
                    <strong>Welcome email placeholders:</strong> <code>{"{{first_name}}"}</code>, <code>{"{{surname}}"}</code>, <code>{"{{group_id}}"}</code>, <code>{"{{group_trainer}}"}</code>, <code>{"{{gdpr_link}}"}</code>, <code>{"{{id}}"}</code>, <code>{"{{qr_payment_code}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{club_account_nr}}"}</code>
                </div>

                <div className="grid grid-cols-2 gap-10" style={{ marginTop: '2rem' }}>
                    <section>
                        <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Globe size={20} /> Fees Due Template (CZ)</h3>
                        <div className="form-group">
                            <label>Subject (CZ)</label>
                            <input value={settings.fees_template_cz_subject || ''} onChange={e => updateSetting('fees_template_cz_subject', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email Body (CZ)</label>
                            <ReactQuill
                                theme="snow"
                                value={settings.fees_template_cz_body || ''}
                                onChange={val => updateSetting('fees_template_cz_body', val)}
                                className="bg-white rounded"
                            />
                        </div>
                    </section>

                    <section>
                        <h3 className="flex items-center gap-2 border-b pb-2 mb-6"><Globe size={20} /> Fees Due Template (EN)</h3>
                        <div className="form-group">
                            <label>Subject (EN)</label>
                            <input value={settings.fees_template_en_subject || ''} onChange={e => updateSetting('fees_template_en_subject', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email Body (EN)</label>
                            <ReactQuill
                                theme="snow"
                                value={settings.fees_template_en_body || ''}
                                onChange={val => updateSetting('fees_template_en_body', val)}
                                className="bg-white rounded"
                            />
                        </div>
                    </section>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded text-sm text-blue-700">
                    <strong>Fees due reminder placeholders:</strong> <code>{"{{first_name}}"}</code>, <code>{"{{surname}}"}</code>, <code>{"{{id}}"}</code>, <code>{"{{fees_due}}"}</code>, <code>{"{{unpaid_months}}"}</code>, <code>{"{{club_account_nr}}"}</code>, <code>{"{{qr_payment_code}}"}</code>
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
