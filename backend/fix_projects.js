const fs = require('fs');
const path = './data/projects.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

let fixed = 0;
for (const proj of data) {
  if (Array.isArray(proj.members)) {
    proj.members = proj.members.map((m, idx) => {
      if (typeof m === 'string') {
        fixed++;
        // If it's the first member, it's likely the owner
        return {
          user: idx === 0 ? proj.owner : m,
          role: idx === 0 ? 'admin' : 'member'
        };
      }
      return m;
    });
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Fixed ' + fixed + ' corrupted members');
