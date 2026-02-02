import admin from 'firebase-admin';
import fs from 'node:fs';

function usage() {
  console.error('Usage: node scripts/migrateUserRoles.mjs <serviceAccountKey.json> [--dry-run]');
  process.exit(1);
}

const keyPath = process.argv[2];
const flags = process.argv.slice(3);
const dryRun = flags.includes('--dry-run');

if (!keyPath) usage();

const raw = fs.readFileSync(keyPath, 'utf8');
const serviceAccount = JSON.parse(raw);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function normalizeRolesFromDoc(data) {
  const existingRoles = data?.roles;
  if (Array.isArray(existingRoles) && existingRoles.length > 0) {
    return { roles: existingRoles, source: 'roles' };
  }

  const legacyRole = data?.role;
  if (typeof legacyRole === 'string' && legacyRole.trim()) {
    return { roles: [legacyRole.trim()], source: 'role' };
  }

  if (data?.isDualRole === true) {
    return { roles: ['SUPERVISOR', 'HR_ADMIN'], source: 'isDualRole' };
  }

  // Fallback to INTERN to avoid locking a user out.
  return { roles: ['INTERN'], source: 'fallback' };
}

function rolesEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const as = [...a].map(String).sort();
  const bs = [...b].map(String).sort();
  for (let i = 0; i < as.length; i += 1) {
    if (as[i] !== bs[i]) return false;
  }
  return true;
}

const usersRef = db.collection('users');

let updated = 0;
let scanned = 0;
let skipped = 0;

let lastDoc = null;
const pageSize = 300;

while (true) {
  let q = usersRef.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
  if (lastDoc) q = q.startAfter(lastDoc);

  const snap = await q.get();
  if (snap.empty) break;

  for (const docSnap of snap.docs) {
    scanned += 1;
    const data = docSnap.data() || {};

    const currentRoles = Array.isArray(data.roles) ? data.roles : null;
    const { roles: nextRoles, source } = normalizeRolesFromDoc(data);

    const needsWrite = !rolesEqual(currentRoles ?? [], nextRoles);

    if (!needsWrite) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log('[DRY-RUN] would update', docSnap.id, { from: currentRoles, to: nextRoles, source });
      continue;
    }

    await docSnap.ref.set(
      {
        roles: nextRoles,
        rolesMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    updated += 1;
    console.log('updated', docSnap.id, { from: currentRoles, to: nextRoles, source });
  }

  lastDoc = snap.docs[snap.docs.length - 1];
}

console.log('Done.', { scanned, updated: dryRun ? 'dry-run' : updated, skipped });
