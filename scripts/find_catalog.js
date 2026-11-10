const fs = require('fs');
const path = require('path');

const userHome = process.env.USERPROFILE || 'C:\\Users\\MSI-PC';
const searchDirs = [
    path.join(userHome, 'Downloads'),
    path.join(userHome, 'Desktop'),
    path.join(userHome, 'OneDrive', 'Desktop'),
    path.join(userHome, 'Documents'),
    'C:\\projects_tipket'
];

const today = new Date();
today.setHours(0, 0, 0, 0);

for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                if (f.endsWith('.json') || f.endsWith('.txt')) {
                    const full = path.join(dir, f);
                    try {
                        const stat = fs.statSync(full);
                        if (stat.mtime >= today && stat.size > 10000) {
                            console.log('Found recent large file:', full, 'Size:', stat.size, 'Time:', stat.mtime);
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
    }
}
