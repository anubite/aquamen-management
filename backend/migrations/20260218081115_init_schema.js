/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema
        .createTable('groups', function (table) {
            table.string('id').primary();
            table.string('trainer').notNullable();
        })
        .createTable('members', function (table) {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.string('surname').notNullable();
            table.string('email').unique().notNullable();
            table.string('group_id').references('id').inTable('groups');
            table.enum('status', ['Active', 'Canceled']).defaultTo('Active');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('users', function (table) {
            table.increments('id').primary();
            table.string('username').unique().notNullable();
            table.string('password').notNullable();
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('members')
        .dropTableIfExists('groups')
        .dropTableIfExists('users');
};
