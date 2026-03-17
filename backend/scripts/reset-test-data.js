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
    // Delete in FK-safe order

    const txDeleted = await db('transactions')
        .where('unique_hash', 'like', 'TEST-%')
        .delete();
    console.log(`Deleted ${txDeleted} transactions`);

    const auditDeleted = await db('member_audit_log')
        .where('member_id', '>=', 10001)
        .delete();
    console.log(`Deleted ${auditDeleted} member_audit_log rows`);

    const feesDeleted = await db('member_fees_due')
        .where('member_id', '>=', 10001)
        .delete();
    console.log(`Deleted ${feesDeleted} member_fees_due rows`);

    const membersDeleted = await db('members')
        .where('id', '>=', 10001)
        .delete();
    console.log(`Deleted ${membersDeleted} members`);

    console.log('\nReset complete.');
    await db.destroy();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
