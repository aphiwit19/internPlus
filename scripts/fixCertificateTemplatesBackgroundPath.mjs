import admin from 'firebase-admin';
import fs from 'node:fs';

function usage() {
  console.error(
    'Usage: node scripts/fixCertificateTemplatesBackgroundPath.mjs <serviceAccountKey.json> <backgroundPath> [--dry-run]\n' +
      'Example: node scripts/fixCertificateTemplatesBackgroundPath.mjs C:/path/key.json templates/backgrounds/certificate-background-template.jpg --dry-run',
  );
  process.exit(1);
}

const keyPath = process.argv[2];
const backgroundPath = process.argv[3];
const dryRun = process.argv.includes('--dry-run');
if (!keyPath || !backgroundPath) usage();

const raw = fs.readFileSync(keyPath, 'utf8');
const serviceAccount = JSON.parse(raw);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const col = db.collection('certificateTemplates');
const snap = await col.get();

if (snap.empty) {
  console.log('No documents found in certificateTemplates');
  process.exit(0);
}

let updated = 0;
for (const docSnap of snap.docs) {
  const data = docSnap.data() ?? {};
  const currentPath = data.backgroundPath;
  const currentUrl = data.backgroundUrl;

  const shouldUpdate =
    typeof currentPath !== 'string' ||
    currentPath.trim() === '' ||
    // If backgroundUrl exists but points to a different object name, prefer the known good backgroundPath
    (typeof currentUrl === 'string' && !currentUrl.includes(encodeURIComponent(backgroundPath)));

  if (!shouldUpdate) continue;

  updated += 1;

  if (dryRun) {
    console.log('Would update template:', docSnap.id, { from: currentPath ?? null, to: backgroundPath });
    continue;
  }

  await col.doc(docSnap.id).set(
    {
      backgroundPath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'script-fix-backgroundPath',
    },
    { merge: true },
  );

  console.log('Updated template:', docSnap.id);
}

console.log(dryRun ? 'Dry-run complete. Templates to update:' : 'Done. Updated templates:', updated);
