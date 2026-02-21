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
    { key: 'template_cz_body', value: '<p>Ahoj <strong>{{first_name}} {{surname}}</strong>,</p><p>Vítej v našem týmu! Byl(a) jsi zařazen(a) do <strong>Skupiny {{group_id}}</strong> (Trenér: {{group_trainer}}).</p><p>Pokud jsi tak ještě neučinil(a), prosíme o vyplnění doplňujících údajů a souhlasu s GDPR zde: {{gdpr_link}}</p><p>Těšíme se na tebe!</p>' },
    { key: 'gdpr_policy_cz', value: '<h1>Zásady ochrany osobních údajů (GDPR)</h1><p>V Aquamen bereme ochranu vašich osobních údajů vážně. Shromažďujeme vaše jméno, email, datum narození a adresu výhradně pro účely správy členství a informování o trénincích.</p><p>Vaše údaje nejsou předávány třetím stranám bez vašeho výslovného souhlasu.</p>' },
    { key: 'gdpr_policy_en', value: '<h1>Privacy Policy (GDPR)</h1><p>At Aquamen, we take your privacy seriously. We collect your name, email, date of birth, and address solely for membership management and training updates.</p><p>Your data is never shared with third parties without your explicit consent.</p>' },
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
