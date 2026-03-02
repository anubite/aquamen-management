exports.up = function (knex) {
    return knex.schema.createTable('member_fees_due', function (table) {
        table.increments('id').primary();
        table.integer('member_id').notNullable().unsigned()
            .references('id').inTable('members').onDelete('CASCADE');
        table.unique(['member_id']);
        table.float('total_calculated_due').notNullable().defaultTo(0);
        table.float('total_paid').notNullable().defaultTo(0);
        table.float('outstanding').notNullable().defaultTo(0);
        table.text('unpaid_months');        // JSON array of YYYY-MM strings
        table.float('override_amount');     // null = no override
        table.timestamp('override_at');
        table.text('override_note');
        table.timestamp('recalculated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('member_fees_due');
};
