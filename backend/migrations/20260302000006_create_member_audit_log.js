exports.up = function (knex) {
    return knex.schema.createTable('member_audit_log', function (table) {
        table.increments('id').primary();
        table.integer('member_id').notNullable()
            .references('id').inTable('members').onDelete('CASCADE');
        table.string('field').notNullable();   // 'status' | 'type'
        table.string('old_value').notNullable();
        table.string('new_value').notNullable();
        table.timestamp('changed_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('member_audit_log');
};
