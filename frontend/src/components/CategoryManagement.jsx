import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

const API_URL = '/api';

const FIELD_OPTIONS = [
    { value: 'transaction_type',      label: 'Transaction Type' },
    { value: 'counterparty_name',     label: 'Counterparty Name' },
    { value: 'variable_symbol',       label: 'Variable Symbol' },
    { value: 'counterparty_account',  label: 'Account Number' },
    { value: 'message_for_recipient', label: 'Message for Recipient' },
    { value: 'message_for_me',        label: 'Message for Me' },
    { value: 'amount',                label: 'Amount (CZK)' },
];

const STRING_OPERATOR_OPTIONS = [
    { value: 'contains',    label: 'contains' },
    { value: 'equals',      label: 'equals' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'regex',       label: 'regex' },
];

const NUMERIC_OPERATOR_OPTIONS = [
    { value: 'gt',     label: '>' },
    { value: 'gte',    label: '>=' },
    { value: 'lt',     label: '<' },
    { value: 'lte',    label: '<=' },
    { value: 'equals', label: '=' },
];

const getOperatorOptions = (field) =>
    field === 'amount' ? NUMERIC_OPERATOR_OPTIONS : STRING_OPERATOR_OPTIONS;

function CategoryManagement({ token }) {
    const [categories, setCategories] = useState([]);
    const [rules, setRules] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    // Category add/edit state
    const [isAdding, setIsAdding] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#0077be', is_membership_fee: false });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [confirmDeleteCatId, setConfirmDeleteCatId] = useState(null);

    // Rule add/edit state
    const [addingRuleForCat, setAddingRuleForCat] = useState(null);
    const [newRule, setNewRule] = useState({ field: 'counterparty_name', operator: 'contains', value: '', priority: 0 });
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [editRuleForm, setEditRuleForm] = useState({});
    const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState(null);

    const { setNotification } = useNotification();
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => { fetchCategories(); fetchRules(); }, [token]);

    const fetchCategories = async () => {
        try {
            const res = await axios.get(`${API_URL}/transaction-categories`, authHeader);
            setCategories(res.data);
        } catch (err) { console.error('Error fetching categories', err); }
    };

    const fetchRules = async () => {
        try {
            const res = await axios.get(`${API_URL}/transaction-category-rules`, authHeader);
            setRules(res.data);
        } catch (err) { console.error('Error fetching rules', err); }
    };

    // ---- Category CRUD ----

    const addCategory = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/transaction-categories`, newCategory, authHeader);
            setIsAdding(false);
            setNewCategory({ name: '', description: '', color: '#0077be', is_membership_fee: false });
            fetchCategories();
            setNotification({ message: 'Category added', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const startEditCat = (cat) => {
        setEditingId(cat.id);
        setEditForm({ name: cat.name, description: cat.description || '', color: cat.color, is_membership_fee: Boolean(cat.is_membership_fee) });
        setConfirmDeleteCatId(null);
        setIsAdding(false);
    };

    const saveEditCat = async () => {
        try {
            await axios.put(`${API_URL}/transaction-categories/${editingId}`, editForm, authHeader);
            setEditingId(null);
            fetchCategories();
            setNotification({ message: 'Category updated', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const deleteCategory = async (id) => {
        if (confirmDeleteCatId !== id) { setConfirmDeleteCatId(id); return; }
        try {
            await axios.delete(`${API_URL}/transaction-categories/${id}`, authHeader);
            setConfirmDeleteCatId(null);
            if (expandedId === id) setExpandedId(null);
            fetchCategories();
            fetchRules();
            setNotification({ message: 'Category deleted', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
            setConfirmDeleteCatId(null);
        }
    };

    // ---- Rule CRUD ----

    const addRule = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/transaction-category-rules`, { ...newRule, category_id: addingRuleForCat }, authHeader);
            setAddingRuleForCat(null);
            setNewRule({ field: 'counterparty_name', operator: 'contains', value: '', priority: 0 });
            fetchRules();
            setNotification({ message: 'Rule added', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const startEditRule = (rule) => {
        setEditingRuleId(rule.id);
        setEditRuleForm({ field: rule.field, operator: rule.operator, value: rule.value, priority: rule.priority });
        setConfirmDeleteRuleId(null);
    };

    const saveEditRule = async (ruleId) => {
        try {
            await axios.put(`${API_URL}/transaction-category-rules/${ruleId}`, {
                ...editRuleForm,
                category_id: rules.find(r => r.id === ruleId)?.category_id
            }, authHeader);
            setEditingRuleId(null);
            fetchRules();
            setNotification({ message: 'Rule updated', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
        }
    };

    const deleteRule = async (id) => {
        if (confirmDeleteRuleId !== id) { setConfirmDeleteRuleId(id); return; }
        try {
            await axios.delete(`${API_URL}/transaction-category-rules/${id}`, authHeader);
            setConfirmDeleteRuleId(null);
            fetchRules();
            setNotification({ message: 'Rule deleted', type: 'success' });
        } catch (err) {
            setNotification({ message: 'Error: ' + (err.response?.data?.error || err.message), type: 'error' });
            setConfirmDeleteRuleId(null);
        }
    };

    const catRules = (catId) => rules.filter(r => r.category_id === catId);

    return (
        <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Transaction Categories</h2>
                <button type="button" className="btn btn-primary" onClick={() => { setIsAdding(true); setEditingId(null); setConfirmDeleteCatId(null); }}>
                    <Plus size={18} /> New Category
                </button>
            </div>

            {isAdding && (
                <div className="glass" style={{ marginBottom: '1.5rem', padding: '1.5rem', borderRadius: 'var(--radius)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Add New Category</h3>
                    <form onSubmit={addCategory}>
                        <div className="category-add-grid">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Name *</label>
                                <input required value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} placeholder="e.g. Membership" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Description</label>
                                <input value={newCategory.description} onChange={e => setNewCategory({ ...newCategory, description: e.target.value })} placeholder="Optional description" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Color</label>
                                <input type="color" value={newCategory.color} onChange={e => setNewCategory({ ...newCategory, color: e.target.value })}
                                    style={{ width: '50px', height: '38px', padding: '2px', cursor: 'pointer' }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Membership Fee</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: 0, height: '38px' }}>
                                    <input type="checkbox" style={{ width: 'auto', margin: 0 }}
                                        checked={newCategory.is_membership_fee}
                                        onChange={e => setNewCategory({ ...newCategory, is_membership_fee: e.target.checked })} />
                                    <span style={{ fontSize: '0.875rem' }}>Mark as membership fee</span>
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '2px' }}>
                                <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>Save</button>
                                <button type="button" className="btn" onClick={() => setIsAdding(false)} style={{ background: '#e2e8f0', padding: '0.625rem 1rem' }}>Cancel</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '30px' }}></th>
                            <th>Category</th>
                            <th>Description</th>
                            <th>Fee</th>
                            <th>Rules</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map(cat => (
                            <React.Fragment key={cat.id}>
                                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}>
                                    <td>
                                        {expandedId === cat.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </td>
                                    <td data-label="Category">
                                        {editingId === cat.id ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                                <input type="color" value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                                                    style={{ width: '36px', height: '30px', padding: '1px', cursor: 'pointer' }} />
                                                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus style={{ flex: 1 }} />
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span className="color-swatch" style={{ background: cat.color }}></span>
                                                <span style={{ fontWeight: '600' }}>{cat.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td data-label="Description">
                                        {editingId === cat.id ? (
                                            <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                onClick={e => e.stopPropagation()} />
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>{cat.description || '-'}</span>
                                        )}
                                    </td>
                                    <td data-label="Fee" onClick={e => e.stopPropagation()}>
                                        {editingId === cat.id ? (
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                                                <input type="checkbox" style={{ width: 'auto', margin: 0 }}
                                                    checked={editForm.is_membership_fee}
                                                    onChange={e => setEditForm({ ...editForm, is_membership_fee: e.target.checked })} />
                                                <span style={{ fontSize: '0.8rem' }}>Membership fee</span>
                                            </label>
                                        ) : cat.is_membership_fee ? (
                                            <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.75rem' }}>Membership Fee</span>
                                        ) : null}
                                    </td>
                                    <td data-label="Rules">
                                        <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text)' }}>
                                            <Filter size={12} style={{ marginRight: '4px' }} />
                                            {catRules(cat.id).length} rule{catRules(cat.id).length !== 1 ? 's' : ''}
                                        </span>
                                    </td>
                                    <td data-label="Actions" style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                        {editingId === cat.id ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button type="button" className="btn btn-primary" onClick={saveEditCat} style={{ padding: '0.25rem 0.5rem' }}><Check size={16} /></button>
                                                <button type="button" className="btn" onClick={() => setEditingId(null)} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0' }}><X size={16} /></button>
                                            </div>
                                        ) : confirmDeleteCatId === cat.id ? (
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 'bold' }}>Confirm?</span>
                                                <button type="button" className="btn" onClick={() => deleteCategory(cat.id)} style={{ padding: '0.25rem 0.6rem', background: 'var(--danger)', color: 'white' }}>Yes</button>
                                                <button type="button" className="btn" onClick={() => setConfirmDeleteCatId(null)} style={{ padding: '0.25rem 0.6rem', background: '#e2e8f0' }}>No</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button type="button" className="btn" onClick={() => startEditCat(cat)} style={{ padding: '0.25rem 0.5rem', background: '#f1f5f9' }}><Edit2 size={16} /></button>
                                                <button type="button" className="btn" onClick={() => deleteCategory(cat.id)} style={{ padding: '0.25rem 0.5rem', background: '#fee2e2', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>

                                {expandedId === cat.id && (
                                    <tr>
                                        <td colSpan="6" style={{ padding: 0 }}>
                                            <div className="expandable-row-content">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <h4 style={{ margin: 0, color: 'var(--text-muted)' }}>
                                                        <Filter size={14} style={{ marginRight: '6px' }} />
                                                        Matching Rules for "{cat.name}"
                                                    </h4>
                                                    <button type="button" className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                                        onClick={() => { setAddingRuleForCat(cat.id); setNewRule({ field: 'counterparty_name', operator: 'contains', value: '', priority: 0 }); }}>
                                                        <Plus size={14} /> Add Rule
                                                    </button>
                                                </div>

                                                {addingRuleForCat === cat.id && (
                                                    <form onSubmit={addRule} style={{ marginBottom: '1rem', padding: '1rem', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                                        <div className="rule-add-grid">
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label>Field</label>
                                                                <select value={newRule.field} onChange={e => {
                                                                    const f = e.target.value;
                                                                    setNewRule({ ...newRule, field: f, operator: f === 'amount' ? 'lt' : 'contains', value: '' });
                                                                }}>
                                                                    {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label>Operator</label>
                                                                <select value={newRule.operator} onChange={e => setNewRule({ ...newRule, operator: e.target.value })}>
                                                                    {getOperatorOptions(newRule.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label>Value</label>
                                                                {newRule.field === 'amount'
                                                                    ? <input required type="number" step="0.01" value={newRule.value} onChange={e => setNewRule({ ...newRule, value: e.target.value })} placeholder="e.g. -5" />
                                                                    : <input required value={newRule.value} onChange={e => setNewRule({ ...newRule, value: e.target.value })} placeholder="Match value" />
                                                                }
                                                            </div>
                                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                                <label>Priority</label>
                                                                <input type="number" value={newRule.priority} onChange={e => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '2px' }}>
                                                                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>Save</button>
                                                                <button type="button" className="btn" onClick={() => setAddingRuleForCat(null)} style={{ background: '#e2e8f0', padding: '0.5rem 0.75rem' }}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    </form>
                                                )}

                                                {catRules(cat.id).length === 0 && addingRuleForCat !== cat.id && (
                                                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                                                        No rules yet. Add a rule to enable auto-categorization.
                                                    </div>
                                                )}

                                                {catRules(cat.id).length > 0 && (
                                                    <table style={{ fontSize: '0.875rem' }}>
                                                        <thead>
                                                            <tr>
                                                                <th>Field</th>
                                                                <th>Operator</th>
                                                                <th>Value</th>
                                                                <th>Priority</th>
                                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {catRules(cat.id).map(rule => (
                                                                <tr key={rule.id}>
                                                                    <td>
                                                                        {editingRuleId === rule.id ? (
                                                                            <select value={editRuleForm.field} onChange={e => {
                                                                                const f = e.target.value;
                                                                                setEditRuleForm({ ...editRuleForm, field: f, operator: f === 'amount' ? 'lt' : 'contains', value: '' });
                                                                            }}>
                                                                                {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                                                            </select>
                                                                        ) : (
                                                                            FIELD_OPTIONS.find(f => f.value === rule.field)?.label || rule.field
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {editingRuleId === rule.id ? (
                                                                            <select value={editRuleForm.operator} onChange={e => setEditRuleForm({ ...editRuleForm, operator: e.target.value })}>
                                                                                {getOperatorOptions(editRuleForm.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                                            </select>
                                                                        ) : (
                                                                            [...STRING_OPERATOR_OPTIONS, ...NUMERIC_OPERATOR_OPTIONS].find(o => o.value === rule.operator)?.label || rule.operator
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {editingRuleId === rule.id ? (
                                                                            editRuleForm.field === 'amount'
                                                                                ? <input type="number" step="0.01" value={editRuleForm.value} onChange={e => setEditRuleForm({ ...editRuleForm, value: e.target.value })} />
                                                                                : <input value={editRuleForm.value} onChange={e => setEditRuleForm({ ...editRuleForm, value: e.target.value })} />
                                                                        ) : (
                                                                            <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{rule.value}</code>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {editingRuleId === rule.id ? (
                                                                            <input type="number" value={editRuleForm.priority} onChange={e => setEditRuleForm({ ...editRuleForm, priority: parseInt(e.target.value) || 0 })} style={{ width: '70px' }} />
                                                                        ) : rule.priority}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right' }}>
                                                                        {editingRuleId === rule.id ? (
                                                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                                                <button type="button" className="btn btn-primary" onClick={() => saveEditRule(rule.id)} style={{ padding: '0.2rem 0.4rem' }}><Check size={14} /></button>
                                                                                <button type="button" className="btn" onClick={() => setEditingRuleId(null)} style={{ padding: '0.2rem 0.4rem', background: '#e2e8f0' }}><X size={14} /></button>
                                                                            </div>
                                                                        ) : confirmDeleteRuleId === rule.id ? (
                                                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 'bold' }}>Sure?</span>
                                                                                <button type="button" className="btn" onClick={() => deleteRule(rule.id)} style={{ padding: '0.2rem 0.4rem', background: 'var(--danger)', color: 'white' }}>Yes</button>
                                                                                <button type="button" className="btn" onClick={() => setConfirmDeleteRuleId(null)} style={{ padding: '0.2rem 0.4rem', background: '#e2e8f0' }}>No</button>
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                                                <button type="button" className="btn" onClick={() => startEditRule(rule)} style={{ padding: '0.2rem 0.4rem', background: '#f1f5f9' }}><Edit2 size={14} /></button>
                                                                                <button type="button" className="btn" onClick={() => deleteRule(rule.id)} style={{ padding: '0.2rem 0.4rem', background: '#fee2e2', color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {categories.length === 0 && (
                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>No categories yet. Create one to start auto-categorizing transactions.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default CategoryManagement;
