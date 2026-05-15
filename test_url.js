
const rawPassword = process.env.POSTGRES_PASSWORD || 'postgres';
const urlStr = `postgresql://postgres:${rawPassword}@localhost/fintekpro`;
try {
  const url = new URL(urlStr);
  console.log('Username:', url.username);
  console.log('Password:', url.password);
  console.log('Hostname:', url.hostname);
} catch (e) {
  console.error('Failed to parse URL:', e.message);
}

const urlStrEncoded = `postgresql://postgres:${encodeURIComponent(rawPassword)}@localhost/fintekpro`;
try {
  const url = new URL(urlStrEncoded);
  console.log('Encoded - Username:', url.username);
  console.log('Encoded - Password:', url.password);
  console.log('Encoded - Hostname:', url.hostname);
} catch (e) {
  console.error('Encoded - Failed to parse URL:', e.message);
}
