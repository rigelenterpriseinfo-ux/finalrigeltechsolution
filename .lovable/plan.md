

## Plan to Fix Purchase Module Action Buttons

### Issue
OWNER and ADMIN users cannot see action buttons (Add Supplier, Create PO, Create GRN, Create DN, Add Credit Note) because the `hasEditAccess()` function only grants automatic access for `company_profile` section, not for other sections.

### Solution
Modify `useBusinessAuth.tsx` to grant automatic edit access to OWNER and ADMIN roles for ALL sections, not just `company_profile`.

### Files to Modify

**1. `src/hooks/useBusinessAuth.tsx`**

Update the `hasEditAccess` function:
```typescript
const hasEditAccess = (section: string): boolean | undefined => {
  if (loading) return undefined;
  
  // OWNER and ADMIN always have edit access to ALL sections
  const role = businessUser?.access_type;
  if (role === 'OWNER' || role === 'ADMIN') {
    return true;
  }
  
  // For other users, check explicit section permissions
  return sectionPermissions[section] === 'edit';
};
```

Also update the `hasAccess` function for consistency:
```typescript
const hasAccess = (section: string): boolean | undefined => {
  if (loading) return undefined;
  
  // OWNER and ADMIN always have access to ALL sections
  const role = businessUser?.access_type;
  if (role === 'OWNER' || role === 'ADMIN') {
    return true;
  }
  
  // For other users, check explicit section permissions
  return sectionPermissions[section] === 'read' || sectionPermissions[section] === 'edit';
};
```

### Expected Result
After this fix:
- OWNER and ADMIN users will see all action buttons in the Purchase module
- "Add Supplier", "Create Purchase Order", "Create GRN", "Create Debit Note", and "Add Credit Note" buttons will be visible
- The same fix will apply to all other modules (Sales, Inventory, Returns, etc.) where `hasEditAccess` is used

### Additional Check
- Verify that the "Supplier Credit Notes" tab is visible (might need responsive CSS adjustment if it's being cut off on certain screen sizes)

