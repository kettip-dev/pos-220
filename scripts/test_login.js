const { signInDB } = require('../src/services/auth.service');
(async () => {
    const user = await signInDB('mikes@burgerhouse.com', '123456');
    console.log('SignIn test result:', user ? 'SUCCESS: ' + user.name + ' (Tenant ' + user.tenant_id + ')' : 'FAILED');
    process.exit(0);
})();
