const fs = require('fs');
const path = 'c:/Users/avspn/mediadoc-studio/packages/desktop/src/App.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// Current view shows error at lines 1997-1999 (Indices 1996, 1997, 1998)
// Let's verify by checking the content of these indices
if (lines[1996].includes('</div>') && lines[1997].includes(');') && lines[1998].includes('}')) {
    lines.splice(1996, 3);
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed syntax error 3 successfully.');
} else {
    console.log('Line mismatch. Expected </div> ); } but found:');
    console.log(lines[1996]);
    console.log(lines[1997]);
    console.log(lines[1998]);
}
