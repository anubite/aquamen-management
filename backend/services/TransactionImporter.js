const ExcelProcessor = require('./ExcelProcessor');
const crypto = require('crypto');
const xlsx = require('xlsx');

class TransactionImporter extends ExcelProcessor {
    constructor(knex, importId) {
        super(knex, importId);
        this.rules = [];
        this.insertedCount = 0;
        this.skippedCount = 0;
        this.errorCount = 0;
        this.linkedCount = 0;
        // Tracks occurrence index per base hash within this import run
        this.occurrenceMap = new Map();
    }

    // Override process() — use header:1 for raw array access by column index
    async process(filePath) {
        try {
            await this.updateStatus('processing');

            // Load categorization rules once before processing rows
            this.rules = await this.knex('transaction_category_rules')
                .select('*')
                .orderBy('priority', 'asc');

            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

            // Skip header row (index 0)
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                const rowNumber = i + 1; // 1-indexed, +1 to account for header
                try {
                    await this.processRow(row, rowNumber);
                } catch (err) {
                    this.errorCount++;
                    console.error(`[TransactionImporter] Error processing row ${rowNumber}:`, err);
                    await this.log(rowNumber, 'error', `Critical error: ${err.message}`);
                }
            }

            await this.log(0, 'success',
                `Import complete: ${this.insertedCount} inserted, ${this.skippedCount} duplicates skipped, ${this.errorCount} errors, ${this.linkedCount} auto-linked to members`
            );
            await this.updateStatus('completed');
        } catch (err) {
            console.error('[TransactionImporter] Import failed:', err);
            await this.updateStatus('failed');
            await this.log(0, 'error', `Import failed: ${err.message}`);
        }
    }

    excelDateToISO(serial) {
        if (serial === null || serial === undefined || serial === '') return null;
        if (typeof serial === 'string') {
            const trimmed = serial.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
            // D.M.YYYY or D.MM.YYYY or DD.MM.YYYY
            const parts = trimmed.split('.');
            if (parts.length === 3 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            return trimmed || null;
        }
        if (typeof serial === 'number') {
            // Excel serial date: days since 1900-01-00 (with Lotus 1-2-3 leap year bug)
            const utcDays = Math.floor(serial - 25569);
            const utcMs = utcDays * 86400 * 1000;
            const date = new Date(utcMs);
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, '0');
            const d = String(date.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return null;
    }

    computeBaseHash(txData) {
        const str = [
            txData.transaction_type,
            txData.transaction_date,
            txData.amount,
            txData.counterparty_account,
            txData.variable_symbol,
            txData.counterparty_name,
            txData.iban,
            txData.bic,
            txData.message_for_recipient,
            txData.message_for_me
        ].map(v => String(v ?? '')).join('|');
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    computeHash(txData) {
        const baseHash = this.computeBaseHash(txData);
        // Track occurrence within this import to handle identical bank rows
        const count = this.occurrenceMap.get(baseHash) ?? 0;
        this.occurrenceMap.set(baseHash, count + 1);
        return crypto.createHash('sha256').update(`${baseHash}|${count}`).digest('hex');
    }

    evaluateRules(txData) {
        for (const rule of this.rules) {
            let match = false;
            if (rule.field === 'amount') {
                const txAmt   = parseFloat(txData.amount);
                const ruleAmt = parseFloat(rule.value);
                if (!isNaN(ruleAmt)) {
                    switch (rule.operator) {
                        case 'gt':     match = txAmt > ruleAmt;  break;
                        case 'gte':    match = txAmt >= ruleAmt; break;
                        case 'lt':     match = txAmt < ruleAmt;  break;
                        case 'lte':    match = txAmt <= ruleAmt; break;
                        case 'equals': match = txAmt === ruleAmt; break;
                    }
                }
            } else {
                const fieldValueRaw = String(txData[rule.field] ?? '');
                const fieldValue    = fieldValueRaw.toLowerCase();
                const ruleValue     = rule.value.toLowerCase();
                switch (rule.operator) {
                    case 'contains':    match = fieldValue.includes(ruleValue); break;
                    case 'equals':      match = fieldValue === ruleValue; break;
                    case 'starts_with': match = fieldValue.startsWith(ruleValue); break;
                    case 'regex':
                        try { match = new RegExp(rule.value, 'i').test(fieldValueRaw); }
                        catch { match = false; }
                        break;
                }
            }
            if (match) return rule.category_id;
        }
        return null;
    }

    async findMemberByVS(variableSymbol) {
        if (!variableSymbol) return null;
        const numericVS = parseInt(variableSymbol, 10);
        if (isNaN(numericVS)) return null;
        const member = await this.knex('members').where({ id: numericVS }).first();
        return member ? member.id : null;
    }

    async findMemberByCounterpartyName(counterpartyName) {
        if (!counterpartyName) return null;
        if (!this._membersCache) {
            this._membersCache = await this.knex('members').select('id', 'name', 'surname');
        }
        const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const cpNorm = norm(counterpartyName);
        const matched = this._membersCache.find(m =>
            cpNorm === norm(`${m.name} ${m.surname}`) || cpNorm === norm(`${m.surname} ${m.name}`)
        );
        return matched ? matched.id : null;
    }

    async processRow(row, rowNumber) {
        if (!row || row.every(cell => cell === '' || cell === null || cell === undefined)) return;

        const txData = {
            transaction_type:      String(row[0] ?? '').trim(),
            transaction_date:      this.excelDateToISO(row[1]),
            variable_symbol:       String(row[2] ?? '').trim() || null,
            counterparty_name:     String(row[4] ?? '').trim() || null,
            iban:                  String(row[5] ?? '').trim() || null,
            bic:                   String(row[6] ?? '').trim() || null,
            counterparty_account:  String(row[7] ?? '').trim() || null,
            amount:                parseFloat(row[9]),
            message_for_recipient: String(row[10] ?? '').trim() || null,
            message_for_me:        String(row[13] ?? '').trim() || null,
        };

        // Validation
        if (!txData.transaction_type) {
            this.errorCount++;
            await this.log(rowNumber, 'error', 'Skipped: missing transaction type');
            return;
        }
        if (!txData.transaction_date) {
            this.errorCount++;
            await this.log(rowNumber, 'error', `Skipped: missing or invalid date (raw value: ${row[1]})`);
            return;
        }
        if (isNaN(txData.amount)) {
            this.errorCount++;
            await this.log(rowNumber, 'error', `Skipped: invalid amount "${row[9]}"`);
            return;
        }

        // Enforce 2020-01 calculation boundary
        if (txData.transaction_date < '2020-01-01') {
            this.skippedCount++;
            await this.log(rowNumber, 'warning',
                `Skipped: transaction date ${txData.transaction_date} is before the allowed start date (2020-01-01)`
            );
            return;
        }

        // Compute unique hash (with occurrence tracking)
        const hash = this.computeHash(txData);

        // Deduplication check
        const existing = await this.knex('transactions').where({ unique_hash: hash }).first();
        if (existing) {
            this.skippedCount++;
            await this.log(rowNumber, 'warning',
                `Duplicate skipped (ID ${existing.id}): ${txData.transaction_date} | ${txData.amount} | ${txData.counterparty_name || 'N/A'}`
            );
            return;
        }

        // Auto-categorization
        const categoryId = this.evaluateRules(txData);

        // Auto-link member: variable symbol first, counterparty name as fallback
        const memberId = (await this.findMemberByVS(txData.variable_symbol))
            ?? (await this.findMemberByCounterpartyName(txData.counterparty_name));
        if (memberId) this.linkedCount++;

        // Insert
        await this.knex('transactions').insert({
            unique_hash: hash,
            ...txData,
            category_id: categoryId,
            member_id: memberId,
            import_id: this.importId,
        });

        this.insertedCount++;
        const extras = [
            categoryId ? `cat:${categoryId}` : null,
            memberId ? `member:${memberId}` : null
        ].filter(Boolean).join(', ');
        await this.log(rowNumber, 'success',
            `Inserted: ${txData.transaction_date} | ${txData.amount} CZK | ${txData.counterparty_name || 'N/A'}${extras ? ` [${extras}]` : ''}`
        );
    }
}

module.exports = TransactionImporter;
