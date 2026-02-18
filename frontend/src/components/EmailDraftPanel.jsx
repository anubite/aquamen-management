import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Mail, Send, Loader2, Globe, AlertCircle } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

function EmailDraftPanel({ member, isOpen, onClose, token, groups, setNotification }) {
    const [templateLang, setTemplateLang] = useState('cz');
    const [draft, setDraft] = useState({ subject: '', body: '', to: '', cc: '' });
    const [settings, setSettings] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        if (isOpen && member) {
            fetchSettingsAndPrepareDraft();
        }
    }, [isOpen, member]);

    const fetchSettingsAndPrepareDraft = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('/api/settings', authHeader);
            setSettings(res.data);
            prepareDraft(res.data, templateLang);
        } catch (err) {
            console.error('Error preparation draft', err);
        } finally {
            setIsLoading(false);
        }
    };

    const prepareDraft = (settingsData, lang) => {
        if (!settingsData || !member) return;

        const subjectTemplate = settingsData[`template_${lang}_subject`] || '';
        const bodyTemplate = settingsData[`template_${lang}_body`] || '';

        const group = groups.find(g => String(g.id) === String(member.group_id)) || {};

        const placeholders = {
            first_name: member.name || '',
            surname: member.surname || '',
            group_id: member.group_id || 'N/A',
            group_trainer: group.trainer || 'N/A'
        };

        let subject = subjectTemplate;
        let body = bodyTemplate;

        Object.entries(placeholders).forEach(([key, val]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, val);
            body = body.replace(regex, val);
        });

        setDraft({
            subject,
            body,
            to: member.email,
            cc: settingsData.email_cc || ''
        });
    };

    const handleLangSwitch = (lang) => {
        setTemplateLang(lang);
        if (settings) {
            prepareDraft(settings, lang);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        setIsSending(true);
        try {
            await axios.post(`/api/members/${member.id}/send-welcome`, draft, authHeader);
            if (setNotification) {
                setNotification({ message: 'Welcome email sent successfully!', type: 'success' });
            }
            onClose();
        } catch (err) {
            if (setNotification) {
                setNotification({ message: 'Failed to send email: ' + (err.response?.data?.error || err.message), type: 'error' });
            }
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="side-panel-overlay" onClick={onClose}>
            <div className="side-panel glass" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                <div className="side-panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail color="var(--primary)" />
                        <h2>Welcome Email Draft</h2>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X /></button>
                </div>

                <div className="side-panel-content">
                    {isLoading ? (
                        <div className="text-center p-10"><Loader2 className="animate-spin inline-block" /> Preparing draft...</div>
                    ) : (
                        <form onSubmit={handleSend} className="space-y-4">
                            <div className="flex-between p-2 bg-slate-50 rounded border mb-4">
                                <span className="text-sm font-semibold">Template Language:</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${templateLang === 'cz' ? 'btn-primary' : ''}`}
                                        onClick={() => handleLangSwitch('cz')}
                                    >
                                        Czech
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${templateLang === 'en' ? 'btn-primary' : ''}`}
                                        onClick={() => handleLangSwitch('en')}
                                    >
                                        English
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>To</label>
                                <input value={draft.to || ''} readOnly className="bg-slate-50" />
                            </div>

                            <div className="form-group">
                                <label>CC</label>
                                <input value={draft.cc || ''} onChange={e => setDraft({ ...draft, cc: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label>Subject</label>
                                <input value={draft.subject || ''} onChange={e => setDraft({ ...draft, subject: e.target.value })} required />
                            </div>

                            <div className="form-group">
                                <label>Message Body</label>
                                <ReactQuill
                                    theme="snow"
                                    value={draft.body || ''}
                                    onChange={val => setDraft({ ...draft, body: val })}
                                    className="bg-white rounded"
                                    style={{ height: '300px', marginBottom: '3rem' }}
                                />
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-100 rounded text-xs flex gap-2">
                                <AlertCircle size={14} className="flex-shrink-0" />
                                <span>Tweaking the body here will only affect this specific email. Fixed template changes must be done in Settings.</span>
                            </div>

                            <div className="side-panel-footer">
                                <button type="submit" className="btn btn-primary w-full" disabled={isSending}>
                                    {isSending ? <><Loader2 className="animate-spin" /> Sending...</> : <><Send size={18} /> Send Welcome Email</>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default EmailDraftPanel;
