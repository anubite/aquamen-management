// Integration tests — FeeCalculator DB-level recalculation
// Run: npm run test:seed && npm run test:integration
// Cleanup: npm run test:reset
// Mutates the dev database. Do not run in CI without a dedicated test DB.

'use strict';

// knexfile.js has no 'test' environment — keep using 'development' config
process.env.NODE_ENV = 'development';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { db } = require('../../db');
const { recalculateMembers, getMonthsRange, CALC_START_MONTH } = require('../../services/FeeCalculator');

jest.setTimeout(30000);

const TC = {
    TC01: 10001, TC02: 10002, TC03: 10003, TC04: 10004, TC05: 10005,
    TC06: 10006, TC07: 10007, TC08: 10008, TC09: 10009, TC10: 10010,
    TC12: 10012, TC13: 10013, TC_A: 10014, TC_B: 10015, TC_C: 10016,
    TC_F: 10017, TC_G: 10018, SENTINEL: 10099,
};

// All set in beforeAll — dynamic to work with any dev DB
let REGULAR_AMOUNT;
let STUDENT_AMOUNT;
let EFFECTIVE_START;  // mirrors recalculateMembers() effectiveStart logic
let TC_A_PARTIAL;
let TC_B_TOTAL;
let TC_C_PAID;
let TC08_PAYMENT;
let TC_F_PAYMENT;
let OVERRIDE_AMOUNT;

beforeAll(async () => {
    // ── Fee amounts ────────────────────────────────────────────────────────
    const fs = await db('fee_settings')
        .where('valid_from', '<=', '2024-01')
        .where(function() { this.whereNull('valid_to').orWhere('valid_to', '>=', '2024-01'); })
        .orderBy('valid_from', 'desc')
        .first();
    if (!fs) throw new Error('No fee_settings covering 2024-01. Run npm run test:seed first.');
    REGULAR_AMOUNT = fs.regular_amount;
    STUDENT_AMOUNT = fs.student_amount;

    // ── effectiveStart — mirrors recalculateMembers() ──────────────────────
    const membershipCats = await db('transaction_categories').where('is_membership_fee', true).select('id');
    const catIds = membershipCats.map(r => r.id);
    let firstTxMonth = null;
    if (catIds.length > 0) {
        const row = await db('transactions').whereIn('category_id', catIds).min('transaction_date as minDate').first();
        if (row && row.minDate) firstTxMonth = row.minDate.slice(0, 7);
    }
    EFFECTIVE_START = (firstTxMonth && firstTxMonth > CALC_START_MONTH) ? firstTxMonth : CALC_START_MONTH;

    // ── Transaction amounts from seeded data ───────────────────────────────
    const tcaRow = await db('transactions').where('unique_hash', 'TEST-TC-A-1').first();
    TC_A_PARTIAL = tcaRow ? tcaRow.amount : 0;

    const tcbRows = await db('transactions').where('unique_hash', 'like', 'TEST-TC-B-%');
    TC_B_TOTAL = tcbRows.reduce((s, r) => s + r.amount, 0);

    const tccRow = await db('transactions').where('unique_hash', 'TEST-TC-C-1').first();
    TC_C_PAID = tccRow ? tccRow.amount : 0;

    const tc08Row = await db('transactions').where('unique_hash', 'TEST-TC08-1').first();
    TC08_PAYMENT = tc08Row ? tc08Row.amount : 0;

    // TC-F: only the 2024-07-01 tx counts (strictly after override_at 2024-06-30)
    const tcfRow = await db('transactions').where('unique_hash', 'TEST-TC-F-2').first();
    TC_F_PAYMENT = tcfRow ? tcfRow.amount : 0;

    const tc07Override = await db('member_fees_due').where('member_id', TC.TC07).first();
    OVERRIDE_AMOUNT = tc07Override ? tc07Override.override_amount : REGULAR_AMOUNT;

    await recalculateMembers(db, Object.values(TC));
});

afterAll(async () => {
    await db.destroy();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC01 — Always active regular, fully paid (Jan–Dec 2024)', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC01).first();
    });

    it('outstanding = total_due − 12 paid months', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2099-12').length - REGULAR_AMOUNT * 12;
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
    it('unpaid_months does not contain any 2024 paid month', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        for (let m = 1; m <= 12; m++) {
            expect(unpaid).not.toContain(`2024-${String(m).padStart(2, '0')}`);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC02 — Always active regular, never paid', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC02).first();
    });

    it('total_calculated_due ≈ REGULAR_AMOUNT × all months from effectiveStart', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2099-12').length;
        expect(row.total_calculated_due).toBeCloseTo(expected, 2);
    });
    it('outstanding ≈ total_calculated_due', () => {
        expect(row.outstanding).toBeCloseTo(row.total_calculated_due, 2);
    });
    it('unpaid_months covers full range from effectiveStart', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        expect(unpaid.length).toBe(getMonthsRange(EFFECTIVE_START, '2099-12').length);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC03 — Always active regular, gaps in payment (missing 03+06)', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC03).first();
    });

    it('outstanding ≈ REGULAR_AMOUNT × (total months − 10 paid)', () => {
        const expected = REGULAR_AMOUNT * (getMonthsRange(EFFECTIVE_START, '2099-12').length - 10);
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
    it('unpaid_months contains 2024-03', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-03');
    });
    it('unpaid_months contains 2024-06', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-06');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC04 — Active → Canceled on 2024-06-01', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC04).first();
    });

    it('total_calculated_due ≈ REGULAR_AMOUNT × months effectiveStart..2024-05', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2024-05').length;
        expect(row.total_calculated_due).toBeCloseTo(expected, 2);
    });
    it('outstanding ≈ total_calculated_due (no payments)', () => {
        expect(row.outstanding).toBeCloseTo(row.total_calculated_due, 2);
    });
    it('unpaid_months contains 2024-01..2024-05', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        for (const m of ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05']) {
            expect(unpaid).toContain(m);
        }
    });
    it('unpaid_months does not contain 2024-06 or later', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        expect(unpaid).not.toContain('2024-06');
        expect(unpaid).not.toContain('2024-07');
        expect(unpaid).not.toContain('2025-01');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC05 — Canceled → Active on 2024-04-01', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC05).first();
    });

    it('total_calculated_due ≈ REGULAR_AMOUNT × months from 2024-04', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange('2024-04', '2099-12').length;
        expect(row.total_calculated_due).toBeCloseTo(expected, 2);
    });
    it('unpaid_months does not contain 2024-01..2024-03', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        expect(unpaid).not.toContain('2024-01');
        expect(unpaid).not.toContain('2024-02');
        expect(unpaid).not.toContain('2024-03');
    });
    it('unpaid_months contains 2024-04', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-04');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC06 — Regular → Student on 2024-07-01', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC06).first();
    });

    it('total_calculated_due = REGULAR × effectiveStart..2024-06 + STUDENT × 2024-07..2099-12', () => {
        const expected =
            REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2024-06').length +
            STUDENT_AMOUNT * getMonthsRange('2024-07', '2099-12').length;
        expect(row.total_calculated_due).toBeCloseTo(expected, 2);
    });
    it('total_paid ≈ 12 × REGULAR_AMOUNT', () => {
        expect(row.total_paid).toBeCloseTo(REGULAR_AMOUNT * 12, 2);
    });
    it('outstanding = total_calculated_due − total_paid', () => {
        expect(row.outstanding).toBeCloseTo(row.total_calculated_due - REGULAR_AMOUNT * 12, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC07 — Override set, no post-override payments', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC07).first();
    });

    it('outstanding ≈ override_amount + fees from 2024-07 to 2099-12', () => {
        const expected = OVERRIDE_AMOUNT + getMonthsRange('2024-07', '2099-12').length * REGULAR_AMOUNT;
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC08 — Override set, payment strictly after override date', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC08).first();
    });

    it('outstanding ≈ override_amount + feesAfterOverride − payment', () => {
        const expected = OVERRIDE_AMOUNT + getMonthsRange('2024-07', '2099-12').length * REGULAR_AMOUNT - TC08_PAYMENT;
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC09 — No override, 12 payments covering 2024', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC09).first();
    });

    it('outstanding ≈ total_due − 12 paid months', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2099-12').length - REGULAR_AMOUNT * 12;
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
    it('override_amount is null', () => {
        expect(row.override_amount).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC10 — calcEndMonth pinned to 2099-12 by sentinel', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC10).first();
    });

    it('outstanding ≈ total_due − 6 paid months (Jan–Jun 2024)', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2099-12').length - REGULAR_AMOUNT * 6;
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
    it('unpaid_months contains 2024-07', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-07');
    });
    it('unpaid_months does not contain 2024-01..2024-06', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        for (const m of ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06']) {
            expect(unpaid).not.toContain(m);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC12 — Canceled on 2024-05-20 (19 days Active → May is charged)', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC12).first();
    });

    it('total_calculated_due ≈ REGULAR_AMOUNT × months effectiveStart..2024-05', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2024-05').length;
        expect(row.total_calculated_due).toBeCloseTo(expected, 2);
    });
    it('unpaid_months contains 2024-05', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-05');
    });
    it('unpaid_months does not contain 2024-06 or later', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        expect(unpaid).not.toContain('2024-06');
        expect(unpaid).not.toContain('2025-01');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC13 — Reactivated on 2024-05-10 (22 days Active → May is charged)', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC13).first();
    });

    it('total_calculated_due ≈ REGULAR_AMOUNT × months 2024-05..2099-12', () => {
        const expected = REGULAR_AMOUNT * getMonthsRange('2024-05', '2099-12').length;
        expect(row.total_calculated_due).toBeCloseTo(expected, 2);
    });
    it('unpaid_months does not contain 2024-01..2024-04', () => {
        const unpaid = JSON.parse(row.unpaid_months);
        for (const m of ['2024-01', '2024-02', '2024-03', '2024-04']) {
            expect(unpaid).not.toContain(m);
        }
    });
    it('unpaid_months contains 2024-05', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-05');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC-A — Partial payment (40% of regular) in 2024-03', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC_A).first();
    });

    it('outstanding ≈ total_due − partial_payment', () => {
        const totalDue = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2099-12').length;
        expect(row.outstanding).toBeCloseTo(totalDue - TC_A_PARTIAL, 2);
    });
    it('unpaid_months contains 2024-03 (partial month is still a calendar deficit)', () => {
        expect(JSON.parse(row.unpaid_months)).toContain('2024-03');
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC-B — 3 transactions in 2024-05 summing to REGULAR_AMOUNT (month fully paid)', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC_B).first();
    });

    it('TC-B transactions sum to REGULAR_AMOUNT', () => {
        expect(TC_B_TOTAL).toBeCloseTo(REGULAR_AMOUNT, 2);
    });
    it('unpaid_months does not contain 2024-05', () => {
        expect(JSON.parse(row.unpaid_months)).not.toContain('2024-05');
    });
    it('outstanding ≈ REGULAR_AMOUNT × (total months − 1)', () => {
        const expected = REGULAR_AMOUNT * (getMonthsRange(EFFECTIVE_START, '2099-12').length - 1);
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC-C — Payment in 2019-12 (before CALC_START_MONTH)', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC_C).first();
    });

    it('total_paid equals the seeded payment amount', () => {
        expect(row.total_paid).toBeCloseTo(TC_C_PAID, 2);
    });
    it('outstanding ≈ total_due − payment (predated payment still reduces outstanding)', () => {
        const totalDue = REGULAR_AMOUNT * getMonthsRange(EFFECTIVE_START, '2099-12').length;
        expect(row.outstanding).toBeCloseTo(totalDue - TC_C_PAID, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC-F — Override boundary: on-date transaction excluded, next-day included', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC_F).first();
    });

    it('outstanding ≈ override_amount + feesAfterOverride − post-override payment only', () => {
        const expected = OVERRIDE_AMOUNT + getMonthsRange('2024-07', '2099-12').length * REGULAR_AMOUNT - TC_F_PAYMENT;
        expect(row.outstanding).toBeCloseTo(expected, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TC-G — Canceled member, no audit log, has transactions', () => {
    let row;
    beforeAll(async () => {
        row = await db('member_fees_due').where('member_id', TC.TC_G).first();
    });

    it('total_calculated_due ≈ 0 (Canceled for all months via default)', () => {
        expect(row.total_calculated_due).toBeCloseTo(0, 2);
    });
    it('total_paid ≈ 3 × REGULAR_AMOUNT', () => {
        expect(row.total_paid).toBeCloseTo(REGULAR_AMOUNT * 3, 2);
    });
    it('outstanding ≈ −3 × REGULAR_AMOUNT', () => {
        expect(row.outstanding).toBeCloseTo(-REGULAR_AMOUNT * 3, 2);
    });
    it('unpaid_months = []', () => {
        expect(JSON.parse(row.unpaid_months)).toEqual([]);
    });
});
