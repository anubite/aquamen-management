'use strict';

/**
 * FeeCalculator — membership fee calculation engine.
 *
 * Design: all core logic lives in pure, stateless functions that accept
 * in-memory data and return results.  The DB-aware recalculateMembers()
 * function fetches data and delegates to the pure layer.
 *
 * Calculation start boundary: 2020-01.  No obligations are generated
 * for months before this date.
 *
 * Status default (no audit log): 'Active'
 * Type default   (no audit log): member.member_type (current value)
 *
 * Unpaid-months algorithm: FIFO.  The total paid pool clears the oldest
 * obligations first, regardless of which calendar month a payment was
 * recorded in.
 *
 * Override logic:  override_amount represents how much the member owed
 * at the moment the admin created the override.  Any real membership-fee
 * payment dated STRICTLY AFTER override_at reduces that outstanding.
 * Backdated transactions (transaction_date ≤ override_at) are excluded.
 */

const CALC_START_MONTH = '2020-01';

// ─── Date helpers ──────────────────────────────────────────────────────────

function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

// YYYY-MM + day → YYYY-MM-DD
function monthDay(month, day) {
    return `${month}-${String(day).padStart(2, '0')}`;
}

// Normalise any timestamp / ISO string to YYYY-MM-DD
function toDateStr(ts) {
    if (!ts) return null;
    // If it already looks like YYYY-MM-DD take it directly to avoid TZ drift
    if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
    return new Date(ts).toISOString().slice(0, 10);
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Returns an array of YYYY-MM strings from startMonth to endMonth inclusive.
 */
function getMonthsRange(startMonth, endMonth) {
    const months = [];
    let [y, m] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        if (++m > 12) { m = 1; y++; }
    }
    return months;
}

/**
 * Add n months to a YYYY-MM string (n may be negative).
 */
function addMonths(month, n) {
    let [y, m] = month.split('-').map(Number);
    m += n;
    while (m > 12) { m -= 12; y++; }
    while (m < 1)  { m += 12; y--; }
    return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Returns the member's status ('Active' | 'Canceled') for the given YYYY-MM
 * month using majority-of-days rule.
 *
 * @param {Array}  auditLog - ALL audit entries for this member
 *                            { field, old_value, new_value, changed_at }
 * @param {string} month    - YYYY-MM
 */
function getMemberStatusForMonth(auditLog, currentStatus, month) {
    const daysInMonth = getDaysInMonth(month);
    const monthStartStr = monthDay(month, 1);
    const monthEndStr   = monthDay(month, daysInMonth);

    const entries = auditLog
        .filter(e => e.field === 'status')
        .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

    // Status at the very start of the month = last change recorded BEFORE month start
    let statusAtStart = currentStatus; // default: use member's current status
    for (const e of entries) {
        if (toDateStr(e.changed_at) < monthStartStr) {
            statusAtStart = e.new_value;
        }
    }

    // Changes that fall WITHIN the month
    const inMonth = entries.filter(e => {
        const d = toDateStr(e.changed_at);
        return d >= monthStartStr && d <= monthEndStr;
    });

    if (inMonth.length === 0) return statusAtStart;

    // Walk through every day and apply changes as they arrive
    const counts = {};
    let cur = statusAtStart;
    let ci  = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = monthDay(month, day);
        while (ci < inMonth.length && toDateStr(inMonth[ci].changed_at) <= dayStr) {
            cur = inMonth[ci].new_value;
            ci++;
        }
        counts[cur] = (counts[cur] || 0) + 1;
    }

    // Status with most days wins; exact tie → Active (err on the side of charging)
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return 'Active';
    return sorted[0][0];
}

/**
 * Returns the member's type ('regular' | 'student') for the given YYYY-MM
 * month using majority-of-days rule.
 *
 * @param {Array}  auditLog    - ALL audit entries for this member
 * @param {string} currentType - member's current type (used as default)
 * @param {string} month       - YYYY-MM
 */
function getMemberTypeForMonth(auditLog, currentType, month) {
    const daysInMonth = getDaysInMonth(month);
    const monthStartStr = monthDay(month, 1);
    const monthEndStr   = monthDay(month, daysInMonth);

    const entries = auditLog
        .filter(e => e.field === 'type')
        .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

    // Entries strictly before this month
    const beforeMonth = entries.filter(e => toDateStr(e.changed_at) < monthStartStr);

    let typeAtStart;
    if (beforeMonth.length > 0) {
        // Latest entry before month start determines the type at month start
        typeAtStart = beforeMonth[beforeMonth.length - 1].new_value;
    } else if (entries.length > 0) {
        // No entries before month, but there are future entries: the first entry's
        // old_value tells us what type was in use before any change was made
        typeAtStart = entries[0].old_value;
    } else {
        // No audit log at all → spec: "assume current type was there forever"
        typeAtStart = currentType;
    }

    const inMonth = entries.filter(e => {
        const d = toDateStr(e.changed_at);
        return d >= monthStartStr && d <= monthEndStr;
    });

    if (inMonth.length === 0) return typeAtStart;

    const counts = {};
    let cur = typeAtStart;
    let ci  = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = monthDay(month, day);
        while (ci < inMonth.length && toDateStr(inMonth[ci].changed_at) <= dayStr) {
            cur = inMonth[ci].new_value;
            ci++;
        }
        counts[cur] = (counts[cur] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
}

/**
 * Returns the fee amount (number) for a given type and month.
 * Returns 0 when no matching fee-settings row exists.
 *
 * @param {Array}  feeSettings - { valid_from, valid_to, regular_amount, student_amount }
 * @param {string} type        - 'regular' | 'student'
 * @param {string} month       - YYYY-MM
 */
function getFeeForMonth(feeSettings, type, month) {
    const s = feeSettings.find(
        r => r.valid_from <= month && (r.valid_to === null || r.valid_to >= month)
    );
    if (!s) return 0;
    return type === 'student' ? s.student_amount : s.regular_amount;
}

/**
 * Calculates fee obligations and payment status for one member.
 * Pure — accepts all necessary data in-memory; never touches the DB.
 *
 * @param {Object} member
 *   { id, status, member_type }
 * @param {Array}  auditLog
 *   All audit_log entries for this member.
 * @param {Array}  feeSettings
 *   All fee_settings rows.
 * @param {Array}  membershipTransactions
 *   Membership-fee transactions for this member.
 *   Each: { transaction_date: 'YYYY-MM-DD', amount: number }
 * @param {Object|null} override
 *   { override_amount: number, override_at: string } — or null
 * @param {string} [endMonth]
 *   Override current month (YYYY-MM).  Useful in tests.
 *
 * @returns {{
 *   totalCalculatedDue: number,
 *   totalPaid: number,
 *   outstanding: number,
 *   unpaidMonths: string[],
 *   monthData: Object   // YYYY-MM → { amount_due, amount_paid, is_active }
 * }}
 */
function calculateMemberFees(member, auditLog, feeSettings, membershipTransactions, override = null, endMonth = null, startMonth = null) {
    const currentMonth = endMonth || getCurrentMonth();
    const effectiveStart = startMonth || CALC_START_MONTH;
    const months = getMonthsRange(effectiveStart, currentMonth);

    // ── Per-month obligations ──────────────────────────────────────
    let totalCalculatedDue = 0;
    const obligations = {}; // YYYY-MM → amount_due (0 = not active)

    for (const month of months) {
        const status = getMemberStatusForMonth(auditLog, member.status, month);
        if (status === 'Canceled') {
            obligations[month] = 0;
            continue;
        }
        const type = getMemberTypeForMonth(auditLog, member.member_type, month);
        const fee  = getFeeForMonth(feeSettings, type, month);
        obligations[month] = fee;
        totalCalculatedDue += fee;
    }

    // ── Total paid (all membership-fee transactions, all time) ─────
    const totalPaid = membershipTransactions.reduce((s, t) => s + t.amount, 0);

    // ── FIFO unpaid-months: payments clear oldest obligations first ─
    // Per-calendar-month paid (for display only)
    const paidByMonth = {};
    for (const t of membershipTransactions) {
        const mon = t.transaction_date.slice(0, 7); // YYYY-MM
        paidByMonth[mon] = (paidByMonth[mon] || 0) + t.amount;
    }

    let cumulativeDue = 0;
    const unpaidMonths = [];
    const monthData    = {};

    for (const month of months) {
        const amountDue      = obligations[month] || 0;
        const amountPaid     = paidByMonth[month] || 0;
        cumulativeDue       += amountDue;

        monthData[month] = {
            amount_due:  amountDue,
            amount_paid: amountPaid,
            is_active:   amountDue > 0,
        };

        if (amountDue > 0 && totalPaid < cumulativeDue) {
            unpaidMonths.push(month);
        }
    }

    // ── Outstanding (with optional override) ──────────────────────
    let outstanding;
    if (override && override.override_amount != null) {
        const overrideDateStr = toDateStr(override.override_at);
        const paymentsAfter  = membershipTransactions
            .filter(t => t.transaction_date > overrideDateStr)
            .reduce((s, t) => s + t.amount, 0);
        outstanding = override.override_amount - paymentsAfter;
    } else {
        outstanding = totalCalculatedDue - totalPaid;
    }

    return { totalCalculatedDue, totalPaid, outstanding, unpaidMonths, monthData };
}

// ─── DB-aware recalculation ────────────────────────────────────────────────

/**
 * Recalculates member_fees_due for all members (or a subset).
 * Preserves any existing override values — only outstanding is re-derived.
 *
 * @param {object}        db        - Knex instance
 * @param {number[]|null} memberIds - if null, recalculate all
 * @returns {number} count of upserted rows
 */
async function recalculateMembers(db, memberIds = null) {
    let q = db('members').select('id', 'status', 'member_type');
    if (memberIds) q = q.whereIn('id', memberIds);
    const members = await q;
    if (members.length === 0) return 0;

    const ids = members.map(m => m.id);

    const [feeSettings, auditLog, membershipCatRows, existingDue] = await Promise.all([
        db('fee_settings').select('*').orderBy('valid_from', 'asc'),
        db('member_audit_log').whereIn('member_id', ids).select('member_id', 'field', 'old_value', 'new_value', 'changed_at').orderBy('changed_at', 'asc'),
        db('transaction_categories').where('is_membership_fee', true).select('id'),
        db('member_fees_due').whereIn('member_id', ids).select('member_id', 'override_amount', 'override_at', 'override_note'),
    ]);

    const catIds        = membershipCatRows.map(r => r.id);
    const overrideMap   = Object.fromEntries(existingDue.map(r => [r.member_id, r]));

    const allTx = catIds.length > 0
        ? await db('transactions').whereIn('member_id', ids).whereIn('category_id', catIds).select('member_id', 'transaction_date', 'amount')
        : [];

    // Start calculations from the month of the first membership-fee transaction in the system
    const firstTxRow = catIds.length > 0
        ? await db('transactions').whereIn('category_id', catIds).min('transaction_date as minDate').first()
        : null;
    const firstTxMonth = firstTxRow?.minDate ? firstTxRow.minDate.slice(0, 7) : null;
    const effectiveStart = firstTxMonth && firstTxMonth > CALC_START_MONTH
        ? firstTxMonth
        : CALC_START_MONTH;

    // Cap fee calculations at the last imported transaction date, not today
    const lastTxRow = await db('transactions').max('transaction_date as maxDate').first();
    const lastTxMonth = lastTxRow?.maxDate ? lastTxRow.maxDate.slice(0, 7) : null;
    const calcEndMonth = lastTxMonth || getCurrentMonth();

    let updated = 0;
    const now = new Date().toISOString();

    for (const member of members) {
        const log      = auditLog.filter(e => e.member_id === member.id);
        const txs      = allTx.filter(t => t.member_id === member.id);
        const override = overrideMap[member.id] || null;

        const result = calculateMemberFees(member, log, feeSettings, txs, override, calcEndMonth, effectiveStart);

        const row = {
            member_id:            member.id,
            total_calculated_due: result.totalCalculatedDue,
            total_paid:           result.totalPaid,
            outstanding:          result.outstanding,
            unpaid_months:        JSON.stringify(result.unpaidMonths),
            override_amount:      override?.override_amount ?? null,
            override_at:          override?.override_at ?? null,
            override_note:        override?.override_note ?? null,
            recalculated_at:      now,
        };

        const existing = await db('member_fees_due').where('member_id', member.id).first();
        if (existing) {
            await db('member_fees_due').where('member_id', member.id).update(row);
        } else {
            await db('member_fees_due').insert(row);
        }
        updated++;
    }
    return updated;
}

module.exports = {
    // Constants
    CALC_START_MONTH,
    // Pure helpers (exported for unit tests)
    getMonthsRange,
    addMonths,
    getDaysInMonth,
    getMemberStatusForMonth,
    getMemberTypeForMonth,
    getFeeForMonth,
    calculateMemberFees,
    // DB-aware
    recalculateMembers,
};
