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

// Hardcoded user as requested
const ADMIN_USER = {
    username: 'aquamen',
    passwordHash: bcrypt.hashSync('milujemeAI', 10)
};

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
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER.username && bcrypt.compareSync(password, ADMIN_USER.passwordHash)) {
        const token = jwt.sign({ username }, SECRET, { expiresIn: '24h' });
        return res.json({ token });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

// Members routes
app.get('/api/members', authenticate, (req, res) => {
    db.all(`
        SELECT m.*, g.trainer as group_trainer 
        FROM members m 
        LEFT JOIN groups g ON m.group_id = g.id 
        ORDER BY m.id DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/members', authenticate, (req, res) => {
    const { name, surname, email, group_id, status } = req.body;

    db.get("SELECT MAX(id) as maxId FROM members", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const nextId = row && row.maxId ? row.maxId + 1 : 1000;

        db.run(
            "INSERT INTO members (id, name, surname, email, group_id, status) VALUES (?, ?, ?, ?, ?, ?)",
            [nextId, name, surname, email, group_id, status || 'Active'],
            function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.status(201).json({ id: nextId, name, surname, email, group_id, status });
            }
        );
    });
});

app.put('/api/members/:id', authenticate, (req, res) => {
    const { name, surname, email, group_id, status } = req.body;
    db.run(
        "UPDATE members SET name = ?, surname = ?, email = ?, group_id = ?, status = ? WHERE id = ?",
        [name, surname, email, group_id, status, req.params.id],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: 'Member updated', changes: this.changes });
        }
    );
});

app.delete('/api/members/:id', authenticate, (req, res) => {
    db.run("DELETE FROM members WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Member deleted', changes: this.changes });
    });
});

// Groups routes
app.get('/api/groups', authenticate, (req, res) => {
    db.all("SELECT * FROM groups ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/groups', authenticate, (req, res) => {
    const { id, trainer } = req.body;
    db.run(
        "INSERT INTO groups (id, trainer) VALUES (?, ?)",
        [id, trainer],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.status(201).json({ id, trainer });
        }
    );
});

app.put('/api/groups/:id', authenticate, (req, res) => {
    const { trainer } = req.body;
    db.run(
        "UPDATE groups SET trainer = ? WHERE id = ?",
        [trainer, req.params.id],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: 'Group updated', id: req.params.id, trainer });
        }
    );
});

app.delete('/api/groups/:id', authenticate, (req, res) => {
    // Check if group has members before deleting
    db.get("SELECT COUNT(*) as count FROM members WHERE group_id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count > 0) {
            return res.status(400).json({ error: 'Cannot delete group with assigned members' });
        }

        db.run("DELETE FROM groups WHERE id = ?", [req.params.id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Group deleted', changes: this.changes });
        });
    });
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
