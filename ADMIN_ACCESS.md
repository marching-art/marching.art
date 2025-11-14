# Admin Access Instructions

## Direct Links

If the admin link doesn't appear in navigation, you can access these URLs directly:

- **Admin Panel**: `http://localhost:3000/admin` (or `https://marching.art/admin`)
- **Debug Page**: `http://localhost:3000/debug-user` (or `https://marching.art/debug-user`)

## Debugging Steps

1. Open browser console (F12)
2. Go to the site
3. Look for these console messages:
   ```
   [Navigation] User loaded: YOUR_UID
   [Admin Check] Current UID: YOUR_UID
   [Admin Check] Expected UID: o8vfRCOevjTKBY0k2dISlpiYiIH2
   [Admin Check] UID Match: true/false
   [Admin Check] ✓ Admin by UID match
   [Navigation] Admin check result: true/false
   ```

4. If "UID Match" is `false`:
   - Your UID doesn't match the configured admin UID
   - Visit `/debug-user` to see your actual UID
   - We'll need to update the code with your correct UID

5. If "UID Match" is `true` but you still can't see admin functions:
   - There may be a React rendering issue
   - Try refreshing the page
   - Try clearing browser cache
   - Access `/admin` directly via URL

## Expected Admin UID

The system is configured for admin UID: `o8vfRCOevjTKBY0k2dISlpiYiIH2`

If your UID is different, we need to update:
- `src/firebase.js` (line 221)
- `firestore.rules` (line 8)

## Manual Admin Access

Even if the nav link doesn't show, you can always type `/admin` directly in the URL bar to access the admin panel.

## Console Commands for Testing

Open browser console and try:
```javascript
// Check current user
firebase.auth().currentUser.uid

// Force check admin status
adminHelpers.isAdmin().then(result => console.log('Admin:', result))
```

---

Last Updated: 2025-11-14
