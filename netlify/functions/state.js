const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'mini-sales-doctor-state';
const STATE_KEY = 'shared-state';
const MAX_BODY_BYTES = 4_500_000;

const ALLOWED_KEYS = [
    'customers',
    'products',
    'sales',
    'cashEntries',
    'openingBalances',
    'openingSummary',
    'customerRetroBonuses',
    'customerRetroBonusEntries',
    'marginWithdrawals',
    'pricePresets',
    'saleDirections',
    'accounts',
    'orderSequence',
    'customerDefaultsSeeded',
    'customerListVersion',
    'updatedAt'
];

const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
};

function json(statusCode, body) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(body)
    };
}

function sanitizeState(input) {
    const clean = {};
    ALLOWED_KEYS.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            clean[key] = input[key];
        }
    });
    clean.updatedAt = new Date().toISOString();
    return clean;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    try {
        const store = getStore({ name: STORE_NAME, consistency: 'strong' });

        if (event.httpMethod === 'GET') {
            const saved = await store.get(STATE_KEY, {
                consistency: 'strong',
                type: 'json'
            });
            return json(200, saved || { data: null, updatedAt: '' });
        }

        const body = event.body || '{}';
        if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
            return json(413, { error: 'Data is too large' });
        }

        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return json(400, { error: 'Invalid JSON payload' });
        }

        const data = sanitizeState(parsed);
        const record = {
            data,
            updatedAt: data.updatedAt
        };

        await store.setJSON(STATE_KEY, record);
        return json(200, { ok: true, updatedAt: record.updatedAt });
    } catch (error) {
        console.error('State function error:', error);
        return json(500, { error: 'State could not be saved' });
    }
};
