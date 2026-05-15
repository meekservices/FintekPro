import fs from 'fs';
import path from 'path';

const filesToInclude = [
  'server/index.ts',
  'server/routes.ts',
  'server/storage.ts',
  'server/auth.ts',
  'server/db.ts',
  'server/openai.ts',
  'server/types.ts',
  'shared/schema/index.ts',
  'shared/schema/proposals-base.ts',
  'shared/schema/proposals.ts',
  'shared/schema/portfolio.ts',
  'shared/schema/users.ts',
  'shared/schema/agents.ts',
  'shared/schema/enums.ts',
  'shared/schema/clients.ts',
  'shared/schema/family.ts',
  'shared/schema/kyc.ts',
  'shared/schema/documents.ts',
  'shared/schema/commissions.ts',
  'shared/schema/b2b.ts',
  'shared/schema/bonds.ts',
  'shared/schema/mutual-funds.ts',
  'shared/schema/insurance.ts',
  'shared/schema/loans.ts',
  'shared/schema/unlisted.ts',
  'shared/schema/reit-invit.ts',
  'shared/schema/market-data.ts',
  'shared/schema/orders.ts',
  'shared/schema/cart.ts',
  'shared/schema/ai.ts',
  'shared/schema/itr.ts',
  'shared/schema/mca.ts',
  'shared/schema/zoho.ts',
  'shared/schema/partners.ts',
  'shared/schema/products.ts',
  'shared/schema/screener.ts',
  'shared/schema/ib.ts',
  'shared/schema/advisory.ts'
];

const payload = {};

filesToInclude.forEach(file => {
  try {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      payload[file] = fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    console.error(`Error reading ${file}:`, error.message);
  }
});

fs.writeFileSync('push_payload.json', JSON.stringify(payload, null, 2));
console.log('Payload created successfully in push_payload.json');
