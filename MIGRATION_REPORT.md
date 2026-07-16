# FIREBASE TO SUPABASE MIGRATION - COMPLETE REPORT

## Critical Issues Found
1. AdminPanel.tsx - Heavy Firebase dependency (lines 29, 381-920)
2. UserDashboard.tsx - Multiple Firebase queries
3. firebaseService.ts - Complete Firebase service layer
4. deviceStore.ts - Firebase device queries
5. firebaseLocationSync.ts - Firebase location sync
6. alertService.ts - Firebase alert queries
7. ComplaintForm.tsx - Firebase complaint submission
8. syncEngine.ts - Firebase sync operations

## Firebase Queries Identified (DETAILED)

### AdminPanel.tsx
```
FILE: src/pages/AdminPanel.tsx
LINE 29: import { db } from "@/firebase"
LINE 19-24: import collection, collectionGroup, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where
FUNCTION: useEffect (line 381)
FIREBASE QUERY 1: collection(db, "users")
  - onSnapshot subscription
  - Maps to: public.profiles table
  - Action: SELECT * FROM profiles

FUNCTION: useEffect (line 443)
FIREBASE QUERY 2: collection(db, "devices")
  - onSnapshot subscription
  - Maps to: public.devices table
  - Action: SELECT * FROM devices

FUNCTION: useEffect (line 471)
FIREBASE QUERY 3: collectionGroup(db, "devices")
  - onSnapshot subscription
  - Maps to: public.devices table (with nested structure)
  - Action: SELECT * FROM devices WHERE owner_uid = ?

FUNCTION: useEffect (line 604)
FIREBASE QUERY 4: collection(db, "users", uid, "devices", id, "readings")
  - onSnapshot subscription
  - Maps to: public.device_readings table
  - Action: SELECT * FROM device_readings WHERE device_id = ?

FUNCTION: deleteUserAndDevices (line 771)
FIREBASE QUERY 5: collection(db, "users", targetUserId, "devices")
  - getDocs() - single query
  - Maps to: public.devices table
  - Action: SELECT * FROM devices WHERE owner_uid = ?

FUNCTION: deleteUserAndDevices (line 773)
FIREBASE QUERY 6: query(collection(db, "devices"), where("ownerUid", "==", targetUserId))
  - getDocs() - single query with where clause
  - Maps to: public.devices table with WHERE
  - Action: SELECT * FROM devices WHERE owner_uid = ?

FUNCTION: deleteUserAndDevices (line 777)
FIREBASE QUERY 7: collection(db, "users", targetUserId, "devices", item.id, "readings")
  - getDocs() - single query
  - Maps to: public.device_readings table
  - Action: SELECT * FROM device_readings WHERE device_id = ?

FUNCTION: watchDeviceReadings (line 919)
FIREBASE QUERY 8: onSnapshot with collection(db, "users", device.ownerUid, "devices", device.id, "readings")
  - Real-time subscription
  - Maps to: public.device_readings table
  - Action: SUBSCRIBE to changes WHERE device_id = ?
```

### UserDashboard.tsx
```
FILE: src/pages/UserDashboard.tsx
LINE 97: import { db } from "@/firebase"
LINE 85-91: import collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where

FUNCTION: useEffect - Device Sync (line 317)
FIREBASE QUERY 1: collection(db, "users", user.uid, "devices")
  - onSnapshot subscription
  - Maps to: public.devices table
  - Action: SELECT * FROM devices WHERE owner_uid = ?

FUNCTION: useEffect - Device Sync (line 373)
FIREBASE QUERY 2: collection(db, "users", user.uid, "devices", deviceId, "readings")
  - getDocs() - single query
  - Maps to: public.device_readings table
  - Action: SELECT * FROM device_readings WHERE device_id = ? LIMIT 100

FUNCTION: syncDeviceFromApi (line 667)
FIREBASE QUERY 3: collection(db, "devices")
  - getDocs() - single query
  - Maps to: public.devices table
  - Action: SELECT * FROM devices

FUNCTION: syncDeviceFromApi (line 692)
FIREBASE QUERY 4: collection(db, "users", user.uid, "devices")
  - getDocs() - single query
  - Maps to: public.devices table
  - Action: SELECT * FROM devices WHERE owner_uid = ?

FUNCTION: loadAlerts (line 767)
FIREBASE QUERY 5: collection(db, "alerts")
  - getDocs() - single query
  - Maps to: public.alerts table
  - Action: SELECT * FROM alerts WHERE user_id = ? (need to add filter)
```

### firebaseService.ts
```
FILE: src/services/firebaseService.ts
LINE 10: import { db, storage } from "@/firebase"

FUNCTION: userService.getProfile (line 36)
FIREBASE QUERY: doc(db, "users", uid)
  - Maps to: public.profiles table
  - Action: SELECT * FROM profiles WHERE id = ?

FUNCTION: userService.updateProfile (line 48)
FIREBASE QUERY: doc(db, "users", uid)
  - Maps to: public.profiles table
  - Action: UPDATE profiles SET ... WHERE id = ?

FUNCTION: userService.createUserProfile (line 54)
FIREBASE QUERY: doc(db, "users", uid)
  - Maps to: public.profiles table
  - Action: INSERT INTO profiles ...

FUNCTION: deviceService.getUserDevices (line 134)
FIREBASE QUERY: collection(db, "users", uid, "devices")
  - Maps to: public.devices table
  - Action: SELECT * FROM devices WHERE owner_uid = ?

FUNCTION: notificationService.getUnreadNotifications (line 195)
FIREBASE QUERY: collection(db, "users", uid, "notifications")
  - Maps to: public.notifications table
  - Action: SELECT * FROM notifications WHERE user_id = ? AND read = false

FUNCTION: complaintService.getUserComplaints (line 274)
FIREBASE QUERY: collection(db, "users", uid, "complaints")
  - Maps to: public.complaints table
  - Action: SELECT * FROM complaints WHERE user_id = ?

FUNCTION: activityService.getRecentActivities (line 331)
FIREBASE QUERY: collection(db, "users", uid, "activities")
  - Maps to: public.activities table
  - Action: SELECT * FROM activities WHERE user_id = ?

FUNCTION: readingService.getDeviceReadings (line 384)
FIREBASE QUERY: collection(db, "users", uid, "devices", deviceId, "readings")
  - Maps to: public.device_readings table
  - Action: SELECT * FROM device_readings WHERE device_id = ?

FUNCTION: loginHistoryService.getLoginHistory (line 468)
FIREBASE QUERY: collection(db, "users", uid, "loginHistory")
  - Maps to: public.login_history table
  - Action: SELECT * FROM login_history WHERE user_id = ?
```

### deviceStore.ts
```
FILE: src/lib/deviceStore.ts
LINE 7: import { db } from "@/firebase"
LINE 2-5: import collection, query, where, getDocs

FUNCTION: loadAllDevices (line 152)
FIREBASE QUERY: collection(db, "devices")
  - getDocs() - single query
  - Maps to: public.devices table
  - Action: SELECT * FROM devices
```

### firebaseLocationSync.ts
```
FILE: src/lib/firebaseLocationSync.ts
LINE 13: import { db } from "@/firebase"

FUNCTION: syncDeviceLocations (line 37)
FIREBASE QUERY 1: collection(db, "devices")
  - onSnapshot subscription
  - Maps to: public.devices table
  - Action: SELECT * FROM devices

FUNCTION: syncDeviceLocationUpdates (line 89)
FIREBASE QUERY 2: collection(db, "deviceLocations")
  - onSnapshot subscription
  - Maps to: public.device_locations table
  - Action: SELECT * FROM device_locations

FUNCTION: subscribeToDeviceReadings (line 134)
FIREBASE QUERY 3: collection(db, "readings")
  - onSnapshot subscription
  - Maps to: public.device_readings table
  - Action: SELECT * FROM device_readings
```

### alertService.ts
```
FILE: src/services/alertService.ts
LINE 2: import { db } from "@/firebase"

FUNCTION: subscribeToUserAlerts (line 191)
FIREBASE QUERY 1: collection(db, "alerts")
  - onSnapshot subscription
  - Maps to: public.alerts table
  - Action: SELECT * FROM alerts WHERE user_id = ?

FUNCTION: subscribeToAlerts (line 265)
FIREBASE QUERY 2: collection(db, "alerts")
  - onSnapshot subscription
  - Maps to: public.alerts table
  - Action: SELECT * FROM alerts

FUNCTION: subscribeToDeviceReadings (line 288)
FIREBASE QUERY 3: collection(db, "devices/{id}/readings")
  - onSnapshot subscription
  - Maps to: public.device_readings table
  - Action: SELECT * FROM device_readings WHERE device_id = ?
```

### ComplaintForm.tsx
```
FILE: src/components/ComplaintForm.tsx
LINE 39: import { db } from "@/firebase"

FUNCTION: handleSubmit (line 205)
FIREBASE QUERY: collection(db, "complaints")
  - addDoc() insert
  - Maps to: public.complaints table
  - Action: INSERT INTO complaints ...
```

### syncEngine.ts
```
FILE: src/lib/syncEngine.ts
LINE 2: import { db } from "@/firebase"

Multiple sync operations that reference db object
```

## Supabase Tables Created ✓
- public.devices
- public.device_readings
- public.alerts
- public.complaints
- public.device_locations
- public.notifications
- public.login_history
- public.activities

## Migration Steps Completed
1. ✓ Created SQL migrations for all tables
2. ✓ Created comprehensive Supabase service (supabaseService.ts)
3. [ ] Migrate AdminPanel.tsx
4. [ ] Migrate UserDashboard.tsx
5. [ ] Migrate firebaseService.ts
6. [ ] Migrate alertService.ts
7. [ ] Migrate deviceStore.ts
8. [ ] Migrate firebaseLocationSync.ts
9. [ ] Migrate ComplaintForm.tsx
10. [ ] Migrate syncEngine.ts
11. [ ] Remove Firebase imports

## Remaining Work
- Replace all Firebase onSnapshot with Supabase realtime subscriptions
- Replace all Firebase getDocs with Supabase .select()
- Replace all Firebase setDoc/updateDoc/deleteDoc with Supabase equivalents
- Add [SUPABASE_*] logging to all queries
- Remove Firebase dependencies
- Test all admin functions
