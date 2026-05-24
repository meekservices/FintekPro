const fs = require('fs');
const path = require('path');
const file = path.join('client', 'src', 'components', 'layout', 'agent-layout.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace role check
content = content.replace(
  /const isAgent = user\.roles\?\.includes\('agent'\) \|\| user\.roles\?\.includes\('admin'\) \|\| user\.roles\?\.includes\('superadmin'\) \|\| user\.roles\?\.includes\('partner'\);/g,
  "const actualUser = (user as any)?.data || user;\n  const isAgent = actualUser?.roles?.includes('agent') || actualUser?.roles?.includes('admin') || actualUser?.roles?.includes('superadmin') || actualUser?.roles?.includes('partner');"
);

// Replace user.email rendering
content = content.replace(
  /\{user\.email \&\& \(/g,
  "{actualUser?.email && ("
);
content = content.replace(
  /<strong>\{user\.email\}<\/strong>/g,
  "<strong>{actualUser?.email}</strong>"
);

fs.writeFileSync(file, content);
console.log('Fixed agent-layout.tsx');
