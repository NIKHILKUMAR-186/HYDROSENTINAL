# Complaint Form Integration Guide

## Quick Start

### 1. Basic Implementation in Any Component

```typescript
import { useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import { Button } from "@/components/ui/button";

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Report Issue
      </Button>
      
      <ComplaintForm 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </>
  );
}
```

---

## Integration Examples

### A. Device Card Quick Complaint
Add to `SensorCard.tsx` or device list item:

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<div className="device-card-footer">
  <Button variant="outline">View Details</Button>
  <ComplaintWidget preselectedDeviceId={device.id} />
</div>
```

### B. Dashboard Header Button
Add to `UserDashboard.tsx` header:

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<div className="dashboard-header">
  <h1>Dashboard</h1>
  <div className="header-actions">
    <ThemeToggle />
    <ComplaintWidget />
  </div>
</div>
```

### C. Floating Action Button
Add to the main dashboard for persistent access:

```typescript
import FloatingComplaintButton from "@/components/FloatingComplaintButton";

export function UserDashboard() {
  return (
    <>
      {/* Main content */}
      <div className="dashboard-content">
        {/* ... */}
      </div>
      
      {/* Floating button */}
      <FloatingComplaintButton preselectedDeviceId={selectedDeviceId} />
    </>
  );
}
```

### D. Help & Support Page
Already integrated! Just visit `/help` or click Help in dashboard.

```typescript
import HelpSupportSection from "@/components/HelpSupportSection";

<HelpSupportSection />
```

### E. Alert Panel Integration
Add complaint button when alert is triggered:

```typescript
import ComplaintForm from "@/components/ComplaintForm";

export function AlertPanel({ alert }) {
  const [complaintOpen, setComplaintOpen] = useState(false);

  return (
    <div className="alert-container">
      <AlertContent alert={alert} />
      
      <Button 
        variant="destructive" 
        onClick={() => setComplaintOpen(true)}
      >
        Report This Issue
      </Button>

      <ComplaintForm 
        open={complaintOpen} 
        onOpenChange={setComplaintOpen}
        preselectedDeviceId={alert.deviceId}
      />
    </div>
  );
}
```

### F. Chat Panel Context Menu
Add complaint option in chat:

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<Menu>
  <MenuItem>Archive Chat</MenuItem>
  <MenuItem>Export Chat</MenuItem>
  <Separator />
  <MenuItem asChild>
    <ComplaintWidget preselectedDeviceId={deviceId} />
  </MenuItem>
</Menu>
```

---

## Advanced Usage

### Pre-filling Device Context
When opening complaint form from device-specific context:

```typescript
<ComplaintForm
  open={open}
  onOpenChange={setOpen}
  preselectedDeviceId={selectedDevice.id}
/>
```

The form will auto-fill:
- Device ID
- User email (from Firebase Auth)

### Capturing Device Context in Complaint

The device ID is captured when complaint is submitted:
```json
{
  "complaintId": "CMP-1716118225000-A9B8C7D6",
  "deviceId": "DEV-12345",
  "category": "water-quality",
  "severity": "high"
}
```

### Listening for Submission Success

```typescript
const [complaintId, setComplaintId] = useState<string>("");

const handleComplaintSuccess = (id: string) => {
  setComplaintId(id);
  // Track in analytics
  analytics.logEvent('complaint_submitted', { id });
  // Show notification
  showNotification(`Complaint ${id} submitted`);
};
```

---

## Styling Customization

### Override Form Colors
Edit `ComplaintForm.tsx` gradient classes:

```typescript
// Change primary color from cyan to blue
className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
```

### Change Modal Size
Edit dialog max-width:

```typescript
<DialogContent className="max-w-2xl"> {/* or max-w-3xl, max-w-lg */}
```

### Custom Submit Button Text
Edit button label:

```typescript
<Button type="submit">
  {loading ? "Submitting..." : "Submit Report"}
</Button>
```

---

## Form Field Customization

### Add Custom Field
Edit `ComplaintForm.tsx` in form section:

```typescript
{/* New Field */}
<div className="space-y-2">
  <label className="block text-sm font-medium text-slate-300">
    Water Meter Reading <span className="text-red-400">*</span>
  </label>
  <Input
    name="meterReading"
    placeholder="e.g., 1234.56"
    value={formData.meterReading || ""}
    onChange={(e) => setFormData({ ...formData, meterReading: e.target.value })}
  />
</div>
```

### Change Category Options
Edit SelectContent in Category section:

```typescript
<SelectItem value="bacterial-contamination">Bacterial Contamination</SelectItem>
<SelectItem value="chemical-imbalance">Chemical Imbalance</SelectItem>
{/* ... */}
```

---

## Email Notification Customization

### Update Formspree Recipient
1. Log in to https://formspree.io
2. Find form `xwvyrepy`
3. Settings → Email → Change recipient
4. Resave

### Add Notification Rules
In Formspree dashboard:
- Add conditional notifications
- Set auto-responder email
- Create templates for different complaint types

---

## Firebase Integration

### View Complaints in Console
```
firebaseapp.com → Firestore → complaints collection
```

### Query Recent Complaints
```typescript
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

const recentComplaints = await getDocs(
  query(
    collection(db, "complaints"),
    where("status", "==", "received"),
    orderBy("createdAt", "desc"),
    limit(10)
  )
);
```

### Create Complaint Dashboard
```typescript
<Card>
  <CardHeader>
    <CardTitle>Recent Complaints</CardTitle>
  </CardHeader>
  <CardContent>
    {complaints.map(complaint => (
      <div key={complaint.id}>
        <p>{complaint.fullName} - {complaint.category}</p>
        <p className="text-sm text-gray-500">{complaint.message}</p>
        <Badge>{complaint.severity}</Badge>
      </div>
    ))}
  </CardContent>
</Card>
```

---

## Analytics & Tracking

### Track Complaint Opens
```typescript
const handleComplaintOpen = () => {
  analytics.logEvent('complaint_form_opened', {
    source: 'dashboard',
    deviceId: selectedDevice?.id,
  });
};
```

### Track Submissions
```typescript
const handleSubmitSuccess = (id: string) => {
  analytics.logEvent('complaint_submitted', {
    category: formData.category,
    severity: formData.severity,
    hadScreenshot: !!formData.screenshot,
    trackingId: id,
  });
};
```

---

## Error Handling

### Toast Notification on Error
The form automatically shows toast on error:

```typescript
toast({
  title: "Submission Failed",
  description: "Please try again or contact support",
  variant: "destructive",
});
```

### Custom Error Handler
Extend ComplaintForm with custom error callback:

```typescript
const handleError = (error: Error) => {
  console.error("Complaint failed:", error);
  // Send to error tracking service
  Sentry.captureException(error);
};
```

---

## Accessibility

The form includes:
- ✅ Semantic HTML labels
- ✅ ARIA labels for form fields
- ✅ Focus management
- ✅ Keyboard navigation
- ✅ Error announcements
- ✅ Color-safe severity indicators

### Test Accessibility
```bash
npm run test:a11y
```

---

## Mobile Optimization

The form is fully responsive:
- 📱 Mobile: Single column, full-width
- 📱 Tablet: 2 columns
- 🖥️ Desktop: 3 columns (where applicable)

Tested on:
- iPhone 12/13/14/15
- Android devices (320px+)
- iPad/Tablets

---

## Performance Tips

### Lazy Load Complaint Components
```typescript
const ComplaintForm = lazy(() => import("@/components/ComplaintForm"));

<Suspense fallback={<Skeleton />}>
  <ComplaintForm open={open} onOpenChange={setOpen} />
</Suspense>
```

### Memoize to Prevent Re-renders
```typescript
const MemoizedComplaintWidget = React.memo(ComplaintWidget);

<MemoizedComplaintWidget preselectedDeviceId={id} />
```

---

## Testing

### Unit Test Example
```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import ComplaintForm from "@/components/ComplaintForm";

test("opens form on button click", () => {
  const { getByText } = render(
    <ComplaintForm open={true} onOpenChange={jest.fn()} />
  );
  
  expect(getByText("Full Name")).toBeInTheDocument();
});
```

### Integration Test
```typescript
test("submits complaint successfully", async () => {
  const { getByPlaceholderText, getByText } = render(
    <ComplaintForm open={true} onOpenChange={jest.fn()} />
  );
  
  fireEvent.change(getByPlaceholderText("Your full name"), {
    target: { value: "John Doe" }
  });
  
  fireEvent.click(getByText("Submit Complaint"));
  
  // Assert form submission
});
```

---

## Troubleshooting

### Form Won't Open
- Check if `open` prop is true
- Verify Dialog provider is in DOM
- Check console for errors

### Formspree Not Receiving
- Verify endpoint in ComplaintForm.tsx matches your form ID
- Check form field `name` attributes match
- Test with Formspree test endpoint first

### Auto-fill Not Working
- Ensure user is authenticated
- Check if `useAuth()` returns user object
- Verify AuthContext wraps the component

### File Upload Not Working
- Check browser file API support
- Verify size limit (5MB)
- Check CORS settings on server

---

## Support

For issues or questions:
1. Check COMPLAINT_FORM_DOCUMENTATION.md
2. Review code comments in ComplaintForm.tsx
3. Check Formspree documentation
4. Test in browser DevTools

---

## Deployment Checklist

- [ ] Update Formspree endpoint if needed
- [ ] Test form submission in staging
- [ ] Verify Firebase security rules
- [ ] Test file upload with max size
- [ ] Test dark mode
- [ ] Test on mobile devices
- [ ] Test keyboard navigation
- [ ] Verify error messages display
- [ ] Check email notifications arrive
- [ ] Monitor Firestore quota
- [ ] Set up analytics tracking
