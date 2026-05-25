Verification steps for dashboard changes

1. Run the dev server

```
npm install
npm run dev
```

2. Open the app in your browser (usually http://localhost:5173) and login.

3. Open the Dashboard page and select a device.

4. Use the control bar:
   - Click "Start Monitoring" — a new reading will be appended every 5 seconds.
   - Observe the Timer increment and sensor gauges update.
   - Charts should update and scale as new points arrive.
   - Click "Stop Monitoring" to stop the simulator.

5. Verify exports/load:
   - Click "Save Data" to download a JSON backup.
   - Use the Cloud tab -> "Load Backup" to re-load the JSON file into local storage.

6. Run tests (automated verification):

```
npm test
```

Expect all vitest tests to pass (including `dashboard.test.ts`).
