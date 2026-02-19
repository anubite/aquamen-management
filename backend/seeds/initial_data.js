const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Use .onConflict().merge() to ensure required data exists without wiping everything

  // Inserts groups
  await knex('groups').insert([
    { id: 'A', trainer: 'Trainer A' },
    { id: 'B', trainer: 'Trainer B' },
    { id: 'C', trainer: 'Trainer C' }
  ]).onConflict('id').merge();

  // Insert default admin user
  const passwordHash = await bcrypt.hash('milujemeAI', 10);
  await knex('users').insert({
    username: 'aquamen',
    password: passwordHash
  }).onConflict('username').merge();

  // Only insert example members if the table is empty
  const memberCount = await knex('members').count('* as count').first();
  if (parseInt(memberCount.count) === 0) {
    await knex('members').insert([
      { id: 1000, name: 'John', surname: 'Doe', email: 'john.doe@example.com', group_id: 'A', status: 'Active', phone: '+420 123 456 789' },
      { id: 1001, name: 'Jane', surname: 'Smith', email: 'jane.smith@example.com', group_id: 'B', status: 'Active', phone: '+420 987 654 321' },
      { id: 1002, name: 'Petr', surname: 'Novák', email: 'petr.novak@example.cz', group_id: 'A', status: 'Active', phone: '+420 555 666 777' }
    ]);
  }

  // Default Email Settings
  const defaultSettings = [
    { key: 'email_from_name', value: 'Aquamen Management' },
    { key: 'email_from_address', value: 'noreply@aquamen.cz' },
    { key: 'email_reply_to', value: 'info@aquamen.cz' },
    { key: 'email_cc', value: '' },
    { key: 'template_en_subject', value: 'Welcome to Aquamen, {{first_name}}!' },
    { key: 'template_en_body', value: '<p>Hello <strong>{{first_name}} {{surname}}</strong>,</p><p>Welcome to our team! You have been assigned to <strong>Group {{group_id}}</strong> (Trainer: {{group_trainer}}).</p><p>We are excited to have you with us!</p>' },
    { key: 'template_cz_subject', value: 'Vítejte v Aquamen, {{first_name}}!' },
    { key: 'template_cz_body', value: '<p>Ahoj <strong>{{first_name}} {{surname}}</strong>,</p><p>Vítej v našem týmu! Byl(a) jsi zařazen(a) do <strong>Skupiny {{group_id}}</strong> (Trenér: {{group_trainer}}).</p><p>Těšíme se na tebe!</p>' },
    { key: 'smtp_host', value: '' },
    { key: 'smtp_port', value: '587' },
    { key: 'smtp_user', value: '' },
    { key: 'smtp_pass', value: '' },
    { key: 'smtp_secure', value: 'false' }
  ];

  for (const s of defaultSettings) {
    await knex('settings')
      .insert(s)
      .onConflict('key')
      .ignore(); // Using ignore for settings so we don't overwrite user-configured SMTP details
  }
};
