# Complaint Form - Quick Reference

## 1️⃣ Basic Modal (Most Common)

```typescript
import { useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import { Button } from "@/components/ui/button";

export function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Report Issue</Button>
      <ComplaintForm open={open} onOpenChange={setOpen} />
    </>
  );
}
```

---

## 2️⃣ With Device Pre-selection

```typescript
<ComplaintForm 
  open={open} 
  onOpenChange={setOpen}
  preselectedDeviceId={device.id}
/>
```

---

## 3️⃣ Quick Access Widget

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<ComplaintWidget preselectedDeviceId={selectedDevice?.id} />
```

---

## 4️⃣ Floating Action Button

```typescript
import FloatingComplaintButton from "@/components/FloatingComplaintButton";

// Add at bottom of page
<FloatingComplaintButton preselectedDeviceId={selectedDeviceId} />
```

---

## 5️⃣ Help & Support Section

```typescript
import HelpSupportSection from "@/components/HelpSupportSection";

<div className="help-container">
  <HelpSupportSection />
</div>
```

---

## 6️⃣ In Device Card

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<Card>
  <CardContent>
    <p>{device.name}</p>
    <div className="flex gap-2">
      <Button>Details</Button>
      <ComplaintWidget preselectedDeviceId={device.id} />
    </div>
  </CardContent>
</Card>
```

---

## 7️⃣ On Alert

```typescript
import ComplaintForm from "@/components/ComplaintForm";

<Alert>
  <AlertContent>
    <p>Water quality issue detected!</p>
    <Button onClick={() => setComplaintOpen(true)}>Report</Button>
  </AlertContent>
  
  <ComplaintForm 
    open={complaintOpen} 
    onOpenChange={setComplaintOpen}
    preselectedDeviceId={alert.deviceId}
  />
</Alert>
```

---

## 8️⃣ In Navigation Menu

```typescript
import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";

<nav>
  <Link to="/dashboard">Dashboard</Link>
  <Link to="/help" className="flex items-center gap-2">
    <HelpCircle className="h-4 w-4" />
    Help & Support
  </Link>
</nav>
```

---

## 9️⃣ In Chat Context Menu

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<Menu>
  <MenuItem>Export</MenuItem>
  <MenuItem>Archive</MenuItem>
  <Separator />
  <MenuItem asChild>
    <ComplaintWidget preselectedDeviceId={deviceId} />
  </MenuItem>
</Menu>
```

---

## 🔟 Dashboard Header

```typescript
import ComplaintWidget from "@/components/ComplaintWidget";

<header className="flex justify-between items-center">
  <h1>Dashboard</h1>
  <div className="flex gap-2">
    <ThemeToggle />
    <ComplaintWidget />
  </div>
</header>
```

---

## Form Fields Reference

| Field | Type | Required | Auto-fill |
|-------|------|----------|-----------|
| Full Name | Text | ✅ | ❌ |
| Email | Email | ✅ | ✅ Firebase |
| Device ID | Text | ✅ | ✅ Prop |
| Category | Select | ✅ | ❌ |
| Severity | Select | ✅ | ❌ |
| Location | Text | ✅ | ❌ |
| Message | Textarea | ✅ | ❌ |
| Screenshot | File | ❌ | ❌ |

---

## Category Options

```typescript
[
  "water-quality",
  "device-offline",
  "sensor-error",
  "wrong-data",
  "leakage",
  "other"
]
```

---

## Severity Options

```typescript
[
  "low",      // Blue indicator
  "medium",   // Yellow indicator
  "high",     // Orange indicator
  "emergency" // Red indicator
]
```

---

## Props Quick Reference

### ComplaintForm
```typescript
interface ComplaintFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDeviceId?: string;
}
```

### ComplaintWidget
```typescript
interface ComplaintWidgetProps {
  preselectedDeviceId?: string;
}
```

### FloatingComplaintButton
```typescript
interface FloatingComplaintButtonProps {
  preselectedDeviceId?: string;
}
```

---

## Routing

```typescript
// In App.tsx routes
<Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
```

**Access**: `/help`

---

## Styling Classes (Tailwind)

### Modal Background
```
bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
```

### Gradient Text
```
text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text
```

### Button Gradient
```
bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500
```

### Error Border
```
border-red-500/50
```

---

## Toast Notifications

```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

// Success
toast({
  title: "Success",
  description: "Complaint submitted",
});

// Error
toast({
  title: "Error",
  description: "Failed to submit",
  variant: "destructive",
});
```

---

## Firebase Queries

### Get User's Complaints
```typescript
import { collection, query, where, getDocs } from "firebase/firestore";

const complaintsRef = collection(db, "complaints");
const q = query(complaintsRef, where("userId", "==", user.uid));
const complaints = await getDocs(q);
```

### Get Specific Complaint
```typescript
const complaintRef = doc(db, "complaints", complaintId);
const complaint = await getDoc(complaintRef);
```

---

## Error Handling Examples

### Try-Catch Pattern
```typescript
try {
  // Form submission
  const response = await fetch(formspreeUrl, { method: "POST", body });
  if (!response.ok) throw new Error("Network error");
  
  // Success handling
  setSuccess(true);
} catch (error) {
  toast({
    title: "Failed",
    description: error.message,
    variant: "destructive",
  });
}
```

---

## Testing Snippets

### Test Form Opens
```typescript
test("opens complaint form", () => {
  const { getByText } = render(
    <ComplaintForm open={true} onOpenChange={jest.fn()} />
  );
  expect(getByText("Full Name")).toBeInTheDocument();
});
```

### Test Field Validation
```typescript
test("validates email field", () => {
  const { getByPlaceholderText } = render(
    <ComplaintForm open={true} onOpenChange={jest.fn()} />
  );
  
  fireEvent.change(getByPlaceholderText("your@email.com"), {
    target: { value: "invalid" }
  });
  
  fireEvent.click(getByText("Submit"));
  
  expect(getByText(/valid email/i)).toBeInTheDocument();
});
```

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Form won't open | Check `open` prop is true |
| Formspree not receiving | Verify endpoint matches form ID |
| Auto-fill not working | Ensure user authenticated |
| File upload failing | Check max size (5MB) |
| Modal behind other elements | Check z-index (default 50) |
| Dark mode not working | Verify ThemeProvider wraps app |

---

## Performance Tips

### Lazy Load
```typescript
const ComplaintForm = lazy(() => import("@/components/ComplaintForm"));
```

### Memoize
```typescript
const Widget = React.memo(ComplaintWidget);
```

### Conditional Render
```typescript
{isComplaintRelevant && <ComplaintWidget deviceId={id} />}
```

---

## Accessibility Tips

✅ Use semantic labels:
```typescript
<label htmlFor="fullName">Full Name</label>
<input id="fullName" name="fullName" />
```

✅ Add ARIA labels:
```typescript
<input aria-label="Full Name" />
```

✅ Focus management:
```typescript
<Dialog onOpenChange={() => firstInputRef.current?.focus()} />
```

---

## Environment Setup

No env variables needed!

All configs are in code:
- Formspree: `https://formspree.io/f/xwvyrepy`
- Firebase: Configured in `firebase.js`
- Tailwind: `tailwind.config.ts`

---

## Browser Support

✅ Chrome/Edge (latest)
✅ Firefox (latest)
✅ Safari (latest)
✅ Mobile browsers

---

## File Sizes

| File | Size | Note |
|------|------|------|
| ComplaintForm.tsx | ~15 KB | Minified |
| HelpSupportSection.tsx | ~12 KB | Minified |
| ComplaintWidget.tsx | ~2 KB | Very light |
| FloatingComplaintButton.tsx | ~3 KB | Very light |

**Total**: ~32 KB (minified + gzipped)

---

## Import Paths

```typescript
import ComplaintForm from "@/components/ComplaintForm";
import HelpSupportSection from "@/components/HelpSupportSection";
import ComplaintWidget from "@/components/ComplaintWidget";
import FloatingComplaintButton from "@/components/FloatingComplaintButton";
```

---

## Quick Start (Copy-Paste)

### Step 1: Add to component
```typescript
import { useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";

function MyComponent() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Report</button>
      <ComplaintForm open={open} onOpenChange={setOpen} />
    </>
  );
}
```

### Step 2: Done! ✅

That's it. The form is ready to use!

---

**Need help?** Check the full documentation files:
- `COMPLAINT_FORM_DOCUMENTATION.md`
- `COMPLAINT_FORM_INTEGRATION_GUIDE.md`
