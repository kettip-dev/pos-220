const http = require('http');

const data = JSON.stringify({
    username: 'mikes@burgerhouse.com',
    password: '123456'
});

const req = http.request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/v1/auth/signin',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('HTTP Status:', res.statusCode);
        console.log('Headers set-cookie:', res.headers['set-cookie'] ? 'YES' : 'NO');
        try {
            const parsed = JSON.parse(body);
            console.log('Response success:', parsed.success);
            console.log('User Name:', parsed.user?.name);
            console.log('Tenant ID:', parsed.user?.tenant_id);
        } catch (e) {
            console.log('Body:', body);
        }
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
