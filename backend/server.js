const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, initDb } = require('./db');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const MemberImporter = require('./services/MemberImporter');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start.');
    process.exit(1);
}
const SECRET = process.env.JWT_SECRET;

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' }
});

const emailSendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 20,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many email send requests, please try again later.' }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Multer config for imports
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const xlsxFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype !== XLSX_MIME || ext !== '.xlsx') {
        return cb(new Error('Only .xlsx files are allowed.'));
    }
    cb(null, true);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/imports');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}.xlsx`); // no original name — prevents path traversal
    }
});

const upload = multer({ storage, fileFilter: xlsxFileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

// Middleware to verify JWT
const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        req.user = decoded;
        next();
    });
};

// Auth routes
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db('users').where({ username }).first();
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ username }, SECRET, { expiresIn: '24h' });
            return res.json({ token });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Members routes
app.get('/api/members', authenticate, async (req, res) => {
    try {
        const page     = Math.max(1, parseInt(req.query.page)  || 1);
        const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const offset   = (page - 1) * limit;
        const search   = (req.query.search   || '').trim();
        const status   = req.query.status   || '';
        const group_id = req.query.group_id || '';

        let query = db('members as m')
            .leftJoin('groups as g', 'm.group_id', 'g.id')
            .orderBy('m.id', 'desc');

        if (search) {
            query = query.whereRaw(
                "LOWER(m.name || ' ' || m.surname || ' ' || m.email || ' ' || COALESCE(m.phone, '')) LIKE ?",
                [`%${search.toLowerCase()}%`]
            );
        }
        if (status && status !== 'All') query = query.where('m.status', status);
        if (group_id && group_id !== 'All') query = query.where('m.group_id', group_id);

        const [{ count }] = await query.clone().count('m.id as count');
        const total      = parseInt(count);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const members = await query
            .clone()
            .select('m.*', 'g.trainer as group_trainer')
            .limit(limit)
            .offset(offset);

        res.json({ members, total, page, limit, totalPages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/members', authenticate, async (req, res) => {
    const { id, name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth, gdpr_consent, language } = req.body;

    if (date_of_birth) {
        const dob = new Date(date_of_birth);
        if (dob > new Date()) {
            return res.status(400).json({ error: 'Date of Birth cannot be in the future' });
        }
    }

    try {
        const insertData = {
            name,
            surname,
            email,
            group_id,
            status: status || 'Active',
            phone,
            street,
            street_number,
            zip_code,
            city,
            date_of_birth,
            gdpr_consent: gdpr_consent === true || gdpr_consent === 1 ? 1 : 0,
            language: language || 'English'
        };
        if (id) insertData.id = id;

        const [newId] = await db('members').insert(insertData);
        const finalId = id || newId;
        const newMember = await db('members').where({ id: finalId }).first();
        res.status(201).json(newMember);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/members/:id', authenticate, async (req, res) => {
    const { name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth, gdpr_consent, language } = req.body;

    if (date_of_birth) {
        const dob = new Date(date_of_birth);
        if (dob > new Date()) {
            return res.status(400).json({ error: 'Date of Birth cannot be in the future' });
        }
    }

    try {
        const changes = await db('members')
            .where({ id: req.params.id })
            .update({
                name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth,
                gdpr_consent: gdpr_consent === true || gdpr_consent === 1 ? 1 : 0,
                language: language || 'English'
            });
        res.json({ message: 'Member updated', changes });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/members/:id', authenticate, async (req, res) => {
    try {
        const changes = await db('members').where({ id: req.params.id }).del();
        res.json({ message: 'Member deleted', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Groups routes
app.get('/api/groups', authenticate, async (req, res) => {
    try {
        const rows = await db('groups').select('*').orderBy('id', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/groups', authenticate, async (req, res) => {
    const { id, trainer } = req.body;
    try {
        await db('groups').insert({ id, trainer });
        res.status(201).json({ id, trainer });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/groups/:id', authenticate, async (req, res) => {
    const { trainer } = req.body;
    try {
        await db('groups').where({ id: req.params.id }).update({ trainer });
        res.json({ message: 'Group updated', id: req.params.id, trainer });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/groups/:id', authenticate, async (req, res) => {
    try {
        const memberCount = await db('members').where({ group_id: req.params.id }).count('id as count').first();
        if (memberCount.count > 0) {
            return res.status(400).json({ error: 'Cannot delete group with assigned members' });
        }
        const changes = await db('groups').where({ id: req.params.id }).del();
        res.json({ message: 'Group deleted', changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import routes
app.post('/api/imports/members', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const [importId] = await db('imports').insert({
            filename: req.file.originalname,
            original_file_path: req.file.path,
            status: 'pending'
        });

        const importer = new MemberImporter(db, importId);
        // Run in background — .catch() prevents unhandled rejection if error escapes internal handler
        importer.process(req.file.path).catch(err =>
            console.error('[Import] Unhandled background error:', err)
        );

        res.json({ importId, message: 'Import started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/imports', authenticate, async (req, res) => {
    try {
        const rows = await db('imports').select('*').orderBy('id', 'desc').limit(10);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/imports/:id', authenticate, async (req, res) => {
    try {
        const importData = await db('imports').where({ id: req.params.id }).first();
        if (!importData) return res.status(404).json({ error: 'Import not found' });

        const logs = await db('import_logs')
            .where({ import_id: req.params.id })
            .orderBy('id', 'asc');

        res.json({ ...importData, logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const EmailService = require('./services/EmailService');
// ... other imports ...

// Public GDPR routes
app.get('/api/public/gdpr/:token', async (req, res) => {
    try {
        const member = await db('members').where({ gdpr_token: req.params.token }).first();
        if (!member) return res.status(404).json({ error: 'Invalid or expired GDPR link' });

        const settings = await db('settings').select('*');
        const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

        res.json({
            member: {
                name: member.name,
                surname: member.surname,
                phone: member.phone,
                street: member.street,
                street_number: member.street_number,
                city: member.city,
                zip_code: member.zip_code,
                date_of_birth: member.date_of_birth,
                language: member.language
            },
            policies: {
                cz: settingsMap.gdpr_policy_cz,
                en: settingsMap.gdpr_policy_en
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/public/gdpr/:token', async (req, res) => {
    const { street, street_number, city, zip_code, date_of_birth, language, phone } = req.body;

    try {
        const member = await db('members').where({ gdpr_token: req.params.token }).first();
        if (!member) return res.status(404).json({ error: 'Invalid or expired GDPR link' });

        await db('members')
            .where({ id: member.id })
            .update({
                street,
                street_number,
                city,
                zip_code,
                date_of_birth,
                language,
                phone,
                gdpr_consent: true,
                gdpr_token: null // Expire the token
            });

        res.json({ message: 'GDPR consent recorded successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Settings routes
app.get('/api/settings', authenticate, async (req, res) => {
    try {
        const settings = await db('settings').select('*');
        const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        res.json(settingsMap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/settings', authenticate, async (req, res) => {
    const settings = req.body;
    try {
        await db.transaction(async trx => {
            for (const [key, value] of Object.entries(settings)) {
                await trx('settings')
                    .insert({ key, value })
                    .onConflict('key')
                    .merge();
            }
        });
        res.json({ message: 'Settings updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/members/:id/send-welcome', authenticate, emailSendLimiter, async (req, res) => {
    const { id } = req.params;
    const { subject, body, to, cc } = req.body;

    try {
        const settings = await db('settings').select('*');
        const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

        let finalBody = body;
        if (body.includes('{{gdpr_link}}')) {
            let member = await db('members').where({ id }).first();
            let token = member.gdpr_token;

            if (!token) {
                token = crypto.randomBytes(32).toString('hex');
                await db('members').where({ id }).update({ gdpr_token: token });
            }

            const frontendUrl = process.env.FRONTEND_URL;
            const gdprLink = frontendUrl
                ? `${frontendUrl.replace(/\/$/, '')}/gdpr/${token}`
                : `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/gdpr/${token}`;
            finalBody = body.replace(/{{gdpr_link}}/g, gdprLink);
        }

        await EmailService.sendEmail({
            to,
            cc: cc || settingsMap.email_cc,
            subject,
            html: finalBody,
            fromName: settingsMap.email_from_name,
            fromEmail: settingsMap.email_from_address,
            replyTo: settingsMap.email_reply_to,
            settings: settingsMap
        });

        res.json({ message: 'Email sent successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Multer error handler
app.use((err, req, res, next) => {
    if (err?.code?.startsWith('LIMIT_')) {
        return res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
    }
    if (err?.message === 'Only .xlsx files are allowed.') {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

// Catch-all for React routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
