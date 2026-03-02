exports.up = function (knex) {
    return knex.schema.createTable('transaction_category_rules', function (table) {
        table.increments('id').primary();
        table.integer('category_id').notNullable()
            .references('id').inTable('transaction_categories').onDelete('CASCADE');
        table.string('field').notNullable();
        table.string('operator').notNullable();
        table.string('value').notNullable();
        table.integer('priority').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('transaction_category_rules');
};
