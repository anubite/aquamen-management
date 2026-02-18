const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, initDb } = require('./db');
const multer = require('multer');
const fs = require('fs');
const MemberImporter = require('./services/MemberImporter');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'aquamen_secret_key_123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Multer config for imports
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/imports');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

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
app.post('/api/login', async (req, res) => {
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
        const rows = await db('members as m')
            .leftJoin('groups as g', 'm.group_id', 'g.id')
            .select('m.*', 'g.trainer as group_trainer')
            .orderBy('m.id', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/members', authenticate, async (req, res) => {
    const { id, name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth } = req.body;

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
            date_of_birth
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
    const { name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth } = req.body;

    if (date_of_birth) {
        const dob = new Date(date_of_birth);
        if (dob > new Date()) {
            return res.status(400).json({ error: 'Date of Birth cannot be in the future' });
        }
    }

    try {
        const changes = await db('members')
            .where({ id: req.params.id })
            .update({ name, surname, email, group_id, status, phone, street, street_number, zip_code, city, date_of_birth });
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
        // Run in background
        importer.process(req.file.path);

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

app.post('/api/members/:id/send-welcome', authenticate, async (req, res) => {
    const { id } = req.params;
    const { subject, body, to, cc } = req.body;

    try {
        const settings = await db('settings').select('*');
        const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

        await EmailService.sendEmail({
            to,
            cc: cc || settingsMap.email_cc,
            subject,
            html: body,
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

// Catch-all for React routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
