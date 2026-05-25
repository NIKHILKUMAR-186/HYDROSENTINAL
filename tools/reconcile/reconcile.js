const fs = require('fs');
const path = require('path');

const SA_PATH = process.env.SA_PATH;
if (!SA_PATH) {
  console.error('Please set SA_PATH to your service account JSON file path.');
  process.exit(1);
}

const admin = require('firebase-admin');

try {
  const serviceAccount = require(SA_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (err) {
  console.error('Failed to load service account:', err);
  process.exit(1);
}

const firestore = admin.firestore();
const auth = admin.auth();

async function listAllAuthUsers() {
  const users = [];
  let nextPageToken = undefined;
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    users.push(...res.users.map(u => ({ uid: u.uid, email: u.email || null }))); 
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  return users;
}

async function listAllFirestoreUsers() {
  const snapshot = await firestore.collection('users').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

(async function main(){
  try {
    console.log('Fetching Auth users...');
    const authUsers = await listAllAuthUsers();
    console.log('Auth users:', authUsers.length);

    console.log('Fetching Firestore users...');
    const firestoreUsers = await listAllFirestoreUsers();
    console.log('Firestore users:', firestoreUsers.length);

    const authByEmail = new Map();
    const authByUid = new Map();
    for (const u of authUsers) {
      if (u.email) authByEmail.set(u.email.toLowerCase(), u);
      authByUid.set(u.uid, u);
    }

    const fsByEmail = new Map();
    const fsByUid = new Map();
    for (const u of firestoreUsers) {
      if (u.email) fsByEmail.set(String(u.email).toLowerCase(), u);
      fsByUid.set(u.id, u);
    }

    const report = {
      authOnly: [],
      firestoreOnly: [],
      mismatchedUidByEmail: [],
      summary: {}
    };

    // Auth users not in Firestore
    for (const a of authUsers) {
      if (!fsByUid.has(a.uid)) {
        report.authOnly.push(a);
      }
    }

    // Firestore users not in Auth
    for (const f of firestoreUsers) {
      const email = f.email ? String(f.email).toLowerCase() : null;
      if (f.id && !authByUid.has(f.id)) {
        // maybe they exist by email but different uid
        if (email && authByEmail.has(email)) {
          const matched = authByEmail.get(email);
          report.mismatchedUidByEmail.push({ firestoreId: f.id, firestoreEmail: email, authUid: matched.uid });
        } else {
          report.firestoreOnly.push(f);
        }
      }
    }

    report.summary = {
      authCount: authUsers.length,
      firestoreCount: firestoreUsers.length,
      authOnly: report.authOnly.length,
      firestoreOnly: report.firestoreOnly.length,
      mismatchedByEmail: report.mismatchedUidByEmail.length,
    };

    const outPath = path.join(__dirname, 'reconcile-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log('Report written to', outPath);
    console.log('Summary:', report.summary);
  } catch (err) {
    console.error('Reconcile failed:', err);
    process.exit(1);
  }
})();
