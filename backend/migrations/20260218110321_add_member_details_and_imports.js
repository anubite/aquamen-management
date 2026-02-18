/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .alterTable('members', function (table) {
            table.string('phone');
            table.string('street');
            table.string('street_number');
            table.string('zip_code');
            table.string('city');
            table.string('date_of_birth');
        })
        .createTable('imports', function (table) {
            table.increments('id').primary();
            table.string('filename').notNullable();
            table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
            table.string('original_file_path');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('import_logs', function (table) {
            table.increments('id').primary();
            table.integer('import_id').references('id').inTable('imports').onDelete('CASCADE');
            table.integer('row_number');
            table.enum('level', ['success', 'warning', 'error']).defaultTo('success');
            table.text('message');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('import_logs')
        .dropTableIfExists('imports')
        .alterTable('members', function (table) {
            table.dropColumn('phone');
            table.dropColumn('street');
            table.dropColumn('street_number');
            table.dropColumn('zip_code');
            table.dropColumn('city');
            table.dropColumn('date_of_birth');
        });
};
