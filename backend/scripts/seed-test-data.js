'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { db } = require('../db');

const TC = {
    TC01: 10001, TC02: 10002, TC03: 10003, TC04: 10004, TC05: 10005,
    TC06: 10006, TC07: 10007, TC08: 10008, TC09: 10009, TC10: 10010,
    TC12: 10012, TC13: 10013, TC_A: 10014, TC_B: 10015, TC_C: 10016,
    TC_F: 10017, TC_G: 10018, SENTINEL: 10099,
};

async function main() {
    // ── 1. Collision check ────────────────────────────────────────────────
    const existing = await db('members').where('id', '>=', 10001).first();
    if (existing) {
        console.error('ERROR: Test members already exist. Run npm run test:reset first.');
        process.exit(1);
    }

    const now = new Date().toISOString();

    // ── 2. Fee settings ───────────────────────────────────────────────────
    const allFeeSettings = await db('fee_settings').orderBy('valid_from', 'asc');
    const covering = allFeeSettings.find(
        r => r.valid_from <= '2024-01' && (r.valid_to === null || r.valid_to >= '2024-01')
    );

    let REGULAR_AMOUNT, STUDENT_AMOUNT;

    if (covering) {
        REGULAR_AMOUNT = covering.regular_amount;
        STUDENT_AMOUNT = covering.student_amount;
        console.log(`Using existing fee_settings: regular=${REGULAR_AMOUNT} student=${STUDENT_AMOUNT} (valid_from=${covering.valid_from})`);
    } else {
        const futureRow = allFeeSettings.find(r => r.valid_from > '2024-01');
        if (futureRow) {
            console.error(
                `ERROR: Cannot insert fee_settings for 2024-01 — a row with ` +
                `valid_from='${futureRow.valid_from}' already exists. ` +
                `Insertion would violate the contiguous-period constraint.`
            );
            process.exit(1);
        }
        REGULAR_AMOUNT = 500;
        STUDENT_AMOUNT = 300;
        await db('fee_settings').insert({
            valid_from: '2024-01',
            valid_to: null,
            regular_amount: REGULAR_AMOUNT,
            student_amount: STUDENT_AMOUNT,
            created_at: now,
        });
        console.log(`Inserted fee_settings: 2024-01, regular=${REGULAR_AMOUNT} student=${STUDENT_AMOUNT}`);
    }

    // TC-A partial amount (40% of regular, always < REGULAR_AMOUNT)
    const TC_A_PARTIAL = Math.round(REGULAR_AMOUNT * 0.4);
    // TC-B: three amounts summing exactly to REGULAR_AMOUNT
    const TC_B_1 = Math.round(REGULAR_AMOUNT * 0.4);
    const TC_B_2 = Math.round(REGULAR_AMOUNT * 0.4);
    const TC_B_3 = REGULAR_AMOUNT - TC_B_1 - TC_B_2;
    // TC-F: two payments straddling override_at
    const TC_F_AMT = Math.round(REGULAR_AMOUNT * 0.6);

    // ── 3. Membership fee category ────────────────────────────────────────
    const membershipCat = await db('transaction_categories')
        .where('is_membership_fee', true)
        .first();
    let MEMBERSHIP_CAT_ID;
    if (membershipCat) {
        MEMBERSHIP_CAT_ID = membershipCat.id;
    } else {
        const [catId] = await db('transaction_categories').insert({
            name: 'TEST Membership Fee',
            color: '#22c55e',
            is_membership_fee: 1,
            created_at: now,
        });
        MEMBERSHIP_CAT_ID = catId;
        console.log(`Inserted membership fee category id=${MEMBERSHIP_CAT_ID}`);
    }

    // Non-membership category for sentinel
    const nonMembershipCat = await db('transaction_categories')
        .where('is_membership_fee', false)
        .first();
    const SENTINEL_CAT_ID = nonMembershipCat ? nonMembershipCat.id : null;

    // ── 4. Members ────────────────────────────────────────────────────────
    const memberRows = [
        { id: TC.SENTINEL, name: 'SENTINEL', surname: 'TEST', email: 'sentinel@test.invalid', status: 'Canceled', member_type: 'regular' },
        { id: TC.TC01, name: 'TC01', surname: 'TEST', email: 'tc01@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC02, name: 'TC02', surname: 'TEST', email: 'tc02@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC03, name: 'TC03', surname: 'TEST', email: 'tc03@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC04, name: 'TC04', surname: 'TEST', email: 'tc04@test.invalid', status: 'Canceled', member_type: 'regular' },
        { id: TC.TC05, name: 'TC05', surname: 'TEST', email: 'tc05@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC06, name: 'TC06', surname: 'TEST', email: 'tc06@test.invalid', status: 'Active', member_type: 'student' },
        { id: TC.TC07, name: 'TC07', surname: 'TEST', email: 'tc07@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC08, name: 'TC08', surname: 'TEST', email: 'tc08@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC09, name: 'TC09', surname: 'TEST', email: 'tc09@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC10, name: 'TC10', surname: 'TEST', email: 'tc10@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC12, name: 'TC12', surname: 'TEST', email: 'tc12@test.invalid', status: 'Canceled', member_type: 'regular' },
        { id: TC.TC13, name: 'TC13', surname: 'TEST', email: 'tc13@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC_A, name: 'TC-A', surname: 'TEST', email: 'tc-a@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC_B, name: 'TC-B', surname: 'TEST', email: 'tc-b@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC_C, name: 'TC-C', surname: 'TEST', email: 'tc-c@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC_F, name: 'TC-F', surname: 'TEST', email: 'tc-f@test.invalid', status: 'Active', member_type: 'regular' },
        { id: TC.TC_G, name: 'TC-G', surname: 'TEST', email: 'tc-g@test.invalid', status: 'Canceled', member_type: 'regular' },
    ].map(m => ({ ...m, group_id: null, phone: null, gdpr_consent: 0, created_at: now }));

    await db('members').insert(memberRows);
    console.log(`Inserted ${memberRows.length} members`);

    // ── 5. Transactions ───────────────────────────────────────────────────
    const transactions = [];

    // Sentinel
    transactions.push({
        unique_hash: 'TEST-SENTINEL',
        transaction_type: 'Test',
        transaction_date: '2099-12-31',
        amount: 0,
        member_id: TC.SENTINEL,
        category_id: SENTINEL_CAT_ID,
        created_at: now,
    });

    // TC01 — 12 monthly payments
    for (let m = 1; m <= 12; m++) {
        const mon = `2024-${String(m).padStart(2, '0')}`;
        transactions.push({ unique_hash: `TEST-TC01-${mon}`, transaction_type: 'Test', transaction_date: `${mon}-15`, amount: REGULAR_AMOUNT, member_id: TC.TC01, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    }

    // TC03 — 10 monthly payments (skip 03 and 06)
    for (let m = 1; m <= 12; m++) {
        if (m === 3 || m === 6) continue;
        const mon = `2024-${String(m).padStart(2, '0')}`;
        transactions.push({ unique_hash: `TEST-TC03-${mon}`, transaction_type: 'Test', transaction_date: `${mon}-15`, amount: REGULAR_AMOUNT, member_id: TC.TC03, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    }

    // TC06 — 12 monthly payments at regular rate
    for (let m = 1; m <= 12; m++) {
        const mon = `2024-${String(m).padStart(2, '0')}`;
        transactions.push({ unique_hash: `TEST-TC06-${mon}`, transaction_type: 'Test', transaction_date: `${mon}-15`, amount: REGULAR_AMOUNT, member_id: TC.TC06, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    }

    // TC08 — 1 payment after override date
    transactions.push({ unique_hash: 'TEST-TC08-1', transaction_type: 'Test', transaction_date: '2024-07-15', amount: Math.round(REGULAR_AMOUNT * 0.4), member_id: TC.TC08, category_id: MEMBERSHIP_CAT_ID, created_at: now });

    // TC09 — 12 monthly payments
    for (let m = 1; m <= 12; m++) {
        const mon = `2024-${String(m).padStart(2, '0')}`;
        transactions.push({ unique_hash: `TEST-TC09-${mon}`, transaction_type: 'Test', transaction_date: `${mon}-15`, amount: REGULAR_AMOUNT, member_id: TC.TC09, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    }

    // TC10 — 6 payments Jan–Jun 2024
    for (let m = 1; m <= 6; m++) {
        const mon = `2024-${String(m).padStart(2, '0')}`;
        transactions.push({ unique_hash: `TEST-TC10-${mon}`, transaction_type: 'Test', transaction_date: `${mon}-15`, amount: REGULAR_AMOUNT, member_id: TC.TC10, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    }

    // TC-A — partial payment in March
    transactions.push({ unique_hash: 'TEST-TC-A-1', transaction_type: 'Test', transaction_date: '2024-03-15', amount: TC_A_PARTIAL, member_id: TC.TC_A, category_id: MEMBERSHIP_CAT_ID, created_at: now });

    // TC-B — 3 transactions in May summing to REGULAR_AMOUNT
    transactions.push({ unique_hash: 'TEST-TC-B-1', transaction_type: 'Test', transaction_date: '2024-05-05', amount: TC_B_1, member_id: TC.TC_B, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    transactions.push({ unique_hash: 'TEST-TC-B-2', transaction_type: 'Test', transaction_date: '2024-05-15', amount: TC_B_2, member_id: TC.TC_B, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    transactions.push({ unique_hash: 'TEST-TC-B-3', transaction_type: 'Test', transaction_date: '2024-05-25', amount: TC_B_3, member_id: TC.TC_B, category_id: MEMBERSHIP_CAT_ID, created_at: now });

    // TC-C — payment predating CALC_START_MONTH
    transactions.push({ unique_hash: 'TEST-TC-C-1', transaction_type: 'Test', transaction_date: '2019-12-15', amount: REGULAR_AMOUNT, member_id: TC.TC_C, category_id: MEMBERSHIP_CAT_ID, created_at: now });

    // TC-F — two payments straddling override_at='2024-06-30'
    transactions.push({ unique_hash: 'TEST-TC-F-1', transaction_type: 'Test', transaction_date: '2024-06-30', amount: TC_F_AMT, member_id: TC.TC_F, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    transactions.push({ unique_hash: 'TEST-TC-F-2', transaction_type: 'Test', transaction_date: '2024-07-01', amount: TC_F_AMT, member_id: TC.TC_F, category_id: MEMBERSHIP_CAT_ID, created_at: now });

    // TC-G — 3 payments Jan–Mar 2024 (member is Canceled, no audit log)
    for (let m = 1; m <= 3; m++) {
        const mon = `2024-${String(m).padStart(2, '0')}`;
        transactions.push({ unique_hash: `TEST-TC-G-${mon}`, transaction_type: 'Test', transaction_date: `${mon}-15`, amount: REGULAR_AMOUNT, member_id: TC.TC_G, category_id: MEMBERSHIP_CAT_ID, created_at: now });
    }

    await db('transactions').insert(transactions);
    console.log(`Inserted ${transactions.length} transactions`);

    // ── 6. Audit log entries ──────────────────────────────────────────────
    const auditEntries = [
        { member_id: TC.TC04, field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2024-06-01T00:00:00.000Z' },
        { member_id: TC.TC05, field: 'status', old_value: 'Canceled', new_value: 'Active', changed_at: '2024-04-01T00:00:00.000Z' },
        { member_id: TC.TC06, field: 'type', old_value: 'regular', new_value: 'student', changed_at: '2024-07-01T00:00:00.000Z' },
        { member_id: TC.TC12, field: 'status', old_value: 'Active', new_value: 'Canceled', changed_at: '2024-05-20T00:00:00.000Z' },
        { member_id: TC.TC13, field: 'status', old_value: 'Canceled', new_value: 'Active', changed_at: '2024-05-10T00:00:00.000Z' },
    ];

    await db('member_audit_log').insert(auditEntries);
    console.log(`Inserted ${auditEntries.length} audit_log entries`);

    // ── 7. Pre-seed member_fees_due for override scenarios ────────────────
    const TC08_PAYMENT = Math.round(REGULAR_AMOUNT * 0.4);
    const OVERRIDE_BASE = REGULAR_AMOUNT; // override_amount = 1 month's fee

    const overrideRows = [
        {
            member_id: TC.TC07,
            total_calculated_due: 0,
            total_paid: 0,
            outstanding: 0,
            unpaid_months: '[]',
            override_amount: OVERRIDE_BASE,
            override_at: '2024-06-01T00:00:00.000Z',
            override_note: 'TC07 test override',
            recalculated_at: now,
        },
        {
            member_id: TC.TC08,
            total_calculated_due: 0,
            total_paid: 0,
            outstanding: 0,
            unpaid_months: '[]',
            override_amount: OVERRIDE_BASE,
            override_at: '2024-06-01T00:00:00.000Z',
            override_note: 'TC08 test override',
            recalculated_at: now,
        },
        {
            member_id: TC.TC_F,
            total_calculated_due: 0,
            total_paid: 0,
            outstanding: 0,
            unpaid_months: '[]',
            override_amount: OVERRIDE_BASE,
            override_at: '2024-06-30T00:00:00.000Z',
            override_note: 'TC-F boundary test',
            recalculated_at: now,
        },
    ];

    await db('member_fees_due').insert(overrideRows);
    console.log(`Inserted ${overrideRows.length} member_fees_due override rows`);

    console.log(`\nFee amounts used: regular=${REGULAR_AMOUNT}, student=${STUDENT_AMOUNT}`);
    console.log(`TC-A partial payment: ${TC_A_PARTIAL}, TC-B split: ${TC_B_1}+${TC_B_2}+${TC_B_3}=${TC_B_1+TC_B_2+TC_B_3}`);
    console.log(`Override base amount: ${OVERRIDE_BASE}, TC08 post-override payment: ${TC08_PAYMENT}`);
    console.log('\nSeed complete. Run npm run test:integration to execute tests.');
    await db.destroy();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
