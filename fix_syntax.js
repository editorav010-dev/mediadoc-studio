const fs = require('fs');
const path = 'c:/Users/avspn/mediadoc-studio/packages/desktop/src/App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// Remove lines 1444-1446 (Indices 1443, 1444, 1445)
lines.splice(1443, 3);

// Remove lines 1651-1653 (Indices 1650, 1651, 1652) - adjusted for the previous shift
// Original 1651-1653 became 1648-1650
lines.splice(1647, 3);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed syntax errors successfully.');
