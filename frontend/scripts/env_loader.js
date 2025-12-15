// Loads repo-root .env and writes FIREBASE/GOOGLE values to frontend/.env.local
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const repoRootEnv = path.resolve(__dirname, '..', '..', '.env');
const destEnvFile = path.resolve(__dirname, '..', '.env.local');

const mapping = {
  FIREBASE_API_KEY: 'REACT_APP_FIREBASE_API_KEY',
  FIREBASE_AUTH_DOMAIN: 'REACT_APP_FIREBASE_AUTH_DOMAIN',
  FIREBASE_PROJECT_ID: 'REACT_APP_FIREBASE_PROJECT_ID',
  FIREBASE_STORAGE_BUCKET: 'REACT_APP_FIREBASE_STORAGE_BUCKET',
  FIREBASE_MESSAGING_SENDER_ID: 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  FIREBASE_APP_ID: 'REACT_APP_FIREBASE_APP_ID',
  FIREBASE_MEASUREMENT_ID: 'REACT_APP_FIREBASE_MEASUREMENT_ID',
  GOOGLE_CLIENT_ID: 'REACT_APP_GOOGLE_CLIENT_ID',
};

if (!fs.existsSync(repoRootEnv)) {
  console.log('No root .env found at', repoRootEnv, '- skipping copy.');
  process.exit(0);
}

const parsed = dotenv.parse(fs.readFileSync(repoRootEnv));

// Read existing dest env (if any) and parse
let dest = {};
if (fs.existsSync(destEnvFile)) {
  dest = dotenv.parse(fs.readFileSync(destEnvFile));
}

let written = 0;
for (const [srcKey, destKey] of Object.entries(mapping)) {
  if (Object.prototype.hasOwnProperty.call(parsed, srcKey)) {
    const val = parsed[srcKey];
    dest[destKey] = val;
    written++;
  }
}

if (written === 0) {
  console.log('No matching keys found in root .env to copy.');
  process.exit(0);
}

// Serialize dest back to file
const out = Object.entries(dest)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n') + '\n';

fs.writeFileSync(destEnvFile, out, { encoding: 'utf8', mode: 0o600 });
console.log(`Wrote ${written} vars to ${destEnvFile}`);
process.exit(0);
