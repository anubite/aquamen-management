const { db } = require('./db');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
const command = args[0];

async function listUsers() {
    try {
        const users = await db('users').select('username');
        console.log('\n👥 Current Users:');
        console.log('----------------');
        users.forEach(u => console.log(`- ${u.username}`));
        console.log('----------------\n');
    } catch (err) {
        console.error('Error listing users:', err.message);
    } finally {
        process.exit();
    }
}

async function createUser(username, password) {
    if (!username || !password) {
        console.error('Usage: npm run users -- create <username> <password>');
        process.exit(1);
    }
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await db('users').insert({ username, password: passwordHash });
        console.log(`\n✅ User "${username}" created successfully.\n`);
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            console.error(`\n❌ Error: User "${username}" already exists.\n`);
        } else {
            console.error('\n❌ Error creating user:', err.message, '\n');
        }
    } finally {
        process.exit();
    }
}

async function deleteUser(username) {
    if (!username) {
        console.error('Usage: npm run users -- delete <username>');
        process.exit(1);
    }
    try {
        const deleted = await db('users').where({ username }).del();
        if (deleted) {
            console.log(`\n✅ User "${username}" deleted successfully.\n`);
        } else {
            console.log(`\n⚠️  User "${username}" not found.\n`);
        }
    } catch (err) {
        console.error('\n❌ Error deleting user:', err.message, '\n');
    } finally {
        process.exit();
    }
}

async function changePassword(username, newPassword) {
    if (!username || !newPassword) {
        console.error('Usage: npm run users -- changepassword <username> <new_password>');
        process.exit(1);
    }
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const updated = await db('users').where({ username }).update({ password: passwordHash });
        if (updated) {
            console.log(`\n✅ Password for user "${username}" updated successfully.\n`);
        } else {
            console.log(`\n⚠️  User "${username}" not found.\n`);
        }
    } catch (err) {
        console.error('\n❌ Error updating password:', err.message, '\n');
    } finally {
        process.exit();
    }
}

function showHelp() {
    console.log(`
🚀 Aquamen User Management CLI

Usage:
  npm run users -- <command> [arguments]

Commands:
  list                      List all users
  create <user> <pass>      Create a new user
  delete <user>             Delete a user
  changepassword <user> <pass> Change user password
    `);
    process.exit();
}

switch (command) {
    case 'list':
        listUsers();
        break;
    case 'create':
        createUser(args[1], args[2]);
        break;
    case 'delete':
        deleteUser(args[1]);
        break;
    case 'changepassword':
        changePassword(args[1], args[2]);
        break;
    default:
        showHelp();
}
