# 🎨 System Architecture & Flow Diagram

## 📊 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      HYDROSENTINEL APP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              FRONTEND (React + TypeScript)             │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │                                                        │   │
│  │  Landing Page (/)  ─────→ Login Button ────────┐      │   │
│  │                                               │      │   │
│  │  Login Page (/login)                          │      │   │
│  │  ├── User Button (Select Role)         ──────┐│      │   │
│  │  │   └── Email & Password Input        │     ││      │   │
│  │  │       └── Login Button              │     ││      │   │
│  │  │                                     │     ││      │   │
│  │  └── Admin Button (Select Role) ──────┐│     ││      │   │
│  │      └── Email & Password Input │      ││     ││      │   │
│  │          └── Login Button       │      ││     ││      │   │
│  │                                 │      ││     ││      │   │
│  ├─────────────────────────────────┼──────┼┼─────┼┼──────┤   │
│  │  User Dashboard (/dashboard)   │      ││     ││      │   │
│  │  ├── Device List               │      ││     ││      │   │
│  │  ├── Location Filter           │      ││     ││      │   │
│  │  ├── Device Unique IDs         │      ││     ││      │   │
│  │  └── Location Intelligence     │      ││     ││      │   │
│  │                                │      ││     ││      │   │
│  │  Admin Panel (/admin)          │      ││     ││      │   │
│  │  ├── Add Device Form           │      ││     ││      │   │
│  │  ├── Device List Table         │      ││     ││      │   │
│  │  ├── Edit Location Inline      │      ││     ││      │   │
│  │  ├── Delete Device Buttons     │      ││     ││      │   │
│  │  └── Location Distribution     │      ││     ││      │   │
│  │                                │      ││     ││      │   │
│  └────────────────────────────────┼──────┼┼─────┼┼──────┘   │
│                                   │      ││     ││           │
└───────────────────────────────────┼──────┼┼─────┼┼───────────┘
                                    │      ││     ││
                  Firebase Auth ◄───┘      │└─────┘│
                  (Email/Password)         │       │
                                           │       │
┌──────────────────────────────────────────┼───────┼────────────┐
│              FIREBASE BACKEND             │       │            │
├──────────────────────────────────────────┼───────┼────────────┤
│                                          │       │            │
│  Authentication ◄────────────────────────┘       │            │
│  (Firebase Auth)                                 │            │
│  ├── Email/Password                             │            │
│  ├── User UID Generation                        │            │
│  └── Token Management                           │            │
│                                                 │            │
│  Firestore Database ◄───────────────────────────┘            │
│  ├── users/{uid}                                             │
│  │   ├── email                                               │
│  │   ├── role: "user" or "admin" ◄──── Role Checker         │
│  │   ├── uniqueId                                            │
│  │   └── createdAt                                           │
│  │                                                           │
│  └── devices/{docId}                                         │
│      ├── name                                                │
│      ├── uniqueId ◄────── Auto-generated for each device    │
│      ├── location ◄────── "North Zone", "South Zone", etc.  │
│      ├── status                                              │
│      └── createdAt                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Authentication Flow

```
User Visits App
       │
       ▼
┌─────────────────┐
│ Home Page (/)   │ ─── Login Button ─┐
└─────────────────┘                   │
                                      ▼
                            ┌──────────────────┐
                            │ /login Page      │
                            ├──────────────────┤
                            │ Select Role:     │
                            │ ☐ User ☐ Admin   │
                            │                  │
                            │ Email: [    ]    │
                            │ Pass:  [    ]    │
                            │ [Login Button]   │
                            └────────┬─────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                 User Selected               Admin Selected
                    │                                 │
                    ▼                                 ▼
        ┌──────────────────────┐        ┌──────────────────────┐
        │ Firebase Auth Login  │        │ Firebase Auth Login  │
        │ (Email/Password)     │        │ (Email/Password)     │
        └──────────┬───────────┘        └──────────┬───────────┘
                   │                              │
                   ▼                              ▼
        ┌──────────────────────┐        ┌──────────────────────┐
        │ Check Firestore:     │        │ Check Firestore:     │
        │ users/{uid}          │        │ users/{uid}          │
        │ role == "user" ?     │        │ role == "admin" ?    │
        └──────────┬───────────┘        └──────────┬───────────┘
                   │                              │
        Yes ◄──────┴─────────┐      ┌─────────────┘ Yes
                             ▼      ▼
                        ┌──────────────────────┐
                        │ Auth Success ✓       │
                        │ Set User Context     │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                            │
                    ▼                            ▼
        ┌──────────────────────┐    ┌──────────────────────┐
        │ /dashboard (User)     │    │ /admin (Admin)       │
        │                       │    │                      │
        │ ✓ View Devices        │    │ ✓ Add Devices        │
        │ ✓ View Unique IDs     │    │ ✓ Edit Locations     │
        │ ✓ Filter by Location  │    │ ✓ Delete Devices     │
        │ ✓ Location Intel      │    │ ✓ Manage Fleet       │
        │ ✗ Add/Edit/Delete     │    │ ✓ View Distribution  │
        └──────────────────────┘    └──────────────────────┘
```

---

## 🗄️ Firestore Database Structure

```
FIREBASE FIRESTORE
│
├── users/  (Collection)
│   │
│   ├── abc123xyz/  (Document - User UID)
│   │   ├── email: "nikhil@example.com"
│   │   ├── role: "user"
│   │   ├── uniqueId: "USER_NIKHIL01"
│   │   ├── createdAt: "2026-04-29T14:30:00Z"
│   │   └── locations: ["North Zone", "South Zone"]
│   │
│   └── xyz789def/  (Document - Admin UID)
│       ├── email: "admin@example.com"
│       ├── role: "admin"
│       ├── uniqueId: "ADMIN_MASTER01"
│       ├── createdAt: "2026-04-29T14:25:00Z"
│       └── locations: []
│
└── devices/  (Collection)
    │
    ├── device_001/  (Document)
    │   ├── name: "Water Quality Sensor - North"
    │   ├── uniqueId: "DEVICE_NORTH_001"
    │   ├── location: "North Zone"
    │   ├── status: "active"
    │   └── createdAt: "2026-04-29T15:00:00Z"
    │
    ├── device_002/  (Document)
    │   ├── name: "Water Quality Sensor - South"
    │   ├── uniqueId: "DEVICE_SOUTH_001"
    │   ├── location: "South Zone"
    │   ├── status: "active"
    │   └── createdAt: "2026-04-29T15:05:00Z"
    │
    └── device_003/  (Document)
        ├── name: "Water Quality Sensor - Central"
        ├── uniqueId: "DEVICE_CENTRAL_001"
        ├── location: "Central Hub"
        ├── status: "inactive"
        └── createdAt: "2026-04-29T15:10:00Z"
```

---

## 🌍 User Journey: Complete Workflow

### **SCENARIO 1: User Wants to Monitor Water Quality**

```
START
  ▼
Visit http://localhost:8081
  ▼
See Landing Page with Login Button
  ▼
Click "🔐 Login / Sign Up"
  ▼
Reach /login page
  ▼
Select "👤 User" Role
  ▼
Enter:
  Email: user@demo.com
  Password: password
  ▼
Click "Login"
  ▼
✓ Login successful
  ▼
Redirected to /dashboard
  ▼
Dashboard Shows:
  ├── Total Devices Count
  ├── Active Devices Count
  ├── Location Count
  ├── Device List with Unique IDs
  │   └── DEVICE_NORTH_001
  │   └── DEVICE_SOUTH_001
  │   └── DEVICE_CENTRAL_001
  ├── Location Filter Buttons
  └── Location Intelligence Cards
      └── North Zone: 1 device (DEVICE_NORTH_001)
      └── South Zone: 1 device (DEVICE_SOUTH_001)
      └── Central Hub: 1 device (DEVICE_CENTRAL_001)
  ▼
Click "North Zone" Filter
  ▼
Dashboard Updates:
  └── Shows only devices in North Zone
      └── DEVICE_NORTH_001 ✓
  ▼
Click "Logout"
  ▼
Redirected to /login
  ▼
END
```

### **SCENARIO 2: Admin Wants to Add a Device**

```
START
  ▼
Visit http://localhost:8081
  ▼
Click "🔐 Login / Sign Up"
  ▼
Select "🔐 Admin" Role
  ▼
Enter:
  Email: admin@demo.com
  Password: password
  ▼
Click "Login"
  ▼
✓ Login successful
  ▼
Redirected to /admin
  ▼
Admin Panel Shows:
  ├── Device Table (currently empty or with existing devices)
  └── [+ Add Device] Button
  ▼
Click "[+ Add Device]"
  ▼
Form Appears:
  ├── Device Name: [Water Sensor East]
  ├── Location: [Select: East Zone]
  └── [Save Device] Button
  ▼
Click "Save Device"
  ▼
Firestore Update:
  devices/{new_doc} created with:
  ├── name: "Water Sensor East"
  ├── uniqueId: "DEVICE_EAST_001" (auto-generated)
  ├── location: "East Zone"
  ├── status: "active"
  └── createdAt: "2026-04-29T16:00:00Z"
  ▼
Admin Dashboard Updates:
  └── New device appears in table
  └── New location card shows device
  ▼
Next Time User Logs In:
  ├── /dashboard shows new device
  └── East Zone filter shows device
  ▼
Click "Logout"
  ▼
END
```

---

## 🔗 Component Dependency Graph

```
App.tsx (Main Entry Point)
│
├── AuthProvider (AuthContext.tsx)
│   └── Manages authentication state
│       ├── user (Firebase user object)
│       ├── role ("user" or "admin")
│       ├── login() function
│       ├── logout() function
│       └── signup() function
│
└── BrowserRouter (React Router)
    │
    ├── ProtectedRoute Component
    │   ├── Checks if user is logged in
    │   └── Checks if user has correct role
    │
    ├── / (Landing Page - Index.tsx)
    │   └── Navigation with Login Button
    │
    ├── /login (Login.tsx)
    │   ├── Role Selection (User/Admin)
    │   ├── Email/Password Input
    │   └── useAuth() hook
    │       └── Calls login() or signup()
    │
    ├── /dashboard (UserDashboard.tsx)
    │   ├── Protected by ProtectedRoute
    │   ├── Requires role == "user"
    │   ├── Fetches devices from Firestore
    │   ├── useAuth() hook for logout
    │   ├── Device List Component
    │   ├── Location Filter
    │   └── Location Intelligence Cards
    │
    └── /admin (AdminPanel.tsx)
        ├── Protected by ProtectedRoute
        ├── Requires role == "admin"
        ├── useAuth() hook for logout
        ├── Add Device Form
        ├── Device Management Table
        ├── Location Distribution View
        └── Firestore CRUD Operations
            ├── addDoc() - Create device
            ├── getDocs() - Read devices
            ├── updateDoc() - Edit location
            └── deleteDoc() - Remove device
```

---

## 📋 Data Flow Summary

```
1. USER REGISTRATION FLOW:
   Email/Password → Firebase Auth → Creates UID
                                  → Firestore users/{uid}
                                  → Stores role
                                  → Stores uniqueId

2. USER LOGIN FLOW:
   Email/Password → Firebase Auth → Retrieves UID
                                  → Checks Firestore users/{uid}
                                  → Verifies role
                                  → Sets Auth Context
                                  → Redirects to dashboard/admin

3. DEVICE MANAGEMENT FLOW:
   Admin adds device → Form submission
                    → Firestore devices/{new}
                    → Auto-generates uniqueId
                    → Stores location
                    → User sees device in dashboard

4. LOCATION FILTERING FLOW:
   User selects location → Dashboard filters by location field
                        → Shows only devices where location == selected
                        → Updates displayed device list

5. LOGOUT FLOW:
   Click logout → signOut(auth) → Clear context
                               → Redirect to /login
```

---

## ✨ Key Points

- **Database:** All data in Firebase Firestore (not local)
- **Authentication:** Firebase Auth with custom roles in Firestore
- **User/Admin Determination:** Based on `role` field in Firestore users document
- **Location Intelligence:** Device `location` field determines where device appears
- **Unique IDs:** Auto-generated for both users and devices
- **Real-time Updates:** Changes in Firestore immediately visible in app

---

**System is fully functional and ready to use!** ✅
