const fs = require('fs');
const path = 'c:/Users/avspn/mediadoc-studio/packages/desktop/src/App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// Remove lines 1819-1821 (Indices 1818, 1819, 1820)
lines.splice(1818, 3);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed syntax error 2 successfully.');
