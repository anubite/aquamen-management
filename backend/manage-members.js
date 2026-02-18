const { db } = require('./db');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const args = process.argv.slice(2);
const command = args[0];

async function truncateMembers() {
    rl.question('\n⚠️  ARE YOU SURE you want to truncate ALL members? (this will also delete import history) [y/N]: ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
            try {
                // Delete in order to handle potential dependencies
                console.log('Clearing import logs...');
                await db('import_logs').del();

                console.log('Clearing imports...');
                await db('imports').del();

                console.log('Clearing members...');
                await db('members').del();

                console.log('\n✅ All members and import history cleared successfully.\n');
            } catch (err) {
                console.error('\n❌ Error truncating members:', err.message, '\n');
            } finally {
                rl.close();
                process.exit();
            }
        } else {
            console.log('\nOperation cancelled.\n');
            rl.close();
            process.exit();
        }
    });
}

function showHelp() {
    console.log(`
🚀 Aquamen Member Management CLI

Usage:
  npm run members -- <command> [arguments]

Commands:
  truncate                  Delete all members and import history (requires confirmation)
    `);
    process.exit();
}

switch (command) {
    case 'truncate':
        truncateMembers();
        break;
    default:
        showHelp();
}
