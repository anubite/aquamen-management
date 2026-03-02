exports.up = function (knex) {
    return knex.schema.alterTable('transaction_categories', function (table) {
        table.boolean('is_membership_fee').notNullable().defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('transaction_categories', function (table) {
        table.dropColumn('is_membership_fee');
    });
};
