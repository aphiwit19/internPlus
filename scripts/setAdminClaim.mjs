import admin from 'firebase-admin';
import fs from 'node:fs';

function usage() {
  console.error('Usage: node scripts/setAdminClaim.mjs <serviceAccountKey.json> <uid>');
  process.exit(1);
}

const keyPath = process.argv[2];
const uid = process.argv[3];
if (!keyPath || !uid) usage();

const raw = fs.readFileSync(keyPath, 'utf8');
const serviceAccount = JSON.parse(raw);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

await admin.auth().setCustomUserClaims(uid, { admin: true });

const user = await admin.auth().getUser(uid);
console.log('Updated customClaims:', user.customClaims);
