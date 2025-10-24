# Object Storage Permissions Setup Guide

## 🎯 Current Status
❌ Object storage permissions NOT configured yet

## 📋 What You Need to Do in Google Cloud Console

### Method 1: Project-Level IAM (Recommended - Simpler)

1. **Go to Google Cloud Console**:
   - Navigate to: https://console.cloud.google.com/iam-admin/iam
   - Make sure you're in the correct project

2. **Grant Access**:
   - Click "**+ GRANT ACCESS**" button at the top
   
3. **Add Service Account**:
   - In "New principals" field, enter:
     ```
     heimdall-production@replit-user-deployments.iam.gserviceaccount.com
     ```

4. **Select Role**:
   - Click "Select a role" dropdown
   - Search for: `Storage Object Viewer`
   - Select: **Storage Object Viewer** (`roles/storage.objectViewer`)

5. **Save**:
   - Click "**SAVE**"

---

### Method 2: Bucket-Level Permissions (More Restrictive)

1. **Go to Storage Browser**:
   - Navigate to: https://console.cloud.google.com/storage/browser
   
2. **Find Your Bucket**:
   - Look for bucket: `replit-objstore-7b306d6a-5cfa-4282-bce0-65a5f8cd4c06`
   - Click on the bucket name

3. **Grant Access**:
   - Click the "**PERMISSIONS**" tab
   - Click "**GRANT ACCESS**" button

4. **Add Service Account**:
   - In "New principals" field, enter:
     ```
     heimdall-production@replit-user-deployments.iam.gserviceaccount.com
     ```

5. **Select Role**:
   - Click "Select a role" dropdown
   - Search for: `Storage Object Viewer`
   - Select: **Storage Object Viewer** (`roles/storage.objectViewer`)

6. **Save**:
   - Click "**SAVE**"

---

## 🔑 Key Information

**Service Account to Grant Permissions To**:
```
heimdall-production@replit-user-deployments.iam.gserviceaccount.com
```

**Role to Assign**:
```
Storage Object Viewer (roles/storage.objectViewer)
```

**Bucket Name**:
```
replit-objstore-7b306d6a-5cfa-4282-bce0-65a5f8cd4c06
```

---

## ✅ After Granting Permissions

Once you've granted the permissions in Google Cloud Console:
1. Come back to this Replit
2. Let me know it's done
3. I'll verify the permissions are working

---

## 📦 What This Object Storage is Used For

- **KYC Documents**: Aadhaar, PAN cards, address proofs
- **Profile Pictures**: User avatars
- **Product Images**: Marketplace product photos
- **Insurance Documents**: Policy documents
- **General Uploads**: Any user-uploaded files

**Public Directory**: `/replit-objstore-7b306d6a-5cfa-4282-bce0-65a5f8cd4c06/public`
**Private Directory**: `/replit-objstore-7b306d6a-5cfa-4282-bce0-65a5f8cd4c06/.private`

---

## ⏱️ Permission Propagation

After granting permissions, it may take **1-2 minutes** for the changes to propagate through Google Cloud's systems. If the test fails immediately after granting, wait a minute and try again.
