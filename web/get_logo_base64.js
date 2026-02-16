const fs = require('fs');
const path = require('path');
const logoPath = path.join(__dirname, '..', 'Logo_El_Sistema.png');
try {
    const buffer = fs.readFileSync(logoPath);
    const base64 = buffer.toString('base64');
    fs.writeFileSync(path.join(__dirname, 'logo_base64.txt'), base64);
    console.log('SUCCESS');
} catch (err) {
    console.error(err);
}
