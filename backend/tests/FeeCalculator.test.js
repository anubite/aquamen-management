'use strict';

const {
    getMonthsRange,
    addMonths,
    getDaysInMonth,
    getMemberStatusForMonth,
    getMemberTypeForMonth,
    getFeeForMonth,
    calculateMemberFees,
} = require('../services/FeeCalculator');

// ─── Fixtures ──────────────────────────────────────────────────────────────

const STD_FEE = [
    { valid_from: '2020-01', valid_to: null, regular_amount: 1350, student_amount: 1000 },
];

const REGULAR_MEMBER = { id: 1, status: 'Active', member_type: 'regular' };
const STUDENT_MEMBER = { id: 2, status: 'Active', member_type: 'student' };

// ─── getMonthsRange ────────────────────────────────────────────────────────

describe('getMonthsRange', () => {
    test('single month', () => {
        expect(getMonthsRange('2025-01', '2025-01')).toEqual(['2025-01']);
    });

    test('spans a year boundary', () => {
        const r = getMonthsRange('2024-11', '2025-02');
        expect(r).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
    });

    test('returns empty when start > end', () => {
        expect(getMonthsRange('2025-03', '2025-01')).toEqual([]);
    });

    test('three consecutive months', () => {
        expect(getMonthsRange('2020-01', '2020-03')).toEqual(['2020-01', '2020-02', '2020-03']);
    });
});

// ─── addMonths ─────────────────────────────────────────────────────────────

describe('addMonths', () => {
    test('+1 wraps year', () => expect(addMonths('2024-12', 1)).toBe('2025-01'));
    test('-1 wraps year', () => expect(addMonths('2025-01', -1)).toBe('2024-12'));
    test('+0 is identity', () => expect(addMonths('2025-06', 0)).toBe('2025-06'));
});

// ─── getDaysInMonth ────────────────────────────────────────────────────────

describe('getDaysInMonth', () => {
    test('January has 31 days',  () => expect(getDaysInMonth('2025-01')).toBe(31));
    test('February 2024 (leap)', () => expect(getDaysInMonth('2024-02')).toBe(29));
    test('February 2025 (non-leap)', () => expect(getDaysInMonth('2025-02')).toBe(28));
    test('June has 30 days',     () => expect(getDaysInMonth('2025-06')).toBe(30));
});

// ─── getMemberStatusForMonth ───────────────────────────────────────────────

describe('getMemberStatusForMonth', () => {
    test('1 – no audit log, active member → defaults to current status (Active)', () => {
        expect(getMemberStatusForMonth([], 'Active', '2024-06')).toBe('Active');
    });

    test('1b – no audit log, canceled member → defaults to current status (Canceled)', () => {
        expect(getMemberStatusForMonth([], 'Canceled', '2024-06')).toBe('Canceled');
    });

    test('2 – always Active (log change was years before period)', () => {
        // Change to Active recorded before 2020-01 has no practical effect
        const log = [{ field: 'status', old_value: 'Canceled', new_value: 'Active', changed_at: '2019-03-01' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Active');
    });

    test('3 – always Canceled (change before period start)', () => {
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2019-12-01' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Canceled');
    });

    test('4 – canceled majority of month (canceled day 5 of 30, 26 days Canceled)', () => {
        // June 2024 has 30 days.  Active days 1–4, Canceled from day 5 → 26 days Canceled
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2024-06-05' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Canceled');
    });

    test('5 – active majority of month (canceled day 21 of 30, 20 days Active)', () => {
        // Active days 1–20, Canceled from day 21 → 10 days Canceled, 20 Active
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2024-06-21' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Active');
    });

    test('6 – exact tie (15 Active / 15 Canceled) → Active', () => {
        // June 2024 (30 days): change on day 16 → Active 1–15, Canceled 16–30
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2024-06-16' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Active');
    });

    test('7 – status from a previous month carries into this month', () => {
        // Canceled in May, no change in June → still Canceled
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2024-05-10' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Canceled');
    });

    test('8 – ignores type-field entries', () => {
        const log = [{ field: 'type', old_value: 'regular', new_value: 'student', changed_at: '2024-06-10' }];
        expect(getMemberStatusForMonth(log, 'Active', '2024-06')).toBe('Active');
    });

    test('8b – entry only in a future month → old_value used as status at start', () => {
        // Member is currently Canceled but was Active until March 2026.
        // For January 2026 (before the cancellation), must return Active.
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2026-03-15' }];
        expect(getMemberStatusForMonth(log, 'Canceled', '2026-01')).toBe('Active');
    });
});

// ─── getMemberTypeForMonth ─────────────────────────────────────────────────

describe('getMemberTypeForMonth', () => {
    test('9 – no audit log → returns currentType', () => {
        expect(getMemberTypeForMonth([], 'student', '2025-01')).toBe('student');
        expect(getMemberTypeForMonth([], 'regular', '2025-01')).toBe('regular');
    });

    test('10 – type change mid-month: regular→student on day 6 of 30 → student (25 days)', () => {
        // Active days 1–5 regular, student from day 6 → 25 student days
        const log = [{ field: 'type', old_value: 'regular', new_value: 'student', changed_at: '2024-06-06' }];
        expect(getMemberTypeForMonth(log, 'student', '2024-06')).toBe('student');
    });

    test('11 – type change after month end → uses type at start', () => {
        const log = [{ field: 'type', old_value: 'regular', new_value: 'student', changed_at: '2024-07-01' }];
        expect(getMemberTypeForMonth(log, 'student', '2024-06')).toBe('regular');
    });
});

// ─── getFeeForMonth ────────────────────────────────────────────────────────

describe('getFeeForMonth', () => {
    test('12 – regular in standard period', () =>
        expect(getFeeForMonth(STD_FEE, 'regular', '2025-01')).toBe(1350));

    test('13 – student in standard period', () =>
        expect(getFeeForMonth(STD_FEE, 'student', '2025-01')).toBe(1000));

    test('14 – month before any fee setting → 0', () =>
        expect(getFeeForMonth(STD_FEE, 'regular', '2019-12')).toBe(0));

    test('15 – fee setting change: correct amounts per period', () => {
        const fees = [
            { valid_from: '2020-01', valid_to: '2020-02', regular_amount: 1200, student_amount: 900 },
            { valid_from: '2020-03', valid_to: null,      regular_amount: 1350, student_amount: 1000 },
        ];
        expect(getFeeForMonth(fees, 'regular', '2020-01')).toBe(1200);
        expect(getFeeForMonth(fees, 'regular', '2020-02')).toBe(1200);
        expect(getFeeForMonth(fees, 'regular', '2020-03')).toBe(1350);
        expect(getFeeForMonth(fees, 'regular', '2025-06')).toBe(1350);
    });
});

// ─── calculateMemberFees ───────────────────────────────────────────────────

describe('calculateMemberFees', () => {
    // We use endMonth = '2020-03' (3 months: Jan, Feb, Mar 2020) in most tests
    // to keep calculation windows deterministic and fast.

    test('16 – active regular member, no payments → all months unpaid', () => {
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, [], null, '2020-03');
        expect(r.totalCalculatedDue).toBe(1350 * 3);
        expect(r.totalPaid).toBe(0);
        expect(r.outstanding).toBe(1350 * 3);
        expect(r.unpaidMonths).toEqual(['2020-01', '2020-02', '2020-03']);
    });

    test('17 – active student member, no payments → student rates', () => {
        const r = calculateMemberFees(STUDENT_MEMBER, [], STD_FEE, [], null, '2020-03');
        expect(r.totalCalculatedDue).toBe(1000 * 3);
        expect(r.outstanding).toBe(1000 * 3);
    });

    test('18 – always canceled → zero obligation', () => {
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2019-12-01' }];
        const r = calculateMemberFees(REGULAR_MEMBER, log, STD_FEE, [], null, '2020-03');
        expect(r.totalCalculatedDue).toBe(0);
        expect(r.outstanding).toBe(0);
        expect(r.unpaidMonths).toEqual([]);
    });

    test('19 – member canceled majority of Jan → Jan skipped', () => {
        // Canceled from Jan 5 → Canceled majority → no Jan fee
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2020-01-05' }];
        const r = calculateMemberFees(REGULAR_MEMBER, log, STD_FEE, [], null, '2020-01');
        expect(r.totalCalculatedDue).toBe(0);
    });

    test('20 – member active majority of Jan (canceled day 21) → Jan fee charged', () => {
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2020-01-21' }];
        const r = calculateMemberFees(REGULAR_MEMBER, log, STD_FEE, [], null, '2020-01');
        expect(r.totalCalculatedDue).toBe(1350);
    });

    test('21 – prepayment: 2 months paid at once in Jan → Jan+Feb paid, Mar unpaid', () => {
        const txs = [{ transaction_date: '2020-01-10', amount: 2700 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2020-03');
        expect(r.totalPaid).toBe(2700);
        expect(r.outstanding).toBe(1350);
        expect(r.unpaidMonths).toEqual(['2020-03']);
    });

    test('22 – annual prepayment: 12 months paid in Jan → 12 months covered', () => {
        const txs = [{ transaction_date: '2020-01-01', amount: 1350 * 12 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2021-01');
        // 2020-01 through 2021-01 = 13 months
        expect(r.totalCalculatedDue).toBe(1350 * 13);
        expect(r.totalPaid).toBe(1350 * 12);
        expect(r.unpaidMonths).toEqual(['2021-01']);
        expect(r.outstanding).toBe(1350);
    });

    test('23 – late payment: 2 months paid in March → March credited, Feb tagged as most-recent unpaid', () => {
        // Payment lands in March (paidByMonth[Mar]=2700). Jan and Feb both show 0 paid → calendar deficits.
        // March has no deficit (2700 > 1350). "From end" tags Feb (most recent deficit month).
        const txs = [{ transaction_date: '2020-03-10', amount: 2700 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2020-03');
        expect(r.unpaidMonths).toEqual(['2020-02']);
        expect(r.outstanding).toBe(1350);
    });

    test('24 – type change: regular→student mid-month (majority student)', () => {
        // Regular Jan 2020 full month (no change in Jan), student from Feb 1
        const log = [{ field: 'type', old_value: 'regular', new_value: 'student', changed_at: '2020-02-01' }];
        const member = { ...REGULAR_MEMBER, member_type: 'student' };
        const r = calculateMemberFees(member, log, STD_FEE, [], null, '2020-02');
        // Jan: regular 1350, Feb: student 1000
        expect(r.totalCalculatedDue).toBe(1350 + 1000);
        expect(r.monthData['2020-01'].amount_due).toBe(1350);
        expect(r.monthData['2020-02'].amount_due).toBe(1000);
    });

    test('25 – fee setting change: old rate for Feb, new rate from Mar', () => {
        const fees = [
            { valid_from: '2020-01', valid_to: '2020-02', regular_amount: 1200, student_amount: 900 },
            { valid_from: '2020-03', valid_to: null,      regular_amount: 1350, student_amount: 1000 },
        ];
        const r = calculateMemberFees(REGULAR_MEMBER, [], fees, [], null, '2020-03');
        expect(r.monthData['2020-01'].amount_due).toBe(1200);
        expect(r.monthData['2020-02'].amount_due).toBe(1200);
        expect(r.monthData['2020-03'].amount_due).toBe(1350);
        expect(r.totalCalculatedDue).toBe(1200 + 1200 + 1350);
    });

    test('26 – no audit log on canceled member → zero fees (defaults to current status Canceled)', () => {
        const canceledMember = { id: 1, status: 'Canceled', member_type: 'regular' };
        const r = calculateMemberFees(canceledMember, [], STD_FEE, [], null, '2020-02');
        expect(r.totalCalculatedDue).toBe(0);
        expect(r.outstanding).toBe(0);
    });

    test('26b – no audit log on active member → charged normally', () => {
        const activeMember = { id: 2, status: 'Active', member_type: 'regular' };
        const r = calculateMemberFees(activeMember, [], STD_FEE, [], null, '2020-02');
        expect(r.totalCalculatedDue).toBe(1350 * 2);
    });

    // ─── Override tests ────────────────────────────────────────────

    test('27 – override: member pays 1350 after override → outstanding reduced', () => {
        const override = { override_amount: 2700, override_at: '2020-06-01' };
        const txs = [{ transaction_date: '2020-06-15', amount: 1350 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-06');
        expect(r.outstanding).toBe(2700 - 1350);
    });

    test('28 – override: backdated transaction (date ≤ override_at) is excluded', () => {
        const override = { override_amount: 2700, override_at: '2020-06-01' };
        // Transaction dated before override_at — must NOT reduce outstanding
        const txs = [{ transaction_date: '2020-05-15', amount: 1350 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-06');
        expect(r.outstanding).toBe(2700); // unchanged
    });

    test('29 – override: transaction ON override_at date is excluded (not strictly after)', () => {
        const override = { override_amount: 2700, override_at: '2020-06-01' };
        const txs = [{ transaction_date: '2020-06-01', amount: 1350 }]; // exact same date
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-06');
        expect(r.outstanding).toBe(2700); // excluded
    });

    test('30 – override: multiple payments after override; post-override month fee is added', () => {
        // overrideMonth='2020-06'. July is after override → feesAfterOverride=1350 (Jul fee).
        // paymentsAfter: Jun-15 (1350) + Jul-10 (1350) = 2700. May-01 excluded (before override_at).
        // outstanding = 5000 + 1350 − 2700 = 3650.
        // Jul fee (1350) and Jul payment (1350) cancel; Jun payment (1350) reduces old debt.
        const override = { override_amount: 5000, override_at: '2020-06-01' };
        const txs = [
            { transaction_date: '2020-06-15', amount: 1350 },
            { transaction_date: '2020-07-10', amount: 1350 },
            { transaction_date: '2020-05-01', amount: 999 }, // before override_at — excluded
        ];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-07');
        expect(r.outstanding).toBe(3650);
    });

    test('31 – override=0 at end of May; exact June payment → outstanding stays 0', () => {
        // override_at is last day of prior month (system always uses last-day-of-month anchor).
        // overrideMonth='2020-05'. June is after override → feesAfterOverride=1350.
        // Member pays exactly 1350 in June. outstanding = 0 + 1350 − 1350 = 0.
        const override = { override_amount: 0, override_at: '2020-05-31' };
        const txs = [{ transaction_date: '2020-06-15', amount: 1350 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-06');
        expect(r.outstanding).toBe(0);
    });

    test('31b – override=0 at end of May; underpayment in June → deficit carried', () => {
        // Pays 800 of 1350 due. outstanding = 0 + 1350 − 800 = 550.
        const override = { override_amount: 0, override_at: '2020-05-31' };
        const txs = [{ transaction_date: '2020-06-15', amount: 800 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-06');
        expect(r.outstanding).toBe(550);
        expect(r.unpaidMonths).toEqual(['2020-06']);
    });

    test('31c – override=0 at end of May; overpayment in June → credit (negative outstanding)', () => {
        // Pays 2000 of 1350 due. outstanding = 0 + 1350 − 2000 = −650.
        const override = { override_amount: 0, override_at: '2020-05-31' };
        const txs = [{ transaction_date: '2020-06-15', amount: 2000 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-06');
        expect(r.outstanding).toBe(-650);
    });

    // ─── monthData & is_active ─────────────────────────────────────

    test('32 – active member with no transactions shows is_active=true and amount_paid=0', () => {
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, [], null, '2020-01');
        expect(r.monthData['2020-01'].is_active).toBe(true);
        expect(r.monthData['2020-01'].amount_paid).toBe(0);
        expect(r.monthData['2020-01'].amount_due).toBe(1350);
    });

    test('33 – canceled month shows is_active=false and amount_due=0', () => {
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2019-12-01' }];
        const r = calculateMemberFees(REGULAR_MEMBER, log, STD_FEE, [], null, '2020-01');
        expect(r.monthData['2020-01'].is_active).toBe(false);
        expect(r.monthData['2020-01'].amount_due).toBe(0);
    });

    // ─── Unpaid-months (newest-first) edge cases ───────────────────

    test('35 – lump-sum in Feb covers 2 months; Mar is the missing month → tagged', () => {
        // Jeremy scenario: member pays large lump sum mid-period; most-recent month is the gap.
        // paidByMonth[Feb]=2700, Jan and Mar each have 0 paid → calendarDeficits [Jan, Mar].
        // "from end": Mar (deficit=1350, acc=1350 ≥ outstanding=1350) → stop → ['2020-03'].
        const txs = [{ transaction_date: '2020-02-10', amount: 2700 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2020-03');
        expect(r.outstanding).toBe(1350);
        expect(r.unpaidMonths).toEqual(['2020-03']);
    });

    test('36 – two months outstanding → both tagged in chronological order', () => {
        // Pays 1350 (only Jan covered). Feb and Mar both deficit. From end: Mar then Feb → ['2020-02','2020-03'].
        const txs = [{ transaction_date: '2020-01-10', amount: 1350 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2020-03');
        expect(r.outstanding).toBe(2700);
        expect(r.unpaidMonths).toEqual(['2020-02', '2020-03']);
    });

    test('37 – fully paid → unpaidMonths empty even with many months', () => {
        const txs = [{ transaction_date: '2020-03-01', amount: 1350 * 3 }];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2020-03');
        expect(r.outstanding).toBe(0);
        expect(r.unpaidMonths).toEqual([]);
    });

    test('38 – override with no post-override payments; outstanding equals override_amount', () => {
        const override = { override_amount: 2700, override_at: '2020-05-31' };
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, [], override, '2020-05');
        // No months after overrideMonth='2020-05' in window '2020-01'..'2020-05'.
        expect(r.outstanding).toBe(2700);
    });

    test('40 – member cancelled mid-period; historical active months still charged, no huge negative', () => {
        // David scenario: Active Jan–Feb, then cancelled Mar 1. Jan+Feb fully paid.
        // Before fix: currentStatus='Canceled' made all months Canceled → outstanding = 0 − 2700 = −2700.
        // After fix: old_value='Active' is used for Jan+Feb → totalCalculatedDue=2700, outstanding=0.
        const log = [{ field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2020-03-01' }];
        const canceledMember = { id: 1, status: 'Canceled', member_type: 'regular' };
        const txs = [
            { transaction_date: '2020-01-10', amount: 1350 },
            { transaction_date: '2020-02-10', amount: 1350 },
        ];
        const r = calculateMemberFees(canceledMember, log, STD_FEE, txs, null, '2020-03');
        expect(r.monthData['2020-01'].is_active).toBe(true);
        expect(r.monthData['2020-02'].is_active).toBe(true);
        expect(r.outstanding).toBeGreaterThanOrEqual(0);
        expect(r.unpaidMonths).toEqual([]);
    });

    test('39 – override non-zero; exact payments for all post-override months → only override debt remains', () => {
        // override_amount=2700 (2 months old debt), override_at='2020-05-31'.
        // Jun + Jul each paid exactly. feesAfterOverride=2700, paymentsAfter=2700 → cancel.
        // outstanding = 2700 + 2700 − 2700 = 2700.
        const override = { override_amount: 2700, override_at: '2020-05-31' };
        const txs = [
            { transaction_date: '2020-06-15', amount: 1350 },
            { transaction_date: '2020-07-15', amount: 1350 },
        ];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, override, '2020-07');
        expect(r.outstanding).toBe(2700);
    });

    test('34 – per-month amount_paid reflects calendar-month transactions', () => {
        const txs = [
            { transaction_date: '2020-01-10', amount: 1350 },
            { transaction_date: '2020-03-05', amount: 500 },
        ];
        const r = calculateMemberFees(REGULAR_MEMBER, [], STD_FEE, txs, null, '2020-03');
        expect(r.monthData['2020-01'].amount_paid).toBe(1350);
        expect(r.monthData['2020-02'].amount_paid).toBe(0);
        expect(r.monthData['2020-03'].amount_paid).toBe(500);
    });
});

/*
 * ─── Additional tests to consider in future milestones ───────────────────
 *
 * Integration (supertest):
 *   - POST /api/fee-settings → GET /api/fee-settings → verify previous period closed
 *   - POST /api/fee-settings (gap in dates) → expect 400
 *
 * Full import cycle:
 *   - Upload XLSX with membership-fee transactions → auto-categorize →
 *     POST /api/overview/recalculate → GET /api/overview/pivot → verify outstanding
 *
 * Frontend (React Testing Library):
 *   - OverviewDashboard: renders member cards on mobile breakpoint
 *   - Override modal: opens, submits, shows updated outstanding
 *   - FeeSettings: adding a new period auto-closes the previous one in the UI
 */
