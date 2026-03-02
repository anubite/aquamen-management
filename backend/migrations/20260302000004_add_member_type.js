exports.up = function (knex) {
    return knex.schema.alterTable('members', function (table) {
        table.string('member_type').notNullable().defaultTo('regular');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('members', function (table) {
        table.dropColumn('member_type');
    });
};
