import { getStore } from '@netlify/blobs';

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
    'Cache-Control': 'no-store, no-cache, must-revalidate'
};

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers
    });
}

function sanitizeState(input) {
    const clean = {};

    for (const key of ALLOWED_KEYS) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            clean[key] = input[key];
        }
    }

    clean.updatedAt = new Date().toISOString();

    return clean;
}

export default async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers
        });
    }

    if (
        request.method !== 'GET' &&
        request.method !== 'POST'
    ) {
        return json(
            { error: 'Method not allowed' },
            405
        );
    }

    try {
        const store = getStore({
            name: STORE_NAME,
            consistency: 'strong'
        });

        // ==========================
        // GET
        // ==========================
        if (request.method === 'GET') {

            const saved = await store.get(
                STATE_KEY,
                {
                    type: 'json',
                    consistency: 'strong'
                }
            );

            return json(
                saved || {
                    data: null,
                    updatedAt: ''
                }
            );
        }

        // ==========================
        // POST
        // ==========================
        const body = await request.text();

        const bodySize =
            new TextEncoder()
                .encode(body)
                .byteLength;

        if (bodySize > MAX_BODY_BYTES) {
            return json(
                {
                    error: 'Data is too large'
                },
                413
            );
        }

        let parsed;

        try {
            parsed = JSON.parse(
                body || '{}'
            );
        } catch (error) {
            return json(
                {
                    error: 'Invalid JSON'
                },
                400
            );
        }

        if (
            !parsed ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed)
        ) {
            return json(
                {
                    error:
                        'Invalid JSON payload'
                },
                400
            );
        }

        const data =
            sanitizeState(parsed);

        const record = {
            data,
            updatedAt: data.updatedAt
        };

        await store.setJSON(
            STATE_KEY,
            record
        );

        return json({
            ok: true,
            updatedAt:
                record.updatedAt
        });

    } catch (error) {

        console.error(
            'STATE FUNCTION ERROR:',
            error
        );

        // Vaqtincha xatoni ko'rish uchun
        return json(
            {
                error:
                    'State could not be saved',

                errorName:
                    error?.name ||
                    'UnknownError',

                errorMessage:
                    error?.message ||
                    String(error)
            },
            500
        );
    }
};
