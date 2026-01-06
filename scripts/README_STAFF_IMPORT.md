# Staff Database Import Guide

This guide explains how to import DCI Hall of Fame members into the Firestore `staff_database` collection.

## Prerequisites

1. **Service Account Key**: You need a Firebase service account key file
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the file as `scripts/serviceAccountKey.json`
   - **IMPORTANT**: Never commit this file to Git (it's in .gitignore)

2. **Node.js**: Ensure you have Node.js 20+ installed

3. **Dependencies**: Install Firebase Admin SDK
   ```bash
   cd scripts
   npm install firebase-admin
   ```

## Data Structure

Each staff member in the database has the following fields:

```javascript
{
  name: string,              // e.g., "George Zingali"
  caption: string,           // One of: GE1, GE2, VP, VA, CG, B, MA, P
  yearInducted: number,      // Year inducted into DCI Hall of Fame (1985-2025)
  biography: string,         // Brief description of their role
  baseValue: number,         // Purchase cost in CorpsCoin (100-1000)
  available: boolean,        // Whether available in marketplace
  createdAt: timestamp       // Auto-generated
}
```

## Caption Categories

- **GE1**: General Effect 1 (Directors, Program Coordinators)
- **GE2**: General Effect 2 (Judges, Administrators, Broadcasters)
- **VP**: Visual Performance (Drill Designers, Marching Instructors)
- **VA**: Visual Analysis (Visual Judges, Analysts)
- **CG**: Color Guard (Color Guard Designers, Choreographers)
- **B**: Brass (Brass Arrangers, Instructors)
- **MA**: Music Analysis (Front Ensemble Arrangers)
- **P**: Percussion (Percussion Arrangers, Battery Instructors)

## Value Calculation

Base values are calculated using the formula:
```javascript
baseValue = 100 + ((yearInducted - 1985) / (2025 - 1985)) * 900
```

This creates a range:
- **1985 inductees**: 100 CorpsCoin (lowest)
- **2025 inductees**: 1000 CorpsCoin (highest)

Older legends cost less, newer inductees cost more.

## Running the Import

1. **Place the service account key**:
   ```bash
   # Make sure serviceAccountKey.json is in the scripts directory
   ls scripts/serviceAccountKey.json
   ```

2. **Run the import script**:
   ```bash
   cd scripts
   node importStaff.js
   ```

3. **Expected output**:
   ```
   Starting staff import...
   Total members to import: 148
   Committing batch of 148 staff members...

   ✅ Successfully imported 148 DCI Hall of Fame members!

   📊 Caption Distribution:
     GE1: 35 members
     B: 28 members
     P: 18 members
     VP: 17 members
     GE2: 16 members
     CG: 9 members
     MA: 3 members
     VA: 2 members

   💰 Value Range:
     1985: 100 CorpsCoin
     2025: 1000 CorpsCoin

   ✨ Import complete!
   ```

## Data Source

The staff data was sourced from the official DCI Hall of Fame member list:
- **Total Members**: 148 (as of 2025)
- **Years**: 1985-2025
- **Source**: DCI Hall of Fame official records

## Updating the Database

To add new staff members or update existing ones:

1. **Option A: Use the Admin Panel UI**
   - Navigate to `/admin` in the app
   - Go to "Staff Database" tab
   - Click "Add Staff Member"
   - Fill out the form and submit

2. **Option B: Modify the import script**
   - Edit `scripts/importStaff.js`
   - Add new entries to the `hallOfFameMembers` array
   - Re-run the script (existing members won't be duplicated)

3. **Option C: Direct Firestore operations**
   ```javascript
   const staffRef = db.collection('staff_database').doc('staff-id');
   await staffRef.set({
     name: 'Staff Name',
     caption: 'B',
     yearInducted: 2025,
     biography: 'Description...',
     baseValue: 950,
     available: true,
     createdAt: admin.firestore.FieldValue.serverTimestamp()
   });
   ```

## Firestore Security Rules

Ensure your `firestore.rules` includes:

```
match /staff_database/{staffId} {
  allow read: if true;  // Anyone can view staff
  allow write: if isAdmin();  // Only admins can modify
}
```

## Verification

After import, verify the data:

1. **Check Firestore Console**:
   - Firebase Console → Firestore Database
   - Navigate to `staff_database` collection
   - Verify 148 documents exist

2. **Check in the app**:
   - Log in as admin
   - Visit `/admin`
   - Click "Staff Database" tab
   - Verify all staff members are visible

3. **Test the marketplace**:
   - Use the `getStaffMarketplace` callable function
   - Verify staff can be purchased and assigned

## Troubleshooting

### "Permission denied" error
- Check that your service account key is valid
- Verify Firestore security rules allow admin writes

### "Module not found" error
- Run `npm install firebase-admin` in the scripts directory
- Ensure you're running Node.js 20+

### Import fails midway
- The script uses batch operations with checkpoints
- Safe to re-run - won't create duplicates (uses doc IDs based on names)

### Caption distribution seems off
- This is expected - DCI has inducted more brass and GE staff
- Distribution reflects the actual Hall of Fame composition

## Next Steps

After importing staff:

1. **Set up staff marketplace**:
   - Staff can now be purchased using `purchaseStaff` callable function
   - Costs based on `baseValue` field

2. **Implement staff bonuses**:
   - Staff provide scoring bonuses when assigned to corps
   - Value increases after each completed season

3. **Create staff resale market**:
   - Users can sell staff to each other
   - Prices fluctuate based on supply/demand

## Support

For issues or questions:
- Check Firebase Console logs
- Review `scripts/importStaff.js` for the data structure
- Contact the development team

---

**Last Updated**: November 2025
**Total Hall of Fame Members**: 148
**Script Version**: 1.0
