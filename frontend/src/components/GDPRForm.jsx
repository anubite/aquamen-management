import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Check, Shield, Globe, Info, AlertCircle, Save } from 'lucide-react';
import DOMPurify from 'dompurify';

const GDPRForm = () => {
    const { token } = useParams();
    const [member, setMember] = useState(null);
    const [policies, setPolicies] = useState({ cz: '', en: '' });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [lang, setLang] = useState('English');

    const [formData, setFormData] = useState({
        phone: '',
        street: '',
        street_number: '',
        city: '',
        zip_code: '',
        date_of_birth: '',
        language: 'English'
    });

    useEffect(() => {
        fetchMemberData();
    }, [token]);

    const formatToDateInput = (val) => {
        if (!val) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        const parts = val.split('.');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
        return '';
    };

    const fetchMemberData = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/public/gdpr/${token}`);
            const m = res.data.member;
            setMember(m);
            setPolicies(res.data.policies);
            setLang(m.language || 'English');
            setFormData({
                phone: m.phone || '',
                street: m.street || '',
                street_number: m.street_number || '',
                city: m.city || '',
                zip_code: m.zip_code || '',
                date_of_birth: formatToDateInput(m.date_of_birth),
                language: m.language || 'English'
            });
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load member data. The link might be expired.');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        // Validations
        const zipRegex = /^\d{3}\s?\d{2}$|^\d{5}$/; // Czech format (123 45 or 12345) or simple 5 digit
        if (formData.zip_code && !zipRegex.test(formData.zip_code.trim())) {
            setError(lang === 'Czech' ? 'Neplatné PSČ. Použijte formát 123 45 nebo 12345.' : 'Invalid Zip Code. Use format 123 45 or 12345.');
            setSubmitting(false);
            return;
        }

        if (formData.date_of_birth) {
            const selectedDate = new Date(formData.date_of_birth);
            const today = new Date();
            if (selectedDate > today) {
                setError(lang === 'Czech' ? 'Datum narození nemůže být v budoucnosti.' : 'Date of Birth cannot be in the future.');
                setSubmitting(false);
                return;
            }
        }

        if (!formData.gdpr_consent) {
            setError(lang === 'Czech' ? 'Musíte souhlasit se zásadami GDPR.' : 'You must consent to the GDPR policy.');
            setSubmitting(false);
            return;
        }

        try {
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/public/gdpr/${token}`, formData);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit the form.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-white">Loading...</div>;

    if (error && !member) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950 px-4">
                <div className="glass p-8 max-w-md w-full text-center">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">{lang === 'Czech' ? 'Neplatný odkaz' : 'Invalid Link'}</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950 px-4">
                <div className="glass p-8 max-w-md w-full text-center">
                    <Check size={48} className="text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">{lang === 'Czech' ? 'Děkujeme!' : 'Thank You!'}</h2>
                    <p className="text-slate-400 mb-6">
                        {lang === 'Czech'
                            ? 'Vaše doplňující údaje a souhlas s GDPR byly úspěšně uloženy.'
                            : 'Your additional details and GDPR consent have been successfully saved.'}
                    </p>
                </div>
            </div>
        );
    }

    const t = {
        title: lang === 'Czech' ? 'GDPR Souhlas a Údaje Člena' : 'GDPR Consent & Member Details',
        welcome: lang === 'Czech' ? `Vítej, ${member.name}!` : `Welcome, ${member.name}!`,
        subtitle: lang === 'Czech' ? 'Prosíme o doplnění vašich údajů pro dokončení registrace.' : 'Please complete your details to finish your registration.',
        personalInfo: lang === 'Czech' ? 'Osobní Údaje' : 'Personal Information',
        phone: lang === 'Czech' ? 'Telefon' : 'Phone Number',
        street: lang === 'Czech' ? 'Ulice' : 'Street',
        streetNumber: lang === 'Czech' ? 'Číslo popisné' : 'Street Number',
        city: lang === 'Czech' ? 'Město' : 'City',
        zip: lang === 'Czech' ? 'PSČ' : 'Zip Code',
        dob: lang === 'Czech' ? 'Datum narození' : 'Date of Birth',
        language: lang === 'Czech' ? 'Preferovaný jazyk' : 'Preferred Language',
        gdprTitle: lang === 'Czech' ? 'Zásady GDPR' : 'GDPR Policy',
        gdprCheck: lang === 'Czech' ? 'Souhlasím se zpracováním osobních údajů' : 'I consent to the processing of my personal data',
        submit: lang === 'Czech' ? 'Odeslat Údaje' : 'Submit Details'
    };

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12 mb-32">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                        <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem', letterSpacing: '-0.05em', lineHeight: '1.2' }}>Aquamen</div>
                        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight" style={{ margin: 0 }}>{t.title}</h1>
                    </div>
                    <button
                        onClick={() => setLang(lang === 'English' ? 'Czech' : 'English')}
                        className="glass flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 border border-white/5"
                        style={{ padding: '0.5rem 1.25rem', height: 'fit-content' }}
                    >
                        <Globe size={16} style={{ color: 'var(--primary)' }} />
                        <span className="font-medium text-sm text-slate-200">{lang === 'English' ? 'Czech' : 'English'}</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form Section */}
                    <div className="glass p-8">
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold text-white mb-2">{t.welcome}</h2>
                            <p className="text-slate-400">{t.subtitle}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group col-span-2">
                                    <label>{t.phone}</label>
                                    <input
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+420..."
                                    />
                                </div>
                                <div className="form-group col-span-2 md:col-span-1">
                                    <label>{t.street}</label>
                                    <input
                                        required
                                        value={formData.street}
                                        onChange={e => setFormData({ ...formData, street: e.target.value })}
                                        placeholder="Main St"
                                    />
                                </div>
                                <div className="form-group col-span-2 md:col-span-1">
                                    <label>{t.streetNumber}</label>
                                    <input
                                        required
                                        value={formData.street_number}
                                        onChange={e => setFormData({ ...formData, street_number: e.target.value })}
                                        placeholder="123"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group col-span-2 md:col-span-1">
                                    <label>{t.city}</label>
                                    <input
                                        required
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="Prague"
                                    />
                                </div>
                                <div className="form-group col-span-2 md:col-span-1">
                                    <label>{t.zip}</label>
                                    <input
                                        required
                                        value={formData.zip_code}
                                        onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                                        placeholder="120 00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group col-span-2 md:col-span-1">
                                    <label>{t.dob}</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date_of_birth}
                                        onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                                    />
                                </div>
                                <div className="form-group col-span-2 md:col-span-1">
                                    <label>{t.language}</label>
                                    <select
                                        value={formData.language}
                                        onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="English">English</option>
                                        <option value="Czech">Czech</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4">
                                <label className="flex items-center gap-8 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', flexShrink: 0, marginRight: '0.5rem' }}
                                        checked={formData.gdpr_consent || false}
                                        onChange={e => setFormData({ ...formData, gdpr_consent: e.target.checked })}
                                    />
                                    <span className="text-slate-300 select-none font-bold">{t.gdprCheck}</span>
                                </label>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-3 text-red-500">
                                    <AlertCircle size={20} />
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full btn btn-primary flex items-center justify-center gap-2 py-4 text-lg font-semibold"
                            >
                                {submitting ? '...' : <Save size={20} />}
                                {t.submit}
                            </button>
                        </form>
                    </div>

                    {/* Policy Section */}
                    <div className="space-y-6">
                        <div className="glass p-8 h-full overflow-y-auto max-h-[600px] prose prose-invert">
                            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                <Info className="text-primary" size={20} />
                                {t.gdprTitle}
                            </h2>
                            <div
                                className="text-slate-400 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lang === 'Czech' ? policies.cz : policies.en) }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GDPRForm;
