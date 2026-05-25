# HydroSentinal Backend

This backend syncs Firestore readings into MySQL for permanent storage and analytics.

## Folder structure

- `firebase.js` - Firebase Admin initialization using `serviceAccountKey.json`
- `db.js` - MySQL pool and table initialization
- `sync.js` - Firestore -> MySQL sync worker and realtime listener
- `server.js` - Express API server
- `sql/readings.sql` - SQL schema for the `readings` table

## Setup

1. Copy `.env.example` to `.env`.
2. Place your Firebase Admin service account file at `backend/serviceAccountKey.json`.
3. Create the MySQL database named in `MYSQL_DATABASE`.
4. Run:

```bash
npm install
npm run start
```

## Firestore document format

The sync worker expects documents in the `readings` collection with fields like:

```json
{
  "userId": "user_123",
  "deviceId": "device_abc",
  "ph": 7.1,
  "turbidity": 4.2,
  "timestamp": "2026-04-30T10:20:00.000Z",
  "synced": false
}
```

When the reading is inserted into MySQL successfully, the Firestore document is updated with:

- `synced: true`
- `syncedAt: serverTimestamp()`

## API

- `GET /health`
- `GET /readings` - returns the latest 10 readings per device, grouped by `device_id`
