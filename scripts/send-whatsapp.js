/**
 * Daily WhatsApp automation for Kudos Challenge
 * Uses Meta WhatsApp Cloud API (free tier — 1000 conversations/month)
 *
 * Usage:
 *   node scripts/send-whatsapp.js reminder   ← morning check-in nudge
 *   node scripts/send-whatsapp.js recap       ← evening leaderboard update
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   META_WA_TOKEN          ← from Meta App Dashboard (access token)
 *   META_WA_PHONE_ID       ← Phone Number ID from Meta App Dashboard
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Firebase Admin ──────────────────────────────────────────────────────────
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

// ── Meta WhatsApp Cloud API ──────────────────────────────────────────────────
const META_TOKEN = process.env.META_WA_TOKEN;
const PHONE_ID   = process.env.META_WA_PHONE_ID;
const META_URL   = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`;

async function sendMessage(phone, body) {
  if (!phone) return;

  // Normalize: 10-digit Indian → +91XXXXXXXXXX
  let to = phone.trim().replace(/\D/g, "");
  if (to.length === 10) to = "91" + to;
  if (!to.startsWith("+")) to = "+" + to;
  to = to.replace("+", ""); // Meta wants digits only, no +

  try {
    const res = await fetch(META_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    const json = await res.json();
    if (res.ok) {
      console.log(`✅ Sent to +${to}`);
    } else {
      console.warn(`⚠️  Failed for +${to}:`, json.error?.message);
    }
  } catch (e) {
    console.warn(`⚠️  Error for +${to}:`, e.message);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  // Use IST (UTC+5:30)
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

function getDayScore(data) {
  if (!data) return 0;
  let s = 0;
  if (data.wakeup) s++;
  if (data.water >= 2) s++;
  if (data.workout) s++;
  if (data.steps) s++;
  return s;
}

async function getAllUsers() {
  const snap = await db.collection("users").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getTodayCheckin(userId, date) {
  const snap = await db.doc(`users/${userId}/checkins/${date}`).get();
  return snap.exists ? snap.data() : null;
}

async function getLeaderboard() {
  const users = await getAllUsers();
  const rows = [];
  for (const user of users) {
    const snap = await db.collection(`users/${user.id}/checkins`).get();
    let perfectDays = 0;
    snap.docs.forEach((c) => { if (getDayScore(c.data()) === 4) perfectDays++; });
    rows.push({ name: user.name, perfectDays, activeDays: snap.size });
  }
  return rows
    .filter((r) => r.activeDays > 0)
    .sort((a, b) => b.perfectDays - a.perfectDays || b.activeDays - a.activeDays);
}

// ── Message types ─────────────────────────────────────────────────────────────

async function sendReminders() {
  const date = todayStr();
  const users = await getAllUsers();

  for (const user of users) {
    if (!user.phone) continue;
    const checkin = await getTodayCheckin(user.id, date);
    const score = getDayScore(checkin);
    if (score >= 4) continue; // already perfect, skip

    const done = [], pending = [];
    if (checkin) {
      checkin.wakeup        ? done.push("☀️ Wake up")  : pending.push("☀️ Wake up");
      checkin.water >= 2    ? done.push("💧 Water")    : pending.push("💧 Water");
      checkin.workout       ? done.push("💪 Workout")  : pending.push("💪 Workout");
      checkin.steps         ? done.push("🏃 Steps")    : pending.push("🏃 Steps");
    } else {
      pending.push("☀️ Wake up", "💧 Water", "💪 Workout", "🏃 Steps");
    }

    const msg = score === 0
      ? `Hey ${user.name}! 👋\n\nDon't forget to log your habits for today in the Kudos Challenge!\n\n📱 https://medhaahuja.github.io/kudos-challenge/\n\nYou've got this! 🔥`
      : `Hey ${user.name}! Almost there 💪\n\n✅ Done: ${done.join(", ")}\n⏳ Left: ${pending.join(", ")}\n\nLog the rest before the day ends!\n📱 https://medhaahuja.github.io/kudos-challenge/`;

    await sendMessage(user.phone, msg);
  }
}

async function sendRecap() {
  const date = todayStr();
  const users = await getAllUsers();
  const leaderboard = await getLeaderboard();

  let totalCheckedIn = 0;
  const perfectToday = [];

  for (const user of users) {
    const checkin = await getTodayCheckin(user.id, date);
    if (checkin) {
      totalCheckedIn++;
      if (getDayScore(checkin) === 4) perfectToday.push(user.name);
    }
  }

  const top3 = leaderboard.slice(0, 3);
  const topNames = top3.map((e, i) =>
    `${["🥇","🥈","🥉"][i]} ${e.name} — ${e.perfectDays} perfect days`
  ).join("\n");

  const recap =
    `🔥 *Kudos Challenge — Daily Recap*\n\n` +
    `📅 ${date}\n` +
    `👥 Checked in today: ${totalCheckedIn}/${users.length}\n` +
    `⭐ Perfect today: ${perfectToday.length > 0 ? perfectToday.join(", ") : "None yet"}\n\n` +
    `🏆 *Leaderboard*\n${topNames || "No entries yet"}\n\n` +
    `Keep pushing — see you tomorrow! 💪`;

  for (const user of users) {
    if (user.phone) await sendMessage(user.phone, recap);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const mode = process.argv[2];
if (mode === "reminder") {
  sendReminders().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else if (mode === "recap") {
  sendRecap().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else {
  console.error("Usage: node scripts/send-whatsapp.js [reminder|recap]");
  process.exit(1);
}
