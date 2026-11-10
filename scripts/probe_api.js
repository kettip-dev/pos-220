const https = require('https');

const endpoints = [
    '/api/v1/menu-items',
    '/api/v1/menu-items/all',
    '/api/v1/pos/init',
    '/api/v1/products',
    '/api/products',
    '/api/product',
    '/api/v1/items',
    '/api/items',
    '/api/item/all',
    '/api/product/all',
    '/api/store/products',
    '/api/store/menu',
    '/api/v1/catalog',
    '/api/catalog',
    '/api/menu',
    '/api/v1/menu',
    '/api/pos/menu'
];

async function checkEndpoint(path) {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'restro-pos.klebjeb.cloud',
            port: 443,
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    path,
                    status: res.statusCode,
                    contentType: res.headers['content-type'],
                    bodySnippet: data.substring(0, 150)
                });
            });
        });
        req.on('error', (err) => resolve({ path, error: err.message }));
        req.end();
    });
}

(async () => {
    for (const ep of endpoints) {
        const res = await checkEndpoint(ep);
        if (res.status === 200 || (res.contentType && res.contentType.includes('json'))) {
            console.log(`[FOUND ${res.status}] ${ep}: ${res.bodySnippet}`);
        } else {
            console.log(`[${res.status || 'ERR'}] ${ep}`);
        }
    }
})();
