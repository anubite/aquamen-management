const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, initDb } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'aquamen_secret_key_123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

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
    const { name, surname, email, group_id, status } = req.body;
    try {
        const [id] = await db('members').insert({
            name,
            surname,
            email,
            group_id,
            status: status || 'Active'
        });
        const newMember = await db('members').where({ id }).first();
        res.status(201).json(newMember);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/members/:id', authenticate, async (req, res) => {
    const { name, surname, email, group_id, status } = req.body;
    try {
        const changes = await db('members')
            .where({ id: req.params.id })
            .update({ name, surname, email, group_id, status });
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

// Catch-all for React routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
