const fs = require('fs');
const path = './data/users.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const an = data.find(u => u._id === '0f574df0eff51c03ac107031');
if (an) {
  an.name = 'Nguyễn Văn An';
  an.email = 'an@taskflow.com';
  an.role = 'admin';
  an.isActive = true;
  an.password = '$2a$12$m0D0KCI688GrVH5GxOtTiOHCyctbqqsO9y4o3/PGgn/KWu3ZO8X7W'; // default password
  an.avatar = 'https://ui-avatars.com/api/?name=Nguy%E1%BB%85n%20V%C4%83n%20An&background=6366f1&color=fff&size=200';
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('Fixed user An');
