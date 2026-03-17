// Integration tests — GET /api/members/summary business logic
// Mirrors the endpoint logic directly against the dev DB (no HTTP layer).
// Run: npm run test:seed && npm run test:integration

'use strict';

process.env.NODE_ENV = 'development';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { db } = require('../../db');

jest.setTimeout(15000);

afterAll(async () => {
    await db.destroy();
});

// Mirrors the endpoint logic so tests validate the same computation
async function getMembersSummary() {
    const groups = await db('groups').select('id', 'trainer').orderBy('id');
    const rows   = await db('members')
        .select('group_id', 'status', db.raw('COUNT(*) as count'))
        .groupBy('group_id', 'status');

    const totalActive   = rows.filter(r => r.status === 'Active').reduce((s, r) => s + Number(r.count), 0);
    const totalCanceled = rows.filter(r => r.status === 'Canceled').reduce((s, r) => s + Number(r.count), 0);

    const byGroup = groups.map(g => {
        const active   = Number(rows.find(r => r.group_id === g.id && r.status === 'Active')?.count  ?? 0);
        const canceled = Number(rows.find(r => r.group_id === g.id && r.status === 'Canceled')?.count ?? 0);
        return { group_id: g.id, trainer: g.trainer, active, canceled };
    });

    const noGroupActive   = Number(rows.find(r => r.group_id === null && r.status === 'Active')?.count  ?? 0);
    const noGroupCanceled = Number(rows.find(r => r.group_id === null && r.status === 'Canceled')?.count ?? 0);
    if (noGroupActive + noGroupCanceled > 0) {
        byGroup.push({ group_id: null, trainer: null, active: noGroupActive, canceled: noGroupCanceled });
    }

    return { total_active: totalActive, total_canceled: totalCanceled, by_group: byGroup };
}

// ─── Invariants ───────────────────────────────────────────────────────────────

describe('GET /api/members/summary — invariants', () => {
    let result;

    beforeAll(async () => {
        result = await getMembersSummary();
    });

    test('total_active and total_canceled are numbers (not strings)', () => {
        expect(typeof result.total_active).toBe('number');
        expect(typeof result.total_canceled).toBe('number');
    });

    test('total_active + total_canceled equals total member count', async () => {
        const [{ count }] = await db('members').count('* as count');
        expect(result.total_active + result.total_canceled).toBe(Number(count));
    });

    test('total_active equals count of Active members in DB', async () => {
        const [{ count }] = await db('members').where('status', 'Active').count('* as count');
        expect(result.total_active).toBe(Number(count));
    });

    test('total_canceled equals count of Canceled members in DB', async () => {
        const [{ count }] = await db('members').where('status', 'Canceled').count('* as count');
        expect(result.total_canceled).toBe(Number(count));
    });

    test('by_group active counts sum to total_active', () => {
        const sumActive = result.by_group.reduce((s, g) => s + g.active, 0);
        expect(sumActive).toBe(result.total_active);
    });

    test('by_group canceled counts sum to total_canceled', () => {
        const sumCanceled = result.by_group.reduce((s, g) => s + g.canceled, 0);
        expect(result.total_canceled).toBe(sumCanceled);
    });

    test('by_group active and canceled are numbers (not strings)', () => {
        for (const g of result.by_group) {
            expect(typeof g.active).toBe('number');
            expect(typeof g.canceled).toBe('number');
        }
    });

    test('by_group entries match groups in DB', async () => {
        const dbGroups = await db('groups').select('id').orderBy('id');
        const dbIds = dbGroups.map(g => g.id);
        const summaryIds = result.by_group.filter(g => g.group_id !== null).map(g => g.group_id);
        expect(summaryIds).toEqual(dbIds);
    });

    test('no-group bucket only present when unassigned members exist', async () => {
        const [{ count }] = await db('members').whereNull('group_id').count('* as count');
        const hasNullBucket = result.by_group.some(g => g.group_id === null);
        if (Number(count) > 0) {
            expect(hasNullBucket).toBe(true);
        } else {
            expect(hasNullBucket).toBe(false);
        }
    });

    test('each by_group entry active count matches DB', async () => {
        for (const g of result.by_group.filter(g => g.group_id !== null)) {
            const [{ count }] = await db('members')
                .where({ group_id: g.group_id, status: 'Active' })
                .count('* as count');
            expect(g.active).toBe(Number(count));
        }
    });
});
