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
const {
    recalculateMembers,
    getMemberStatusForMonth,
    getMemberTypeForMonth,
    getFeeForMonth,
    addMonths,
    CALC_START_MONTH,
} = require('./services/FeeCalculator');
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
    const { id, name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth, gdpr_consent, language, member_type } = req.body;

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
            language: language || 'English',
            member_type: member_type || 'regular'
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
    const { name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth, gdpr_consent, language, member_type } = req.body;

    if (date_of_birth) {
        const dob = new Date(date_of_birth);
        if (dob > new Date()) {
            return res.status(400).json({ error: 'Date of Birth cannot be in the future' });
        }
    }

    try {
        const existing = await db('members').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'Member not found' });

        const changes = await db('members')
            .where({ id: req.params.id })
            .update({
                name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth,
                gdpr_consent: gdpr_consent === true || gdpr_consent === 1 ? 1 : 0,
                language: language || 'English',
                member_type: member_type || existing.member_type || 'regular'
            });

        // Write audit log entries for status and type changes
        const auditEntries = [];
        if (status && status !== existing.status) {
            auditEntries.push({ member_id: req.params.id, field: 'status', old_value: existing.status, new_value: status });
        }
        const newType = member_type || existing.member_type || 'regular';
        if (newType !== existing.member_type) {
            auditEntries.push({ member_id: req.params.id, field: 'type', old_value: existing.member_type, new_value: newType });
        }
        if (auditEntries.length > 0) {
            await db('member_audit_log').insert(auditEntries);
        }

        // Recalculate fees for this member (fire-and-forget)
        recalculateMembers(db, [parseInt(req.params.id)]).catch(err =>
            console.error('[FeeCalc] Recalculate error after member update:', err)
        );

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
const { parseClubBankAccount, buildQrUrl, fetchQrAsBase64, buildQrImageTag } = require('./services/QrPaymentService');
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

        // Fetch member once if any server-side placeholder is present
        let member = null;
        if (finalBody.includes('{{gdpr_link}}') || finalBody.includes('{{qr_payment_code}}')) {
            member = await db('members').where({ id }).first();
        }

        if (finalBody.includes('{{gdpr_link}}')) {
            let token = member.gdpr_token;

            if (!token) {
                token = crypto.randomBytes(32).toString('hex');
                await db('members').where({ id }).update({ gdpr_token: token });
            }

            const frontendUrl = process.env.FRONTEND_URL;
            const gdprLink = frontendUrl
                ? `${frontendUrl.replace(/\/$/, '')}/gdpr/${token}`
                : `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/gdpr/${token}`;
            finalBody = finalBody.replace(/{{gdpr_link}}/g, gdprLink);
        }

        let qrWarning = null;
        let qrAttachments = [];
        if (finalBody.includes('{{qr_payment_code}}')) {
            const { accountNumber, bankCode } = parseClubBankAccount(settingsMap.club_bank_account);
            let qrTag = '';

            if (!accountNumber || !bankCode) {
                qrWarning = 'QR code skipped: club_bank_account not configured in Settings.';
            } else {
                const currentMonth = new Date().toISOString().slice(0, 7);
                const feeSetting = await db('fee_settings')
                    .where('valid_from', '<=', currentMonth)
                    .where(function () { this.whereNull('valid_to').orWhere('valid_to', '>=', currentMonth); })
                    .orderBy('valid_from', 'desc')
                    .first();
                const amount = feeSetting
                    ? (member.member_type === 'student' ? feeSetting.student_amount : feeSetting.regular_amount)
                    : 0;
                const url = buildQrUrl({ accountNumber, bankCode, amount, memberId: member.id, memberName: `${member.name} ${member.surname}` });
                const base64 = await fetchQrAsBase64(url);
                if (base64) {
                    const qrCid = 'qr_payment';
                    qrTag = buildQrImageTag(qrCid);
                    qrAttachments = [{
                        filename: 'qr-payment.png',
                        content: Buffer.from(base64, 'base64'),
                        cid: qrCid
                    }];
                } else {
                    qrWarning = `QR code generation failed. URL tried: ${url}`;
                    console.error('QR code generation failed. URL:', url);
                }
            }
            finalBody = finalBody.replace(/{{qr_payment_code}}/g, qrTag);
        }

        await EmailService.sendEmail({
            to,
            cc: cc || settingsMap.email_cc,
            subject,
            html: finalBody,
            fromName: settingsMap.email_from_name,
            fromEmail: settingsMap.email_from_address,
            replyTo: settingsMap.email_reply_to,
            settings: settingsMap,
            attachments: qrAttachments
        });

        res.json({ message: 'Email sent successfully', ...(qrWarning ? { qrWarning } : {}) });
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
    const { name, description, color, is_membership_fee } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
        const [id] = await db('transaction_categories').insert({
            name: name.trim(),
            description: description || null,
            color: color || '#64748b',
            is_membership_fee: is_membership_fee ? 1 : 0
        });
        const category = await db('transaction_categories').where({ id }).first();
        res.status(201).json(category);
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Category name already exists' });
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/transaction-categories/:id', authenticate, async (req, res) => {
    const { name, description, color, is_membership_fee } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
        const existing = await db('transaction_categories').where({ id: req.params.id }).first();
        await db('transaction_categories').where({ id: req.params.id }).update({
            name: name.trim(),
            description: description || null,
            color: color || '#64748b',
            is_membership_fee: is_membership_fee ? 1 : 0
        });
        // If is_membership_fee flag changed, recalculate all members
        const flagChanged = existing && Boolean(existing.is_membership_fee) !== Boolean(is_membership_fee);
        if (flagChanged) {
            recalculateMembers(db).catch(err =>
                console.error('[FeeCalc] Recalculate error after category flag change:', err)
            );
        }
        res.json({ message: 'Category updated' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Category name already exists' });
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/transaction-categories/:id', authenticate, async (req, res) => {
    try {
        const existing = await db('transaction_categories').where({ id: req.params.id }).first();
        await db('transaction_categories').where({ id: req.params.id }).del();
        // If deleted category was the membership fee category, recalculate all members
        if (existing?.is_membership_fee) {
            recalculateMembers(db).catch(err =>
                console.error('[FeeCalc] Recalculate error after membership category deleted:', err)
            );
        }
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

app.delete('/api/transactions/by-months', authenticate, async (req, res) => {
    const { months } = req.body;
    if (!Array.isArray(months) || months.length === 0)
        return res.status(400).json({ error: 'months array required' });
    if (months.some(m => !/^\d{4}-\d{2}$/.test(m)))
        return res.status(400).json({ error: 'Invalid month format' });
    try {
        const count = await db('transactions')
            .whereIn(db.raw('SUBSTR(transaction_date, 1, 7)'), months)
            .delete();
        const updated = await recalculateMembers(db);
        res.json({ message: `Deleted ${count} transaction(s) across ${months.length} month(s)`, count, updated });
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

// ─── Fee Settings ─────────────────────────────────────────────────────────

app.get('/api/fee-settings', authenticate, async (req, res) => {
    try {
        const rows = await db('fee_settings').select('*').orderBy('valid_from', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/fee-settings', authenticate, async (req, res) => {
    const { valid_from, regular_amount, student_amount } = req.body;

    if (!valid_from || !/^\d{4}-\d{2}$/.test(valid_from))
        return res.status(400).json({ error: 'valid_from is required and must be YYYY-MM format' });
    if (!regular_amount || parseFloat(regular_amount) <= 0)
        return res.status(400).json({ error: 'regular_amount must be a positive number' });
    if (!student_amount || parseFloat(student_amount) <= 0)
        return res.status(400).json({ error: 'student_amount must be a positive number' });

    // Enforce: valid_from must be next calendar month or later
    const today = new Date();
    let nm = today.getMonth() + 2, ny = today.getFullYear();
    if (nm > 12) { nm = 1; ny++; }
    const nextMonth = `${ny}-${String(nm).padStart(2, '0')}`;
    if (valid_from < nextMonth)
        return res.status(400).json({ error: `valid_from must be at least next month (${nextMonth})` });

    try {
        const openPeriod = await db('fee_settings').whereNull('valid_to').first();
        if (openPeriod && valid_from <= openPeriod.valid_from)
            return res.status(400).json({ error: 'New period must start after the existing open period' });

        if (openPeriod) {
            // Close the previous open period one month before the new one starts
            const [y, m] = valid_from.split('-').map(Number);
            let pm = m - 1, py = y;
            if (pm < 1) { pm = 12; py--; }
            const prevMonthStr = `${py}-${String(pm).padStart(2, '0')}`;
            await db('fee_settings').where({ id: openPeriod.id }).update({ valid_to: prevMonthStr });
        }

        const [id] = await db('fee_settings').insert({
            valid_from,
            valid_to: null,
            regular_amount: parseFloat(regular_amount),
            student_amount: parseFloat(student_amount),
        });
        const newRow = await db('fee_settings').where({ id }).first();
        res.status(201).json(newRow);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/fee-settings/:id', authenticate, async (req, res) => {
    const { regular_amount, student_amount } = req.body;
    if (!regular_amount || parseFloat(regular_amount) <= 0)
        return res.status(400).json({ error: 'regular_amount must be a positive number' });
    if (!student_amount || parseFloat(student_amount) <= 0)
        return res.status(400).json({ error: 'student_amount must be a positive number' });
    try {
        await db('fee_settings').where({ id: req.params.id }).update({
            regular_amount: parseFloat(regular_amount),
            student_amount: parseFloat(student_amount),
        });
        res.json({ message: 'Fee setting updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/fee-settings/:id', authenticate, async (req, res) => {
    try {
        const row = await db('fee_settings').where({ id: req.params.id }).first();
        if (!row) return res.status(404).json({ error: 'Fee setting not found' });
        if (row.valid_to !== null)
            return res.status(400).json({ error: 'Only the current (open-ended) fee period can be deleted' });

        await db('fee_settings').where({ id: req.params.id }).del();

        // Restore the previous period to open-ended
        const prev = await db('fee_settings').orderBy('valid_from', 'desc').first();
        if (prev) await db('fee_settings').where({ id: prev.id }).update({ valid_to: null });

        res.json({ message: 'Fee period deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Overview / Pivot ──────────────────────────────────────────────────────

app.get('/api/overview/pivot', authenticate, async (req, res) => {
    try {
        const monthsParam    = req.query.months || '';
        const memberIdsParam = req.query.member_ids || '';

        // Membership fee category IDs
        const membershipCatIds = (
            await db('transaction_categories').where('is_membership_fee', true).select('id')
        ).map(r => r.id);

        // Fix 1: default 6 months, sorted newest-first (frontend reverses for display)
        let months;
        if (monthsParam) {
            months = monthsParam.split(',').map(m => m.trim()).filter(m => /^\d{4}-\d{2}$/.test(m));
            months.sort((a, b) => b.localeCompare(a));
        } else {
            if (membershipCatIds.length > 0) {
                const rows = await db('transactions')
                    .whereIn('category_id', membershipCatIds)
                    .select(db.raw("SUBSTR(transaction_date, 1, 7) as month"))
                    .distinct()
                    .orderBy('month', 'desc')
                    .limit(6);
                months = rows.map(r => r.month);
            }
            if (!months || months.length === 0) {
                // Fallback: last 6 calendar months
                months = [];
                const now = new Date();
                let y = now.getFullYear(), m = now.getMonth() + 1;
                for (let i = 0; i < 6; i++) {
                    months.push(`${y}-${String(m).padStart(2, '0')}`);
                    if (--m < 1) { m = 12; y--; }
                }
            }
        }

        // Fix 4: member status filter (default: active)
        const statusFilter = req.query.status || 'active';
        let membersQuery = db('members').select('id', 'name', 'surname', 'member_type', 'status');
        if (memberIdsParam) {
            const ids = memberIdsParam.split(',').map(s => parseInt(s)).filter(n => !isNaN(n));
            membersQuery = membersQuery.whereIn('id', ids);
        } else if (statusFilter === 'canceled') {
            membersQuery = membersQuery.where('status', 'Canceled');
        } else if (statusFilter === 'all') {
            // no status filter — all members
        } else {
            // default: active only
            membersQuery = membersQuery.where('status', 'Active');
        }
        const members = await membersQuery;
        if (members.length === 0) return res.json({ months, members: [] });

        const memberIds = members.map(m => m.id);

        const [feeSettings, auditLog, feesDue] = await Promise.all([
            db('fee_settings').select('*').orderBy('valid_from', 'asc'),
            db('member_audit_log').whereIn('member_id', memberIds)
                .select('member_id', 'field', 'old_value', 'new_value', 'changed_at')
                .orderBy('changed_at', 'asc'),
            db('member_fees_due').whereIn('member_id', memberIds).select('*'),
        ]);
        const feesDueMap = Object.fromEntries(feesDue.map(r => [r.member_id, r]));

        // Fix 2: find effective start month (first membership-fee tx in the system)
        const firstTxRow = membershipCatIds.length > 0
            ? await db('transactions').whereIn('category_id', membershipCatIds)
                .min('transaction_date as minDate').first()
            : null;
        const firstTxMonth = firstTxRow?.minDate ? firstTxRow.minDate.slice(0, 7) : null;
        const effectiveStart = firstTxMonth && firstTxMonth > CALC_START_MONTH
            ? firstTxMonth
            : CALC_START_MONTH;

        // Transactions for displayed months only
        const minMonth = months[months.length - 1];
        const maxMonth = months[0];
        const txs = membershipCatIds.length > 0
            ? await db('transactions')
                .whereIn('member_id', memberIds)
                .whereIn('category_id', membershipCatIds)
                .where('transaction_date', '>=', minMonth + '-01')
                .where('transaction_date', '<=', maxMonth + '-31')
                .select('member_id', 'transaction_date', 'amount')
            : [];

        const pivotMembers = members.map(member => {
            const log = auditLog.filter(e => e.member_id === member.id);
            const memberTx = txs.filter(t => t.member_id === member.id);

            const paidByMonth = {};
            for (const t of memberTx) {
                const mon = t.transaction_date.slice(0, 7);
                paidByMonth[mon] = (paidByMonth[mon] || 0) + t.amount;
            }

            const payments = {};
            for (const month of months) {
                // Fix 2: skip months before the effective start
                if (month < effectiveStart) {
                    payments[month] = { amount_paid: 0, amount_due: 0, is_active: false };
                    continue;
                }
                // Fix 3: pass member.status as default for getMemberStatusForMonth
                const status = getMemberStatusForMonth(log, member.status, month);
                let amountDue = 0;
                if (status === 'Active') {
                    const type = getMemberTypeForMonth(log, member.member_type, month);
                    amountDue = getFeeForMonth(feeSettings, type, month);
                }
                payments[month] = {
                    amount_paid: paidByMonth[month] || 0,
                    amount_due:  amountDue,
                    is_active:   amountDue > 0,
                };
            }

            const fd = feesDueMap[member.id];
            return {
                id: member.id,
                name: member.name,
                surname: member.surname,
                member_type: member.member_type,
                status: member.status,
                fees_due: fd ? {
                    outstanding:    fd.outstanding,
                    override_amount: fd.override_amount,
                    override_at:    fd.override_at,
                    override_note:  fd.override_note,
                    recalculated_at: fd.recalculated_at,
                    unpaid_months:  JSON.parse(fd.unpaid_months || '[]'),
                } : null,
                payments,
            };
        });

        pivotMembers.sort((a, b) =>
            `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`)
        );

        res.json({ months, members: pivotMembers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/overview/recalculate', authenticate, async (req, res) => {
    try {
        const updated = await recalculateMembers(db);
        res.json({ message: 'Recalculation complete', updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/overview/members/:id/fees-override', authenticate, async (req, res) => {
    const { override_amount, override_note } = req.body;
    if (override_amount === undefined || override_amount === null || isNaN(parseFloat(override_amount)))
        return res.status(400).json({ error: 'override_amount is required and must be a number' });

    try {
        const member = await db('members').where({ id: req.params.id }).first();
        if (!member) return res.status(404).json({ error: 'Member not found' });

        const lastTxRow = await db('transactions').max('transaction_date as maxDate').first();
        let override_at;
        if (lastTxRow?.maxDate) {
            const [y, m] = lastTxRow.maxDate.slice(0, 7).split('-').map(Number);
            override_at = new Date(y, m, 0).toISOString().slice(0, 10); // YYYY-MM-DD, last day of that month
        } else {
            override_at = new Date().toISOString().slice(0, 10);
        }
        const existing = await db('member_fees_due').where({ member_id: req.params.id }).first();
        if (existing) {
            await db('member_fees_due').where({ member_id: req.params.id }).update({
                override_amount: parseFloat(override_amount),
                override_at,
                override_note: override_note || null,
            });
        } else {
            await db('member_fees_due').insert({
                member_id: req.params.id,
                total_calculated_due: 0,
                total_paid: 0,
                outstanding: parseFloat(override_amount),
                override_amount: parseFloat(override_amount),
                override_at,
                override_note: override_note || null,
            });
        }

        // Recalculate to apply override in the outstanding field
        await recalculateMembers(db, [parseInt(req.params.id)]);
        const updated = await db('member_fees_due').where({ member_id: req.params.id }).first();
        res.json({ message: 'Override saved', fees_due: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/overview/members/:id/fees-override', authenticate, async (req, res) => {
    try {
        await db('member_fees_due').where({ member_id: req.params.id }).update({
            override_amount: null,
            override_at:     null,
            override_note:   null,
        });
        await recalculateMembers(db, [parseInt(req.params.id)]);
        res.json({ message: 'Override cleared' });
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
