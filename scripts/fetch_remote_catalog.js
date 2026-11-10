const https = require('https');

async function request(path, cookie, method = 'GET', body = null) {
    return new Promise((resolve) => {
        const headers = {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        };
        if (cookie) headers['Cookie'] = cookie;
        if (body) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = https.request({
            hostname: 'restro-pos.klebjeb.cloud',
            port: 443,
            path: path,
            method: method,
            headers: headers
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: data
                });
            });
        });
        req.on('error', e => resolve({ error: e.message }));
        if (body) req.write(body);
        req.end();
    });
}

(async () => {
    // 1. Login as Superadmin
    const loginData = JSON.stringify({ username: 'admin@example.com', password: 'Admin@123456' });
    const loginRes = await request('/api/v1/auth/signin', null, 'POST', loginData);
    const parsedLogin = JSON.parse(loginRes.body);
    const token = parsedLogin.accessToken;
    console.log('Got superadmin access token');

    const authHeaderCookie = `accessToken=${token}`;

    // 2. Fetch tenants list
    const endpoints = [
        '/api/v1/superadmin/tenants',
        '/api/v1/superadmin/users',
        '/api/v1/superadmin/dashboard'
    ];

    for (const ep of endpoints) {
        const res = await request(ep, authHeaderCookie);
        console.log(`[${ep}] Status ${res.status}`);
        try {
            const data = JSON.parse(res.body);
            if (ep.includes('tenants')) {
                console.log('Tenants:', JSON.stringify(data).substring(0, 400));
            } else if (ep.includes('users')) {
                console.log('Users count:', data.data?.length || data.length);
            }
        } catch (e) {
            console.log('Body:', res.body.substring(0, 200));
        }
    }
})();
