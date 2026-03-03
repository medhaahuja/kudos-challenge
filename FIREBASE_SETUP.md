# Kudos 21-Day Challenge — Firebase Setup

## 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → name: `kudos-challenge`
3. Disable Google Analytics (not needed) → **Create Project**

## 2. Create Firestore Database

1. In left sidebar, click **Build → Firestore Database**
2. Click **Create Database**
3. Select **Start in test mode** (we'll secure it later)
4. Location: **asia-south1 (Mumbai)** → **Enable**

## 3. Register Your Web App

1. Go to **Project Settings** (gear icon, top left)
2. Scroll down → click **Add app** → choose **Web** icon (`</>`)
3. Name: `kudos-web` → **Register app**
4. You'll see a config object like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "kudos-challenge-xxxxx.firebaseapp.com",
  projectId: "kudos-challenge-xxxxx",
  storageBucket: "kudos-challenge-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

## 4. Set Up Your .env File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in the values from Step 3:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=kudos-challenge-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kudos-challenge-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=kudos-challenge-xxxxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

## 5. Install & Run

```bash
npm install
npm run dev
```

## Firestore Data Structure

```
users/
  {userId}/
    name: "Medha"
    phone: null
    email: null
    createdAt: timestamp
    isAdmin: false
    checkins/
      2026-02-24/
        wakeup: true
        water: 3
        workout: true
        steps: false
        updatedAt: timestamp
      2026-02-25/
        ...
```

## View Your Data

- Go to Firebase Console → **Firestore Database**
- You'll see all users and their check-ins in real-time
- Click any user → expand `checkins` to see their daily data

## Security Rules (Before Launch)

Once you're ready to go live, update Firestore rules:
Go to **Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Anyone can read users (for leaderboard)
    match /users/{userId} {
      allow read: if true;
      allow create: if true;
      
      // Anyone can read/write checkins (for now)
      match /checkins/{date} {
        allow read, write: if true;
      }
    }
  }
}
```

## Deploy to Vercel

1. Push to GitHub
2. Go to vercel.com → New Project → Import repo
3. Add Environment Variables (same as your .env values)
4. Deploy!

## WhatsApp Bot (Later)

Use a Firebase Cloud Function + scheduled trigger:
1. Query all users' checkins for today
2. Format the recap message
3. Send via WhatsApp Business API / Twilio
4. Schedule to run daily at 10 PM IST
