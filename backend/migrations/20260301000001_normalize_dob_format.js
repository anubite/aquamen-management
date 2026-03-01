exports.up = async function (knex) {
    const members = await knex('members')
        .whereNotNull('date_of_birth')
        .select('id', 'date_of_birth');

    for (const m of members) {
        const parts = String(m.date_of_birth).split('.');
        if (parts.length === 3 && parts[2].length === 4) {
            const normalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            await knex('members').where('id', m.id).update({ date_of_birth: normalized });
        }
    }
};

exports.down = function () {
    // Intentionally irreversible — cannot recover original mixed formats
};
