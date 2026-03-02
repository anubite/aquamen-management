'use strict';

const {
    parseClubBankAccount,
    buildQrUrl,
    fetchQrAsBase64,
    buildQrImageTag,
} = require('../services/QrPaymentService');

// ─── parseClubBankAccount ──────────────────────────────────────────────────

describe('parseClubBankAccount', () => {
    test('valid format', () => {
        expect(parseClubBankAccount('192000145/0300')).toEqual({ accountNumber: '192000145', bankCode: '0300' });
    });

    test('no slash → empty strings', () => {
        expect(parseClubBankAccount('192000145')).toEqual({ accountNumber: '', bankCode: '' });
    });

    test('empty string', () => {
        expect(parseClubBankAccount('')).toEqual({ accountNumber: '', bankCode: '' });
    });

    test('null', () => {
        expect(parseClubBankAccount(null)).toEqual({ accountNumber: '', bankCode: '' });
    });

    test('undefined', () => {
        expect(parseClubBankAccount(undefined)).toEqual({ accountNumber: '', bankCode: '' });
    });

    test('trims whitespace around slash', () => {
        expect(parseClubBankAccount(' 192000145 / 0300 ')).toEqual({ accountNumber: '192000145', bankCode: '0300' });
    });
});

// ─── buildQrUrl ────────────────────────────────────────────────────────────

describe('buildQrUrl', () => {
    test('builds URL with all required params', () => {
        const url = buildQrUrl({ accountNumber: '222885', bankCode: '5500', amount: 1350, memberId: 42, memberName: 'Jan Novak' });
        expect(url).toContain('accountNumber=222885');
        expect(url).toContain('bankCode=5500');
        expect(url).toContain('amount=1350.00');
        expect(url).toContain('currency=CZK');
        expect(url).toContain('vs=42');
        expect(url).toContain('message=Jan+Novak');
    });

    test('formats integer amount as two-decimal string', () => {
        const url = buildQrUrl({ accountNumber: 'A', bankCode: 'B', amount: 1000, memberId: 1, memberName: 'X' });
        expect(url).toContain('amount=1000.00');
    });

    test('formats zero amount', () => {
        const url = buildQrUrl({ accountNumber: 'A', bankCode: 'B', amount: 0, memberId: 1, memberName: 'X' });
        expect(url).toContain('amount=0.00');
    });

    test('uses paylibo base URL', () => {
        const url = buildQrUrl({ accountNumber: 'A', bankCode: 'B', amount: 100, memberId: 1, memberName: 'X' });
        expect(url).toMatch(/^http:\/\/api\.paylibo\.com\/paylibo\/generator\/czech\/image\?/);
    });
});

// ─── fetchQrAsBase64 ───────────────────────────────────────────────────────

describe('fetchQrAsBase64', () => {
    test('returns base64 string on successful response', async () => {
        const mockFetch = async () => ({
            ok: true,
            arrayBuffer: async () => Buffer.from('fakepngdata'),
        });
        const result = await fetchQrAsBase64('http://example.com', mockFetch);
        expect(result).toBe(Buffer.from('fakepngdata').toString('base64'));
    });

    test('returns null on non-ok HTTP status', async () => {
        const mockFetch = async () => ({ ok: false, status: 400 });
        expect(await fetchQrAsBase64('http://example.com', mockFetch)).toBeNull();
    });

    test('returns null when fetch throws', async () => {
        const mockFetch = async () => { throw new Error('Network error'); };
        expect(await fetchQrAsBase64('http://example.com', mockFetch)).toBeNull();
    });

    test('returns null when arrayBuffer throws', async () => {
        const mockFetch = async () => ({
            ok: true,
            arrayBuffer: async () => { throw new Error('Stream error'); },
        });
        expect(await fetchQrAsBase64('http://example.com', mockFetch)).toBeNull();
    });
});

// ─── buildQrImageTag ───────────────────────────────────────────────────────

describe('buildQrImageTag', () => {
    test('produces an img tag', () => {
        const tag = buildQrImageTag('abc123');
        expect(tag).toMatch(/^<img /);
    });

    test('embeds base64 as data URI', () => {
        const tag = buildQrImageTag('abc123');
        expect(tag).toContain('data:image/png;base64,abc123');
    });

    test('includes alt text', () => {
        expect(buildQrImageTag('x')).toContain('alt="QR platba"');
    });
});
