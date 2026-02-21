/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    await knex.schema.alterTable('members', function (table) {
        table.boolean('gdpr_consent').defaultTo(false);
        table.string('gdpr_token').unique();
        table.string('language').defaultTo('English');
    });

    // Migration logic: mark all members with filled date_of_birth as TRUE
    await knex('members')
        .whereNotNull('date_of_birth')
        .andWhere('date_of_birth', '<>', '')
        .update({ gdpr_consent: true });
};

exports.down = function (knex) {
    return knex.schema.alterTable('members', function (table) {
        table.dropColumn('gdpr_consent');
        table.dropColumn('gdpr_token');
        table.dropColumn('language');
    });
};
