'use strict';

/**
 * QrPaymentService — helpers for generating Czech QR payment code images.
 *
 * All functions are pure / injectable so they can be unit-tested without
 * a real network or database.
 *
 * External API: http://api.paylibo.com/paylibo/generator/czech/image
 */

/**
 * Split 'accountNumber/bankCode' setting string into its parts.
 * Returns { accountNumber: '', bankCode: '' } if format is invalid.
 *
 * @param {string|null} setting  e.g. '192000145/0300'
 * @returns {{ accountNumber: string, bankCode: string }}
 */
function parseClubBankAccount(setting) {
    const s = (setting || '').trim();
    const idx = s.indexOf('/');
    if (idx === -1) return { accountNumber: '', bankCode: '' };
    return {
        accountNumber: s.slice(0, idx).trim(),
        bankCode: s.slice(idx + 1).trim(),
    };
}

/**
 * Build the paylibo QR image URL.
 *
 * @param {{ accountNumber: string, bankCode: string, amount: number, memberId: number|string, memberName: string }} params
 * @returns {string}
 */
function buildQrUrl({ accountNumber, bankCode, amount, memberId, memberName }) {
    const base = 'http://api.paylibo.com/paylibo/generator/czech/image';
    const params = new URLSearchParams({
        accountNumber,
        bankCode,
        amount: Number(amount).toFixed(2),
        currency: 'CZK',
        vs: String(memberId),
        message: memberName,
    });
    return `${base}?${params.toString()}`;
}

/**
 * Fetch the QR image and return it as a base64 string, or null on any error.
 *
 * @param {string}   url       Full paylibo URL
 * @param {Function} fetchFn   Defaults to global fetch; pass a mock in tests
 * @returns {Promise<string|null>}
 */
async function fetchQrAsBase64(url, fetchFn = fetch) {
    try {
        const res = await fetchFn(url);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        return Buffer.from(buf).toString('base64');
    } catch {
        return null;
    }
}

/**
 * Wrap a base64 PNG string in an HTML <img> tag suitable for email embedding.
 *
 * @param {string} base64
 * @returns {string}
 */
function buildQrImageTag(cid) {
    return `<img src="cid:${cid}" alt="QR platba" style="display:block;max-width:200px;margin:8px 0;" />`;
}

module.exports = { parseClubBankAccount, buildQrUrl, fetchQrAsBase64, buildQrImageTag };
