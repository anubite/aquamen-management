exports.up = async function (knex) {
    const existing = await knex('settings').where('key', 'template_en_body').first();
    if (!existing) {
        await knex('settings').insert({
            key: 'template_en_body',
            value: '<p>Hello <strong>{{first_name}} {{surname}}</strong>,</p><p>Welcome to our team! You have been assigned to <strong>Group {{group_id}}</strong> (Coach: {{group_trainer}}).</p><p>If you haven\'t already, please fill in your details and provide your GDPR consent here: {{gdpr_link}}</p><p>We look forward to seeing you!</p>'
        });
    }
};

exports.down = async function (knex) {
    await knex('settings').where('key', 'template_en_body').delete();
};
