exports.up = function (knex) {
    return knex.schema.createTable('transactions', function (table) {
        table.increments('id').primary();
        table.string('unique_hash').notNullable().unique();
        table.string('transaction_type').notNullable();
        table.string('transaction_date').notNullable();
        table.string('variable_symbol');
        table.string('counterparty_name');
        table.string('iban');
        table.string('bic');
        table.string('counterparty_account');
        table.float('amount').notNullable();
        table.text('message_for_recipient');
        table.text('message_for_me');
        table.integer('category_id').references('id').inTable('transaction_categories').onDelete('SET NULL');
        table.integer('member_id').references('id').inTable('members').onDelete('SET NULL');
        table.integer('import_id').references('id').inTable('imports').onDelete('SET NULL');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('transactions');
};
