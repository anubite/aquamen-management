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
const TransactionImporter = require('./services/TransactionImporter');
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
        const limit    = Math.min(2000, Math.max(1, parseInt(req.query.limit) || 25));
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

// --- Transaction Categories ---

app.get('/api/transaction-categories', authenticate, async (req, res) => {
    try {
        const categories = await db('transaction_categories').select('*').orderBy('name', 'asc');
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transaction-categories', authenticate, async (req, res) => {
    const { name, description, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
        const [id] = await db('transaction_categories').insert({
            name: name.trim(),
            description: description || null,
            color: color || '#64748b'
        });
        const category = await db('transaction_categories').where({ id }).first();
        res.status(201).json(category);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Category name already exists' });
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/transaction-categories/:id', authenticate, async (req, res) => {
    const { name, description, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
        await db('transaction_categories').where({ id: req.params.id }).update({
            name: name.trim(), description: description || null, color: color || '#64748b'
        });
        res.json({ message: 'Category updated' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Category name already exists' });
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/transaction-categories/:id', authenticate, async (req, res) => {
    try {
        await db('transaction_categories').where({ id: req.params.id }).del();
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Transaction Category Rules ---

const ALLOWED_RULE_FIELDS = ['transaction_type', 'counterparty_name', 'variable_symbol', 'counterparty_account', 'message_for_recipient', 'message_for_me', 'amount'];
const ALLOWED_STRING_OPERATORS = ['contains', 'equals', 'starts_with', 'regex'];
const ALLOWED_NUMERIC_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'equals'];
const ALLOWED_RULE_OPERATORS = [...new Set([...ALLOWED_STRING_OPERATORS, ...ALLOWED_NUMERIC_OPERATORS])];

function matchRule(tx, rule) {
    if (rule.field === 'amount') {
        const txAmt = parseFloat(tx.amount);
        const ruleAmt = parseFloat(rule.value);
        if (isNaN(ruleAmt)) return false;
        switch (rule.operator) {
            case 'gt':     return txAmt > ruleAmt;
            case 'gte':    return txAmt >= ruleAmt;
            case 'lt':     return txAmt < ruleAmt;
            case 'lte':    return txAmt <= ruleAmt;
            case 'equals': return txAmt === ruleAmt;
        }
    } else {
        const fieldValueRaw = String(tx[rule.field] ?? '');
        const fieldValue    = fieldValueRaw.toLowerCase();
        const ruleValue     = rule.value.toLowerCase();
        switch (rule.operator) {
            case 'contains':    return fieldValue.includes(ruleValue);
            case 'equals':      return fieldValue === ruleValue;
            case 'starts_with': return fieldValue.startsWith(ruleValue);
            case 'regex':
                try { return new RegExp(rule.value, 'i').test(fieldValueRaw); }
                catch { return false; }
        }
    }
    return false;
}

app.get('/api/transaction-category-rules', authenticate, async (req, res) => {
    try {
        const rules = await db('transaction_category_rules as r')
            .leftJoin('transaction_categories as c', 'r.category_id', 'c.id')
            .select('r.*', 'c.name as category_name', 'c.color as category_color')
            .orderBy('r.priority', 'asc');
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transaction-category-rules', authenticate, async (req, res) => {
    const { category_id, field, operator, value, priority } = req.body;
    if (!ALLOWED_RULE_FIELDS.includes(field)) return res.status(400).json({ error: `Invalid field. Allowed: ${ALLOWED_RULE_FIELDS.join(', ')}` });
    const allowedOpsPost = field === 'amount' ? ALLOWED_NUMERIC_OPERATORS : ALLOWED_STRING_OPERATORS;
    if (!allowedOpsPost.includes(operator)) return res.status(400).json({ error: `Invalid operator for field '${field}'. Allowed: ${allowedOpsPost.join(', ')}` });
    if (!value || !String(value).trim()) return res.status(400).json({ error: 'Value is required' });
    if (!category_id) return res.status(400).json({ error: 'category_id is required' });
    try {
        const [id] = await db('transaction_category_rules').insert({
            category_id, field, operator, value: String(value).trim(), priority: priority ?? 0
        });
        const rule = await db('transaction_category_rules').where({ id }).first();
        res.status(201).json(rule);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/transaction-category-rules/:id', authenticate, async (req, res) => {
    const { category_id, field, operator, value, priority } = req.body;
    if (field && !ALLOWED_RULE_FIELDS.includes(field)) return res.status(400).json({ error: `Invalid field` });
    if (operator) {
        const allowedOpsPut = field === 'amount' ? ALLOWED_NUMERIC_OPERATORS : ALLOWED_STRING_OPERATORS;
        if (!allowedOpsPut.includes(operator)) return res.status(400).json({ error: `Invalid operator for field '${field}'` });
    }
    try {
        await db('transaction_category_rules').where({ id: req.params.id }).update({
            category_id, field, operator, value: value ? String(value).trim() : value, priority: priority ?? 0
        });
        res.json({ message: 'Rule updated' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/transaction-category-rules/:id', authenticate, async (req, res) => {
    try {
        await db('transaction_category_rules').where({ id: req.params.id }).del();
        res.json({ message: 'Rule deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Transactions ---

// Note: static sub-paths (types, months, auto-categorize, auto-link-members, month/:ym) must come before :id routes
app.get('/api/transactions/months', authenticate, async (req, res) => {
    try {
        const rows = await db('transactions')
            .select(db.raw("SUBSTR(transaction_date, 1, 7) as month"))
            .distinct()
            .orderBy('month', 'desc');
        res.json(rows.map(r => r.month));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions/types', authenticate, async (req, res) => {
    try {
        const types = await db('transactions').distinct('transaction_type').orderBy('transaction_type', 'asc');
        res.json(types.map(t => t.transaction_type));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/transactions', authenticate, async (req, res) => {
    try {
        const page     = Math.max(1, parseInt(req.query.page) || 1);
        const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset   = (page - 1) * limit;
        const search   = (req.query.search || '').trim();
        const category_id      = req.query.category_id || '';
        const date_from        = req.query.date_from || '';
        const date_to          = req.query.date_to || '';
        const member_linked    = req.query.member_linked || '';
        const transaction_type = req.query.transaction_type || '';
        const month            = req.query.month || '';

        let query = db('transactions as t')
            .leftJoin('transaction_categories as c', 't.category_id', 'c.id')
            .leftJoin('members as m', 't.member_id', 'm.id');

        if (search) {
            query = query.whereRaw(
                "LOWER(COALESCE(t.counterparty_name,'') || ' ' || COALESCE(t.variable_symbol,'') || ' ' || COALESCE(t.message_for_recipient,'') || ' ' || COALESCE(t.message_for_me,'') || ' ' || COALESCE(t.iban,'')) LIKE ?",
                [`%${search.toLowerCase()}%`]
            );
        }
        if (category_id === 'uncategorized') {
            query = query.whereNull('t.category_id');
        } else if (category_id && category_id !== 'All') {
            query = query.where('t.category_id', category_id);
        }
        if (date_from) query = query.where('t.transaction_date', '>=', date_from);
        if (date_to)   query = query.where('t.transaction_date', '<=', date_to);
        if (month)     query = query.whereRaw("SUBSTR(t.transaction_date, 1, 7) = ?", [month]);
        if (member_linked === 'yes') query = query.whereNotNull('t.member_id');
        if (member_linked === 'no')  query = query.whereNull('t.member_id');
        if (transaction_type && transaction_type !== 'All') query = query.where('t.transaction_type', transaction_type);

        const [{ count }] = await query.clone().count('t.id as count');
        const total      = parseInt(count);
        const totalPages = Math.max(1, Math.ceil(total / limit));

        const transactions = await query.clone()
            .select('t.*', 'c.name as category_name', 'c.color as category_color', 'm.name as member_name', 'm.surname as member_surname')
            .orderBy('t.transaction_date', 'desc')
            .orderBy('t.id', 'desc')
            .limit(limit)
            .offset(offset);

        const [summary] = await query.clone().select(
            db.raw('SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_income'),
            db.raw('SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END) as total_expense'),
            db.raw('SUM(t.amount) as net')
        );

        res.json({ transactions, total, page, limit, totalPages, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/import', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const [importId] = await db('imports').insert({
            filename: req.file.originalname,
            original_file_path: req.file.path,
            status: 'pending'
        });
        const importer = new TransactionImporter(db, importId);
        importer.process(req.file.path).catch(err =>
            console.error('[Transaction Import] Unhandled background error:', err)
        );
        res.json({ importId, message: 'Transaction import started' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/auto-categorize', authenticate, async (req, res) => {
    try {
        const rules = await db('transaction_category_rules').select('*').orderBy('priority', 'asc');
        if (rules.length === 0) return res.json({ message: 'No rules defined', categorized: 0 });

        const uncategorized = await db('transactions').whereNull('category_id').select('*');
        let categorizedCount = 0;

        for (const tx of uncategorized) {
            for (const rule of rules) {
                if (matchRule(tx, rule)) {
                    await db('transactions').where({ id: tx.id }).update({ category_id: rule.category_id });
                    categorizedCount++;
                    break;
                }
            }
        }

        res.json({ message: 'Auto-categorization complete', categorized: categorizedCount, total: uncategorized.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/auto-link-members', authenticate, async (req, res) => {
    try {
        const unlinked = await db('transactions')
            .whereNull('member_id')
            .select('id', 'variable_symbol', 'counterparty_name');
        const allMembers = await db('members').select('id', 'name', 'surname');
        const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        let linkedCount = 0;

        for (const tx of unlinked) {
            let memberId = null;

            // Primary: variable symbol → member id
            if (tx.variable_symbol) {
                const numericVS = parseInt(tx.variable_symbol, 10);
                if (!isNaN(numericVS)) {
                    const member = await db('members').where({ id: numericVS }).first();
                    if (member) memberId = member.id;
                }
            }

            // Fallback: counterparty name (both orderings, diacritics-insensitive)
            if (!memberId && tx.counterparty_name) {
                const cpNorm = norm(tx.counterparty_name);
                const matched = allMembers.find(m =>
                    cpNorm === norm(`${m.name} ${m.surname}`) || cpNorm === norm(`${m.surname} ${m.name}`)
                );
                if (matched) memberId = matched.id;
            }

            if (memberId) {
                await db('transactions').where({ id: tx.id }).update({ member_id: memberId });
                linkedCount++;
            }
        }

        res.json({ message: 'Auto-link complete', linked: linkedCount, checked: unlinked.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transactions/clear-categories', authenticate, async (req, res) => {
    try {
        const count = await db('transactions').whereNotNull('category_id').update({ category_id: null });
        res.json({ message: `Cleared categories from ${count} transaction(s)`, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/transactions/bulk-categorize', authenticate, async (req, res) => {
    const { ids, category_id } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    try {
        const count = await db('transactions').whereIn('id', ids).update({ category_id: category_id || null });
        res.json({ message: `Updated category for ${count} transaction(s)`, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/transactions/bulk-link-member', authenticate, async (req, res) => {
    const { ids, member_id } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    try {
        const count = await db('transactions').whereIn('id', ids).update({ member_id: member_id || null });
        res.json({ message: `Updated member link for ${count} transaction(s)`, count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/transactions/:id/categorize', authenticate, async (req, res) => {
    const { category_id } = req.body;
    try {
        await db('transactions').where({ id: req.params.id }).update({ category_id: category_id || null });
        res.json({ message: 'Transaction categorized' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/transactions/:id/link-member', authenticate, async (req, res) => {
    const { member_id } = req.body;
    try {
        if (member_id) {
            const member = await db('members').where({ id: member_id }).first();
            if (!member) return res.status(404).json({ error: 'Member not found' });
        }
        await db('transactions').where({ id: req.params.id }).update({ member_id: member_id || null });
        res.json({ message: 'Member link updated' });
    } catch (err) {
        res.status(400).json({ error: err.message });
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
