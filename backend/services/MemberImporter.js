const ExcelProcessor = require('./ExcelProcessor');

class MemberImporter extends ExcelProcessor {
    normalizeDate(val) {
        if (!val) return null;
        const s = String(val).trim();
        // Handle D.M.YYYY
        const parts = s.split('.');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            // Basic sanity check for year
            if (year.length === 4) return `${year}-${month}-${day}`;
        }
        return s; // Return as is if we can't parse it
    }

    async processRow(row, rowNumber) {
        const id = parseInt(row['ID']);
        const nameRaw = row['Name'] || '';
        const email = row['Email'];
        const groupIdentifierRaw = String(row['Group'] || '').trim(); // Original raw group identifier
        const statusRaw = row['Active'];
        const phoneRaw = row['Phone'];
        const addressRaw = row['Address'];
        const dobRaw = row['Date of Birth'] || row['Date of birth'];

        // 1. Validation
        if (isNaN(id) || id <= 999) {
            await this.log(rowNumber, 'error', `ID must be a number > 999. Got: ${row['ID']}`);
            return;
        }

        if (!nameRaw.trim()) {
            await this.log(rowNumber, 'error', 'Name cannot be empty.');
            return;
        }

        if (!email) {
            await this.log(rowNumber, 'error', 'Email is required.');
            return;
        }

        const groupIdentifier = groupIdentifierRaw.toUpperCase(); // Force uppercase for consistency
        if (groupIdentifier.length !== 1) {
            await this.log(rowNumber, 'error', `Group identifier must be exactly one letter. Ignoring record.`);
            return;
        }

        // 2. Name Splitting
        const [firstName, ...surnameParts] = nameRaw.trim().split(/\s+/);
        const surname = surnameParts.join(' ') || ''; // If only one part, surname is empty

        // 3. Status Mapping
        const status = statusRaw === 'Active' ? 'Active' : 'Canceled';

        // 4. Phone Formatting
        let phone = phoneRaw ? String(phoneRaw).trim() : null;
        if (phone && !phone.startsWith('+')) {
            phone = '+' + phone;
        }

        // 5. Smart Address Extraction
        const addressData = this.extractAddress(addressRaw);
        if (addressRaw && !addressData.zip_code) {
            await this.log(rowNumber, 'warning', `Address extraction partially failed for: "${addressRaw}". Saved as raw where possible.`);
        }

        const dateOfBirth = this.normalizeDate(dobRaw);
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            if (dob > new Date()) {
                await this.log(rowNumber, 'error', `Date of Birth ${dateOfBirth} is in the future. Skipping record.`);
                return;
            }
        }

        // 6. Group Logic
        let group_id = groupIdentifier;
        const existingGroup = await this.knex('groups').whereRaw('UPPER(id) = ?', [group_id]).first();
        if (!existingGroup) {
            await this.knex('groups').insert({ id: group_id, trainer: 'Unknown (Imported)' });
            await this.log(rowNumber, 'warning', `Created new group: ${group_id}`);
        } else {
            group_id = existingGroup.id; // Use existing casing just in case (though we force upper)
        }

        // 7. Upsert Logic
        const memberData = {
            id,
            name: firstName,
            surname: surname,
            email,
            group_id,
            status,
            phone,
            street: addressData.street,
            street_number: addressData.street_number,
            zip_code: addressData.zip_code,
            city: addressData.city,
            date_of_birth: dateOfBirth
        };

        try {
            const existingMember = await this.knex('members').where({ id }).first();
            const memberByEmail = await this.knex('members').where({ email }).first();

            if (memberByEmail && memberByEmail.id !== id) {
                await this.log(rowNumber, 'error', `Conflict: Email ${email} is already used by member ID ${memberByEmail.id}.`);
                return;
            }

            if (existingMember) {
                await this.knex('members').where({ id }).update(memberData);
                await this.log(rowNumber, 'success', `Updated member ${id}`);
            } else {
                await this.knex('members').insert(memberData);
                await this.log(rowNumber, 'success', `Inserted new member ${id}`);
            }
        } catch (err) {
            await this.log(rowNumber, 'error', `Database error: ${err.message}`);
        }
    }

    extractAddress(raw) {
        if (!raw) return {};
        const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
        const data = { street: null, street_number: null, zip_code: null, city: null };

        if (parts.length === 0) return data;

        // 1. Find ZIP and City
        let zipPartIndex = -1;
        for (let i = 0; i < parts.length; i++) {
            const match = parts[i].match(/\d{3}\s?\d{2}/);
            if (match) {
                zipPartIndex = i;
                data.zip_code = match[0].replace(/\s/g, '');
                const cityCandidate = parts[i].replace(match[0], '').trim();
                if (cityCandidate) {
                    data.city = cityCandidate;
                } else if (i > 0) {
                    // ZIP is in its own part, city is likely the part before
                    data.city = parts[i - 1];
                }
                break;
            }
        }

        // 2. Find Street and Number (usually the first part)
        const streetPart = parts[0];
        const numberMatch = streetPart.match(/(\d+[\/\-]?\w*)$/);

        // Only assign street if it's not the same as city (to avoid duplication if city was parts[0])
        if (streetPart !== data.city) {
            if (numberMatch) {
                data.street_number = numberMatch[1];
                data.street = streetPart.replace(numberMatch[1], '').trim();
            } else {
                data.street = streetPart;
            }
        }

        // 3. Fallback for City if still null
        if (!data.city && parts.length > 1) {
            data.city = parts[1];
        }

        return data;
    }
}

module.exports = MemberImporter;
