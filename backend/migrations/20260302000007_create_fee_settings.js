exports.up = async function (knex) {
    await knex.schema.createTable('fee_settings', function (table) {
        table.increments('id').primary();
        table.string('valid_from').notNullable();   // YYYY-MM, inclusive
        table.string('valid_to');                   // YYYY-MM, inclusive; NULL = open-ended (current)
        table.float('regular_amount').notNullable();
        table.float('student_amount').notNullable();
    });

    // Seed: one open-ended period covering everything from 2020-01 onwards
    await knex('fee_settings').insert({
        valid_from: '2020-01',
        valid_to: null,
        regular_amount: 1350,
        student_amount: 1000,
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('fee_settings');
};
