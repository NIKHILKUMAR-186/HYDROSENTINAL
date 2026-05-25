# HydroSentinal Complaint Form System

## Overview
This is a production-ready complaint management system integrated with Formspree and Firebase, providing users with an easy way to report water quality issues and system problems.

## Components

### 1. `ComplaintForm.tsx`
The main complaint form modal component with comprehensive functionality.

**Features:**
- 9 form fields with validation
- Formspree integration (endpoint: `https://formspree.io/f/xwvyrepy`)
- Firebase Firestore auto-storage
- Auto-fill user email from Firebase Auth
- File upload support (max 5MB)
- Beautiful glassmorphism UI with water-theme gradient
- Dark/light mode support
- Loading states and animations
- Success confirmation with tracking ID
- Error handling and user feedback
- Accessibility features (labels, focus states, aria attributes)

**Props:**
```typescript
interface ComplaintFormProps {
  open: boolean;                      // Modal open state
  onOpenChange: (open: boolean) => void;  // Callback to change open state
  preselectedDeviceId?: string;       // Auto-fill device ID (optional)
}
```

**Form Fields:**
1. Full Name (required)
2. Email (required, auto-filled)
3. Device ID (required, auto-fillable)
4. Category (required) - Water Quality, Device Offline, Sensor Error, Wrong Data, Leakage, Other
5. Severity (required) - Low, Medium, High, Emergency
6. Location (required)
7. Complaint Message (required)
8. Screenshot Upload (optional, max 5MB)

**Data Flow:**
1. User fills form with validation
2. Click submit
3. Generate unique complaint ID (CMP-TIMESTAMP-RANDOMSTRING)
4. Send to Formspree via POST
5. Store copy in Firebase Firestore (`complaints` collection)
6. Show success message with tracking ID
7. Auto-close after 2.5 seconds

### 2. `HelpSupportSection.tsx`
Complete Help & Support landing section component.

**Includes:**
- Quick action cards (Raise Complaint, Emergency Hotline, Email Support)
- 6-item FAQ Accordion
- Feature highlights cards
- Contact information cards
- Responsive grid layout
- Smooth animations and transitions

### 3. `ComplaintWidget.tsx`
Lightweight button widget to trigger complaint form.

**Usage:**
```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<ComplaintWidget preselectedDeviceId="DEV-12345" />
```

### 4. `Help.tsx` (Page)
Standalone Help page with navigation.

## Integration Points

### Adding to UserDashboard
The Help section is already integrated as a tab in `UserDashboard.tsx`:

```typescript
import HelpSupportSection from "@/components/HelpSupportSection";

// In the Help tab:
{activeTab === "Help" && (
  <motion.section>
    <HelpSupportSection />
  </motion.section>
)}
```

### Adding to Navigation
Create a link in your navigation menu:

```typescript
import { Link } from "react-router-dom";

<Link to="/help" className="...">
  Help & Support
</Link>
```

### Adding to Device Cards
Use the widget in device detail components:

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<ComplaintWidget preselectedDeviceId={device.id} />
```

## Formspree Setup

### Email Notifications
When complaints are submitted, Formspree will:
1. Send email to configured recipient
2. Attach the complaint tracking ID
3. Include all form data (file upload ready)

### Configuration
The endpoint is hardcoded: `https://formspree.io/f/xwvyrepy`

To change the endpoint:
1. Create new form at https://formspree.io
2. Copy the form ID
3. Update the URL in `ComplaintForm.tsx` (line ~186)

## Firebase Setup

### Firestore Collections
Complaints are stored in: `complaints` collection with this structure:

```typescript
{
  complaintId: "CMP-1716118225000-A9B8C7D6",
  userId: "user-uid",
  email: "user@email.com",
  fullName: "John Doe",
  deviceId: "DEV-12345",
  category: "water-quality",
  severity: "high",
  location: "North Zone",
  message: "Water appears cloudy...",
  hasScreenshot: true,
  status: "received",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Required Firestore Rules
```javascript
match /complaints/{document=**} {
  allow create: if request.auth != null;
  allow read, update: if request.auth.uid == resource.data.userId;
}
```

## Styling

### Color Scheme
- Primary: Cyan/Blue gradients (`#06b6d4` to `#3b82f6`)
- Secondary: Purple accents (`#9333ea`)
- Dark backgrounds: Slate 900/950
- Success: Emerald (`#10b981`)
- Error: Red (`#ef4444`)

### Responsive Breakpoints
- Mobile: max-w-full
- Tablet: 2 columns
- Desktop: 3+ columns

### Theme Support
- Automatic dark/light mode detection
- Uses Tailwind CSS dark mode
- Respects system preferences

## Accessibility

✓ Semantic HTML
✓ ARIA labels on form inputs
✓ Keyboard navigation support
✓ Focus states on all interactive elements
✓ Error messages associated with form fields
✓ Screen reader friendly success messages
✓ Proper color contrast ratios

## Error Handling

The system handles:
- Empty/invalid form fields
- Network connectivity failures
- Formspree submission errors
- Firebase Firestore storage failures (non-blocking)
- File upload size validation (max 5MB)
- Email validation
- Server timeout issues

**User Experience:**
- Toast notifications for errors
- Inline validation messages
- Disabled submit button during submission
- Automatic retry capable through modal reopen

## Usage Examples

### Example 1: Basic Usage
```typescript
import { useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";

function MyComponent() {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setOpen(true)}>Report Issue</button>
      <ComplaintForm open={open} onOpenChange={setOpen} />
    </>
  );
}
```

### Example 2: With Device Pre-selection
```typescript
<ComplaintForm 
  open={open} 
  onOpenChange={setOpen}
  preselectedDeviceId={currentDevice.id}
/>
```

### Example 3: In Device Detail Popup
```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<div className="device-actions">
  <Button>View Details</Button>
  <ComplaintWidget preselectedDeviceId={device.id} />
</div>
```

## Performance Optimizations

- Lazy loading of form modal
- Optimized animations with Framer Motion
- Minimal re-renders with React state management
- Debounced form validation
- Efficient Firestore queries
- Client-side caching where applicable

## Analytics Integration (Future)

To track complaints:
```typescript
// Track complaint submission
analytics.logEvent('complaint_submitted', {
  category: formData.category,
  severity: formData.severity,
  deviceId: formData.deviceId,
});
```

## Troubleshooting

### Complaints not reaching Formspree
- Verify endpoint URL is correct
- Check Formspree email configuration
- Ensure form field names match (name attributes)

### Firestore storage failing silently
- Check Firestore security rules
- Verify user authentication
- Check Firebase quota limits

### Modal not opening
- Ensure Dialog component is properly imported
- Check if modal is being rendered in Dialog root

### Auto-fill not working
- Verify user is authenticated via Firebase Auth
- Check if `useAuth()` hook returns user email
- Ensure `useAuth` context is properly wrapped

## Future Enhancements

- Complaint history/tracking dashboard
- Real-time notification bell
- Complaint priority queue system
- Integration with SMS alerts
- ML-based complaint categorization
- Average response time metrics
- Customer satisfaction feedback
- Complaint timeline/status updates
