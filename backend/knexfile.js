const path = require('path');

module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: process.env.SQLITE_DB_PATH || path.resolve(__dirname, 'aquamen.sqlite')
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'migrations')
        },
        seeds: {
            directory: path.join(__dirname, 'seeds')
        }
    },
    production: {
        client: 'sqlite3',
        connection: {
            filename: process.env.SQLITE_DB_PATH || '/var/lib/sqlite/aquamen.sqlite'
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'migrations')
        },
        seeds: {
            directory: path.join(__dirname, 'seeds')
        }
    }
};
