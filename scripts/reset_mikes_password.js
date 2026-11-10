const bcrypt = require('bcrypt');
const path = require('path');

let getMySqlPromiseConnection;
try {
    const dbPath = path.resolve(__dirname, '../src/config/mysql.db');
    getMySqlPromiseConnection = require(dbPath).getMySqlPromiseConnection;
} catch (e) {
    const dbPath = path.resolve(__dirname, '../restropro-saas-backend-main/src/config/mysql.db');
    getMySqlPromiseConnection = require(dbPath).getMySqlPromiseConnection;
}

(async () => {
    const conn = await getMySqlPromiseConnection();
    try {
        const hash = bcrypt.hashSync('123456', 10);
        await conn.query(
            'UPDATE users SET password = ?, email = ? WHERE username = ?',
            [hash, 'mikes@burgerhouse.com', 'mikes@burgerhouse.com']
        );
        console.log('Password successfully reset to: 123456');
    } catch (err) {
        console.error(err);
    } finally {
        conn.release();
        process.exit(0);
    }
})();
