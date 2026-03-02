exports.up = function (knex) {
    return knex.schema.createTable('transaction_categories', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable().unique();
        table.string('description');
        table.string('color').notNullable().defaultTo('#64748b');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('transaction_categories');
};
