# HydroSentinel - Authentication & Role-Based System

## System Overview

The application now includes a complete authentication system with two user roles:

### 1. **User Role** 👤
- View all devices and their status
- See devices filtered by location
- Monitor water quality metrics across different zones
- View location intelligence and device health
- Real-time device tracking with unique IDs

### 2. **Admin Role** 🔐
- Add and manage water quality monitoring devices
- Assign devices to specific locations
- Edit location assignments
- Delete devices
- Full control over the device fleet
- View location-wise device distribution

## File Structure

```
src/
├── contexts/
│   └── AuthContext.tsx          # Authentication logic and role management
├── pages/
│   ├── Login.tsx                # Login/Signup page with role selection
│   ├── UserDashboard.tsx        # User dashboard with device listing
│   ├── AdminPanel.tsx           # Admin panel for device management
│   ├── Index.tsx                # Main landing page
│   └── NotFound.tsx             # 404 page
├── App.tsx                      # Updated with routing and auth
└── firebase.js                  # Firebase config with Auth & Firestore
```

## Features Implemented

### Authentication
- ✅ Email/Password authentication using Firebase Auth
- ✅ Role-based access control (RBAC)
- ✅ Protected routes based on user role
- ✅ User session management
- ✅ Automatic role verification on login

### User Dashboard
- ✅ Device listing with unique IDs
- ✅ Location-based filtering
- ✅ Device status indicators (Active/Inactive)
- ✅ Location intelligence cards
- ✅ Real-time device health monitoring
- ✅ Statistics dashboard

### Admin Panel
- ✅ Add new devices with automatic unique ID generation
- ✅ Assign devices to locations
- ✅ Edit device locations
- ✅ Delete devices
- ✅ Location-wise device distribution view
- ✅ Comprehensive device management interface

### Data Structure

**Users Collection** (`firestore: users/{uid}`)
```json
{
  "email": "user@example.com",
  "role": "user",
  "createdAt": "2026-04-29T10:00:00Z",
  "locations": ["default"],
  "uniqueId": "USER_A1B2C3D4"
}
```

**Devices Collection** (`firestore: devices/{deviceId}`)
```json
{
  "name": "Water Quality Sensor 1",
  "uniqueId": "DEVICE_ABC12345",
  "location": "North Zone",
  "status": "active",
  "createdAt": "2026-04-29T10:00:00Z"
}
```

## Setup Instructions

### 1. Firebase Setup
The app is already configured with your Firebase project. Ensure these services are enabled:
- ✅ Authentication (Email/Password)
- ✅ Firestore Database
- ✅ Firestore Rules (set to allow reads/writes for testing)

### 2. Initialize Demo Accounts

Run the following commands in your Firebase Console or use the Firestore UI to create:

**Demo User Account:**
```
Email: user@demo.com
Password: password
Role: user
```

**Demo Admin Account:**
```
Email: admin@demo.com
Password: password
Role: admin
```

### 3. Add Sample Devices (Optional)

Use the Admin Panel to add devices:
1. Login as admin@demo.com
2. Click "Add Device"
3. Enter device name and select location
4. Device gets unique ID automatically

### 4. Run the Application

```bash
npm run dev
```

Access at `http://localhost:5173`

## Navigation Flow

```
┌─ Login Page (/login)
│  ├─ Select "User" Role → User Dashboard (/dashboard)
│  └─ Select "Admin" Role → Admin Panel (/admin)
│
├─ Landing Page (/)
└─ Dashboard Routes Protected
   ├─ /dashboard (Users only)
   └─ /admin (Admins only)
```

## User Journeys

### User Journey
1. Go to `/login`
2. Select "User" radio button
3. Enter credentials (user@demo.com / password)
4. Click "Login"
5. View all devices with their unique IDs
6. Filter by location
7. See location intelligence cards
8. Logout when done

### Admin Journey
1. Go to `/login`
2. Select "Admin" radio button
3. Enter credentials (admin@demo.com / password)
4. Click "Login"
5. View all devices in table format
6. Click "Add Device" to create new device
7. Edit location assignments
8. Delete devices as needed
9. View location-wise distribution
10. Logout when done

## Key Components

### AuthContext.tsx
Provides:
- `useAuth()` hook for accessing auth state
- `login()` function with role verification
- `signup()` function with role storage
- `logout()` function
- Protected route wrapping

### Login.tsx
Features:
- Role selector (User/Admin)
- Email/Password form
- Toggle between login and signup
- Error handling
- Demo credentials display

### UserDashboard.tsx
Features:
- Device listing with unique IDs
- Location filtering
- Device health status
- Statistics cards
- Location intelligence view
- Responsive grid layout

### AdminPanel.tsx
Features:
- Device management table
- Add device form
- Inline location editing
- Device deletion
- Location distribution cards
- User email display

## Database Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /devices/{document=**} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Future Enhancements

- [ ] Real sensor data integration
- [ ] Device telemetry dashboard
- [ ] Alert system for water quality
- [ ] User notifications
- [ ] Device firmware updates
- [ ] Historical data visualization
- [ ] Export reports
- [ ] Multi-language support
- [ ] Two-factor authentication

## Troubleshooting

### "Role mismatch" error on login
- Ensure the user exists in Firestore with correct role
- Check the user document in `users/{uid}` collection

### Devices not showing
- Admin must add devices first
- Check Firestore `devices` collection
- Verify Firestore rules allow reads

### Protected routes not working
- Clear browser cache
- Check AuthContext provider wraps App
- Verify Firebase Auth is initialized

## Testing

To test the full flow:
1. Create new accounts with different roles
2. Login as user and view devices
3. Login as admin and add devices
4. Switch between user and admin accounts
5. Verify location filtering works
6. Test device management features

---

**Version:** 1.0.0  
**Last Updated:** April 29, 2026
