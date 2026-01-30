import admin from 'firebase-admin';
import fs from 'node:fs';

function usage() {
  console.error(
    'Usage: node scripts/createCertificateTemplate.mjs <serviceAccountKey.json> <templateId> <type> <name> <backgroundPath>\n' +
      "  type: COMPLETION | RECOMMENDATION\n" +
      "  backgroundPath example: templates/backgrounds/default.png",
  );
  process.exit(1);
}

const keyPath = process.argv[2];
const templateId = process.argv[3];
const type = process.argv[4];
const name = process.argv[5];
const backgroundPath = process.argv[6];

if (!keyPath || !templateId || !type || !name || !backgroundPath) usage();

if (type !== 'COMPLETION' && type !== 'RECOMMENDATION') {
  console.error('Invalid type. Must be COMPLETION or RECOMMENDATION');
  process.exit(1);
}

const raw = fs.readFileSync(keyPath, 'utf8');
const serviceAccount = JSON.parse(raw);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

await db
  .collection('certificateTemplates')
  .doc(templateId)
  .set(
    {
      name,
      type,
      backgroundPath,
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'script',
    },
    { merge: true },
  );

console.log('Created/updated certificateTemplates/' + templateId);
