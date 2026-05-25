Firebase Auth ↔ Firestore reconciliation helper

Overview

This small scaffold helps you compare the "users" collection in Firestore with Firebase Authentication users using the Firebase Admin SDK. It produces a JSON report listing:
- Firestore users with no matching Auth UID/email
- Auth users with no matching Firestore document
- UID/email mismatches

Security

This tool requires a service account JSON file with privileges for Auth and Firestore (Firebase Admin). Do NOT commit that file to source control.

Quick usage

1. Copy your service account JSON into the project (outside version control). Example path: `~/secrets/serviceAccountKey.json`
2. From this folder, install deps:

```bash
cd tools/reconcile
npm install
```

3. Run the script:

```bash
SA_PATH="/full/path/to/serviceAccountKey.json" node reconcile.js
```

It will write `reconcile-report.json` in this folder and print a short summary.

Cloud Function

`cloudFunction.js` provides a sample Cloud Function handler you can adapt and deploy in a secure environment. It requires the Admin SDK and appropriate IAM permissions.
