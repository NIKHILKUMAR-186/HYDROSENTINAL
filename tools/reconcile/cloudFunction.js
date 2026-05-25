const admin = require('firebase-admin');

// This handler expects the service account to be provided via environment
// variables when deployed (e.g. GOOGLE_APPLICATION_CREDENTIALS) or the
// project default service account.

if (!admin.apps.length) {
  admin.initializeApp();
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

exports.reconcile = async (req, res) => {
  try {
    const authUsers = await listAllAuthUsers();
    const firestoreUsers = await listAllFirestoreUsers();

    // Minimal output for dashboarding; for more, reuse the reconcile.js logic
    const report = {
      authCount: authUsers.length,
      firestoreCount: firestoreUsers.length,
    };

    res.status(200).json(report);
  } catch (err) {
    console.error('Cloud reconcile error', err);
    res.status(500).json({ error: String(err) });
  }
};
