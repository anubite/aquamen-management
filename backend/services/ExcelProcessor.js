const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

class ExcelProcessor {
    constructor(knex, importId) {
        this.knex = knex;
        this.importId = importId;
    }

    async log(rowNumber, level, message) {
        await this.knex('import_logs').insert({
            import_id: this.importId,
            row_number: rowNumber,
            level,
            message
        });
    }

    async updateStatus(status) {
        await this.knex('imports').where({ id: this.importId }).update({ status });
    }

    async process(filePath) {
        try {
            await this.updateStatus('processing');
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet);

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const rowNumber = i + 2; // Offset for header and 0-indexing
                try {
                    await this.processRow(row, rowNumber);
                } catch (err) {
                    console.error(`Error processing row ${rowNumber}:`, err);
                    await this.log(rowNumber, 'error', `Critical error: ${err.message}`);
                }
            }

            await this.updateStatus('completed');
        } catch (err) {
            console.error('Import failed:', err);
            await this.updateStatus('failed');
            await this.log(0, 'error', `Import failed: ${err.message}`);
        }
    }

    async processRow(row, rowNumber) {
        throw new Error('processRow must be implemented in subclass');
    }
}

module.exports = ExcelProcessor;
