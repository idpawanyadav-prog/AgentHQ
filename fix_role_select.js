const fs = require('fs');
let c = fs.readFileSync('pages/employees.tsx', 'utf8');

const oldInput = `<input
 value={formRole}
 onChange={(e) => setFormRole(e.target.value)}
 required
 className="input-field mt-1"
 />`;

const newSelect = `<select
 value={formRole}
 onChange={(e) => setFormRole(e.target.value)}
 required
 className="input-field mt-1"
 >
 <option value="">Select a role...</option>
 {roleGroups.map((rg) => (
 <option key={rg.id} value={rg.name}>{rg.name}</option>
 ))}
 </select>`;

if (!c.includes(oldInput)) {
 console.log('OLD INPUT NOT FOUND');
 process.exit(1);
}

c = c.replace(oldInput, newSelect, 1);
fs.writeFileSync('pages/employees.tsx', c);
console.log('done');
