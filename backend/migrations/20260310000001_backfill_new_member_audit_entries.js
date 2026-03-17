exports.up = async function(knex) {
    const targetIds = [1196, 1197];
    for (const id of targetIds) {
        const member = await knex('members').where({ id }).first();
        if (!member) continue;
        const existing = await knex('member_audit_log')
            .where({ member_id: id, field: 'status' })
            .first();
        if (existing) continue;
        await knex('member_audit_log').insert({
            member_id: id,
            field: 'status',
            old_value: 'Canceled',
            new_value: member.status,
            changed_at: member.created_at
        });
    }
};

exports.down = async function(knex) {
    await knex('member_audit_log')
        .whereIn('member_id', [1196, 1197])
        .where({ field: 'status', old_value: 'Canceled' })
        .delete();
};
