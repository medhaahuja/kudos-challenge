import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, getDocs,
  collection, serverTimestamp
} from "firebase/firestore";

function safeRandomId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // ignore
  }

  // RFC4122-ish fallback (not cryptographically strong, but works everywhere)
  const now = Date.now().toString(16);
  const rnd = Math.random().toString(16).slice(2);
  return `local-${now}-${rnd}`;
}

const memoryStore = new Map();
function safeStorageGet(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}
function safeStorageSet(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

// ——————————————————————————————————————————
// 🔥 Paste your Firebase config here
// Get it from: Firebase Console → Project Settings → Your App → Config
// ——————————————————————————————————————————
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const hasFirebase = firebaseConfig.apiKey && firebaseConfig.projectId;

let db = null;
if (hasFirebase) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("✅ Firebase connected");
  } catch (e) {
    console.warn("⚠️ Firebase init failed:", e);
  }
}

if (!hasFirebase) {
  console.warn(
    "⚠️ Firebase credentials missing. Create a .env file with your Firebase config.\n" +
    "Falling back to localStorage."
  );
}

// ——————————————————————————————————————————
// Database helper functions
// ——————————————————————————————————————————

// Sign up / get user
export async function getOrCreateUser(name, phone = null, email = null) {
  if (!db) return localFallback.getOrCreateUser(name);

  try {
    // Check if user exists by phone
    if (phone) {
      const usersSnap = await getDocs(collection(db, "users"));
      const existing = usersSnap.docs.find(d => d.data().phone === phone);
      if (existing) return { id: existing.id, ...existing.data() };
    }

    // Create new user
    const userId = safeRandomId();
    const _d = new Date();
    const startDate = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    const userData = {
      name,
      startDate,
      phone: phone || null,
      email: email || null,
      createdAt: serverTimestamp(),
      isAdmin: false,
    };
    await setDoc(doc(db, "users", userId), userData);
    return { id: userId, ...userData };
  } catch (e) {
    console.error("Error creating user:", e);
    return localFallback.getOrCreateUser(name);
  }
}

// Get user by ID
export async function getUser(userId) {
  if (!db) return localFallback.getUser(userId);

  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    console.error("Error getting user:", e);
    return localFallback.getUser(userId);
  }
}

// Get all check-ins for a user (for calendar view)
export async function getAllCheckins(userId) {
  if (!db) return localFallback.getAllCheckins(userId);

  try {
    const snap = await getDocs(collection(db, "users", userId, "checkins"));
    const checkins = {};
    snap.docs.forEach((d) => {
      checkins[d.id] = d.data(); // doc ID = date string "2026-02-24"
    });
    return checkins;
  } catch (e) {
    console.error("Error getting checkins:", e);
    return localFallback.getAllCheckins(userId);
  }
}

// Upsert (create or update) a check-in
export async function upsertCheckin(userId, date, updates) {
  if (!db) return localFallback.upsertCheckin(userId, date, updates);

  try {
    await setDoc(doc(db, "users", userId, "checkins", date), {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { date, ...updates };
  } catch (e) {
    console.error("Error upserting checkin:", e);
    return localFallback.upsertCheckin(userId, date, updates);
  }
}

// Get leaderboard (reads all users and their checkins)
export async function getLeaderboard() {
  if (!db) return [];

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const leaderboard = [];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const checkinsSnap = await getDocs(
        collection(db, "users", userDoc.id, "checkins")
      );

      let perfectDays = 0;
      let activeDays = checkinsSnap.size;
      const dates = [];

      checkinsSnap.docs.forEach((c) => {
        const d = c.data();
        if (d.wakeup && d.water >= 2 && d.workout && d.steps) {
          perfectDays++;
          dates.push(c.id); // date string
        }
      });

      // Calculate streak
      dates.sort().reverse();
      let currentStreak = 0;
      const today = new Date();
      for (let i = 0; i < dates.length; i++) {
        const expected = new Date(today);
        expected.setDate(today.getDate() - i);
        const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth()+1).padStart(2,'0')}-${String(expected.getDate()).padStart(2,'0')}`;
        if (dates[i] === expectedStr) {
          currentStreak++;
        } else {
          break;
        }
      }

      if (activeDays > 0) {
        leaderboard.push({
          user_id: userDoc.id,
          name: userData.name,
          perfect_days: perfectDays,
          active_days: activeDays,
          current_streak: currentStreak,
        });
      }
    }

    leaderboard.sort((a, b) => b.perfect_days - a.perfect_days || b.current_streak - a.current_streak);
    return leaderboard;
  } catch (e) {
    console.error("Error getting leaderboard:", e);
    return [];
  }
}

// Get admin summary
export async function getAdminSummary() {
  if (!db) return [];

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const summary = [];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const checkinsSnap = await getDocs(
        collection(db, "users", userDoc.id, "checkins")
      );

      let wakeupDays = 0, waterDays = 0, workoutDays = 0, stepsDays = 0, perfectDays = 0;
      let lastActive = null;

      checkinsSnap.docs.forEach((c) => {
        const d = c.data();
        if (d.wakeup) wakeupDays++;
        if (d.water >= 2) waterDays++;
        if (d.workout) workoutDays++;
        if (d.steps) stepsDays++;
        if (d.wakeup && d.water >= 2 && d.workout && d.steps) perfectDays++;
        if (!lastActive || c.id > lastActive) lastActive = c.id;
      });

      summary.push({
        user_id: userDoc.id,
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        joinedAt: userData.createdAt,
        totalCheckins: checkinsSnap.size,
        wakeupDays, waterDays, workoutDays, stepsDays, perfectDays,
        lastActive,
      });
    }

    return summary;
  } catch (e) {
    console.error("Error getting admin summary:", e);
    return [];
  }
}

// Get daily recap (for WhatsApp bot)
export async function getDailyRecap(date = null) {
  if (!db) return null;

  try {
    const _d = new Date();
    const targetDate = date || `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    const usersSnap = await getDocs(collection(db, "users"));
    let totalActive = 0, perfectCount = 0;
    const perfectUsers = [];
    const totalUsers = usersSnap.size;

    for (const userDoc of usersSnap.docs) {
      const checkinSnap = await getDoc(
        doc(db, "users", userDoc.id, "checkins", targetDate)
      );
      if (checkinSnap.exists()) {
        totalActive++;
        const d = checkinSnap.data();
        if (d.wakeup && d.water >= 2 && d.workout && d.steps) {
          perfectCount++;
          perfectUsers.push(userDoc.data().name);
        }
      }
    }

    return { date: targetDate, totalActive, perfectCount, perfectUsers, totalUsers };
  } catch (e) {
    console.error("Error getting daily recap:", e);
    return null;
  }
}


// ——————————————————————————————————————————
// localStorage fallback (works without Firebase)
// ——————————————————————————————————————————

const localFallback = {
  getOrCreateUser(name) {
    let userId = safeStorageGet("kudos-user-id");
    const isNew = !userId;
    if (isNew) {
      userId = safeRandomId();
      safeStorageSet("kudos-user-id", userId);
    }
    const _d = new Date();
    const todayStr = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
    const startDate = isNew ? todayStr : (safeStorageGet("kudos-start-date") || todayStr);
    safeStorageSet("kudos-user-name", name);
    safeStorageSet("kudos-start-date", startDate);
    return { id: userId, name, startDate, createdAt: new Date().toISOString() };
  },

  getUser(userId) {
    const name = safeStorageGet("kudos-user-name");
    if (!name) return null;
    const startDate = safeStorageGet("kudos-start-date");
    return { id: userId, name, startDate };
  },

  getAllCheckins(userId) {
    try {
      return JSON.parse(safeStorageGet("kudos-challenge-data") || "{}");
    } catch { return {}; }
  },

  upsertCheckin(userId, date, updates) {
    const all = this.getAllCheckins();
    all[date] = { ...all[date], ...updates };
    safeStorageSet("kudos-challenge-data", JSON.stringify(all));
    return { date, ...all[date] };
  },
};
