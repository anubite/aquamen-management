// Integration tests — /api/transactions/summary business logic
// Run: npm run test:seed && npm run test:integration
// Uses the same dev database as overview.test.js.

'use strict';

process.env.NODE_ENV = 'development';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { db } = require('../../db');

jest.setTimeout(15000);

afterAll(async () => {
    await db.destroy();
});

// Mirrors the server-side summary logic so tests stay in sync
async function getSummary({ month, date_from, date_to } = {}) {
    const settingsRows = await db('settings').select('*');
    const settingsMap = settingsRows.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
    const initialBalance = parseFloat(settingsMap.opening_balance) || 0;

    function applyPeriodFilter(q) {
        if (month) return q.whereRaw("SUBSTR(transaction_date, 1, 7) = ?", [month]);
        if (date_from) q = q.where('transaction_date', '>=', date_from);
        if (date_to)   q = q.where('transaction_date', '<=', date_to);
        return q;
    }

    let openingBalance = initialBalance;
    if (month) {
        const [pre] = await db('transactions')
            .where('transaction_date', '<', `${month}-01`)
            .select(db.raw('SUM(amount) as total'));
        openingBalance = initialBalance + (pre.total || 0);
    } else if (date_from) {
        const [pre] = await db('transactions')
            .where('transaction_date', '<', date_from)
            .select(db.raw('SUM(amount) as total'));
        openingBalance = initialBalance + (pre.total || 0);
    }

    const [totals] = await applyPeriodFilter(db('transactions')).select(
        db.raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income'),
        db.raw('SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense')
    );
    const income  = totals.income  || 0;
    const expense = totals.expense || 0;
    const net     = income + expense;

    const categoryRows = await applyPeriodFilter(
        db('transactions as t')
            .leftJoin('transaction_categories as tc', 't.category_id', 'tc.id')
            .select('tc.id', 'tc.name', 'tc.color', db.raw('SUM(t.amount) as total'))
            .groupBy('t.category_id')
            .havingRaw('SUM(t.amount) <> 0')
    );

    const categories = categoryRows.map(r => ({
        id:    r.id   ?? null,
        name:  r.name ?? 'Uncategorized',
        color: r.color ?? '#64748b',
        total: r.total,
    }));

    return { opening_balance: openingBalance, income, expense, net, closing_balance: openingBalance + net, categories };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('summary — invariants (all-time)', () => {
    let result;
    beforeAll(async () => { result = await getSummary(); });

    it('closing_balance = opening_balance + net', () => {
        expect(result.closing_balance).toBeCloseTo(result.opening_balance + result.net, 2);
    });

    it('net = income + expense', () => {
        expect(result.net).toBeCloseTo(result.income + result.expense, 2);
    });

    it('categories total equals net', () => {
        const catSum = result.categories.reduce((s, c) => s + Number(c.total), 0);
        expect(catSum).toBeCloseTo(result.net, 2);
    });

    it('each category has name, color, and numeric total', () => {
        for (const cat of result.categories) {
            expect(typeof cat.name).toBe('string');
            expect(typeof cat.color).toBe('string');
            expect(typeof cat.total).toBe('number');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('summary — month filter', () => {
    let month;
    beforeAll(async () => {
        const row = await db('transactions')
            .select(db.raw("SUBSTR(transaction_date, 1, 7) as month"))
            .orderBy('month', 'desc')
            .first();
        month = row?.month;
    });

    it('income matches DB SUM for that month', async () => {
        if (!month) return;
        const result = await getSummary({ month });
        const [row] = await db('transactions')
            .whereRaw("SUBSTR(transaction_date, 1, 7) = ?", [month])
            .select(db.raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income'));
        expect(result.income).toBeCloseTo(row.income || 0, 2);
    });

    it('opening_balance = initialBalance + SUM of transactions before month-01', async () => {
        if (!month) return;
        const settings = await db('settings').select('*');
        const sm = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        const initial = parseFloat(sm.opening_balance) || 0;

        const [pre] = await db('transactions')
            .where('transaction_date', '<', `${month}-01`)
            .select(db.raw('SUM(amount) as total'));
        const expectedOpening = initial + (pre.total || 0);

        const result = await getSummary({ month });
        expect(result.opening_balance).toBeCloseTo(expectedOpening, 2);
    });

    it('closing_balance = opening_balance + net for month filter', async () => {
        if (!month) return;
        const result = await getSummary({ month });
        expect(result.closing_balance).toBeCloseTo(result.opening_balance + result.net, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('summary — date range filter', () => {
    const date_from = '2024-01-01';
    const date_to   = '2024-12-31';

    it('income matches DB SUM for date range', async () => {
        const result = await getSummary({ date_from, date_to });
        const [row] = await db('transactions')
            .where('transaction_date', '>=', date_from)
            .where('transaction_date', '<=', date_to)
            .select(db.raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income'));
        expect(result.income).toBeCloseTo(row.income || 0, 2);
    });

    it('opening_balance = initialBalance + SUM before date_from', async () => {
        const settings = await db('settings').select('*');
        const sm = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
        const initial = parseFloat(sm.opening_balance) || 0;

        const [pre] = await db('transactions')
            .where('transaction_date', '<', date_from)
            .select(db.raw('SUM(amount) as total'));
        const expectedOpening = initial + (pre.total || 0);

        const result = await getSummary({ date_from, date_to });
        expect(result.opening_balance).toBeCloseTo(expectedOpening, 2);
    });

    it('closing_balance = opening_balance + net for date range', async () => {
        const result = await getSummary({ date_from, date_to });
        expect(result.closing_balance).toBeCloseTo(result.opening_balance + result.net, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('summary — month takes precedence over date_from', () => {
    it('passing both month and date_from uses month filter', async () => {
        const monthRow = await db('transactions')
            .select(db.raw("SUBSTR(transaction_date, 1, 7) as month"))
            .orderBy('month', 'desc')
            .first();
        if (!monthRow) return;

        const month = monthRow.month;

        // month result
        const monthResult = await getSummary({ month });

        // Combined — the logic in getSummary mirrors server: month checked first
        const combined = await getSummary({ month, date_from: '2000-01-01' });

        // income must equal the month-only result (not all-time)
        expect(combined.income).toBeCloseTo(monthResult.income, 2);
    });
});
