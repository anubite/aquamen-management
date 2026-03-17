exports.up = async function(knex) {
    const exists = await knex('settings').where({ key: 'opening_balance' }).first();
    if (!exists) await knex('settings').insert({ key: 'opening_balance', value: '0' });
};

exports.down = async function(knex) {
    await knex('settings').where({ key: 'opening_balance' }).delete();
};
