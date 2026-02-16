const fs = require('fs');
const path = require('path');
const logoPath = 'c:\\Users\\omare\\.claude\\projects\\friendly-lalande\\Logo_El_Sistema.png';
const buffer = fs.readFileSync(logoPath);
const base64 = buffer.toString('base64');
console.log(base64);
