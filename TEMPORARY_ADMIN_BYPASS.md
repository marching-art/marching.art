# Temporary Admin Bypass Instructions

If you need immediate access to the admin panel while we debug the auth issue, follow these steps:

## Option 1: Environment Variable (Recommended)

Add this to your `.env.local` file:
```
REACT_APP_ADMIN_BYPASS=true
```

Then the admin panel will be accessible to any logged-in user.

## Option 2: Quick Code Edit

Edit `src/pages/Admin.jsx` line 32-36:

**Change from:**
```javascript
// First check: Direct UID comparison (synchronous)
if (user.uid === ADMIN_UID) {
  console.log('[Admin Page] ✓ UID MATCH - Granting immediate admin access');
  setIsAdmin(true);
  setLoading(false);
  return;
}
```

**Change to:**
```javascript
// TEMPORARY BYPASS - REMOVE AFTER DEBUGGING
console.log('[Admin Page] ⚠️ BYPASS ACTIVE - Granting admin to all users');
setIsAdmin(true);
setLoading(false);
return;

// First check: Direct UID comparison (synchronous)
// if (user.uid === ADMIN_UID) {
//   console.log('[Admin Page] ✓ UID MATCH - Granting immediate admin access');
//   setIsAdmin(true);
//   setLoading(false);
//   return;
// }
```

Save and refresh. You'll have immediate admin access.

**IMPORTANT: Remove this bypass once we fix the auth issue!**

---

Last Updated: 2025-11-14
