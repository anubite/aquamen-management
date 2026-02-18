import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileText, History } from 'lucide-react';
import axios from 'axios';

function ImportDashboard({ isOpen, onClose, token, onComplete }) {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [activeImport, setActiveImport] = useState(null);
    const [importHistory, setImportHistory] = useState([]);
    const [logs, setLogs] = useState([]);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    useEffect(() => {
        let interval;
        if (activeImport && (activeImport.status === 'pending' || activeImport.status === 'processing')) {
            interval = setInterval(fetchActiveStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [activeImport]);

    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/imports', authHeader);
            setImportHistory(res.data);
        } catch (err) {
            console.error('Error fetching history', err);
        }
    };

    const fetchActiveStatus = async () => {
        if (!activeImport) return;
        try {
            const res = await axios.get(`/api/imports/${activeImport.id}`, authHeader);
            setActiveImport(res.data);
            setLogs(res.data.logs || []);
            if (res.data.status === 'completed' || res.data.status === 'failed') {
                fetchHistory();
                if (onComplete) onComplete();
            }
        } catch (err) {
            console.error('Error fetching status', err);
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragover' || e.type === 'dragenter') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/imports/members', formData, {
                headers: {
                    ...authHeader.headers,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setActiveImport({ id: res.data.importId, status: 'pending' });
            setFile(null);
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Upload />
                        <h2>Excel Member Import</h2>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X /></button>
                </div>

                <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: activeImport ? '1fr' : '1fr 1fr', gap: '2rem' }}>
                    {!activeImport ? (
                        <>
                            <div
                                className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                            >
                                <input type="file" id="file-upload" accept=".xlsx" onChange={handleFileChange} hidden />
                                <label htmlFor="file-upload" className="upload-label">
                                    <FileText size={48} color="var(--primary)" />
                                    <span>{file ? file.name : 'Select or drop Excel file'}</span>
                                </label>
                                <button
                                    className="btn btn-primary w-full"
                                    disabled={!file || isUploading}
                                    onClick={handleUpload}
                                >
                                    {isUploading ? <><Loader2 className="animate-spin" /> Uploading...</> : 'Start Import'}
                                </button>
                            </div>

                            <div className="history-zone">
                                <h3><History size={18} /> Recent Imports</h3>
                                <div className="history-list">
                                    {importHistory.map(imp => (
                                        <div key={imp.id} className="history-item" onClick={() => setActiveImport(imp)}>
                                            <span className="file-name">{imp.filename}</span>
                                            <span className={`badge badge-${imp.status}`}>{imp.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="active-import">
                            <div className="import-status-header">
                                <h3>Processing: {activeImport.filename}</h3>
                                <button className="btn btn-sm" onClick={() => setActiveImport(null)}>Back to Upload</button>
                            </div>

                            <div className="progress-bar-container">
                                <div className={`progress-bar ${activeImport.status}`} style={{ width: activeImport.status === 'completed' ? '100%' : '50%' }}></div>
                            </div>

                            <div className="log-container">
                                {logs.length === 0 && <div className="p-4 text-center text-muted">Waiting for logs...</div>}
                                {logs.map(log => (
                                    <div key={log.id} className={`log-entry ${log.level}`}>
                                        {log.level === 'success' && <CheckCircle2 size={14} />}
                                        {(log.level === 'error' || log.level === 'warning') && <AlertCircle size={14} />}
                                        <span className="row-num">Row {log.row_number}:</span>
                                        <span className="msg">{log.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ImportDashboard;
