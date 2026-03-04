import { useState, useEffect, useRef } from "react";
import {
  getOrCreateUser, getUser,
  getAllCheckins, upsertCheckin, getLeaderboard
} from "./firebaseClient.js";

const CHALLENGE_DAYS = 21;
const CHALLENGE_START = "2026-03-05"; // global start date for everyone
const WATER_BOTTLES = 3;
const WATER_DONE_THRESHOLD = 2;

const HABITS = [
  { id: "wakeup", label: "Wake Up Early", icon: "☀️", description: "Before 6:30 AM", type: "toggle" },
  { id: "water", label: "Water Intake", icon: "💧", description: `${WATER_BOTTLES}L target · Tap bottles to fill`, type: "water" },
  { id: "workout", label: "Workout Done", icon: "💪", description: "Any exercise counts", type: "toggle" },
  { id: "steps", label: "10K Steps", icon: "🏃", description: "10,000+ steps", type: "toggle" },
];

const MOTIVATIONAL_QUOTES = [
  "Day 1 is the hardest. You just did it. 🔥",
  "Small daily improvements lead to stunning results.",
  "You don't have to be extreme, just consistent.",
  "The secret? Show up. Again. And again.",
  "Every check-in is proof you're serious about this.",
  "Discipline is choosing between what you want now and what you want most.",
  "Your only competition is who you were yesterday.",
  "Winners aren't people who never fail—they're people who never quit.",
  "Progress, not perfection.",
  "The body achieves what the mind believes.",
  "3 weeks to build a habit. You're doing it. 💪",
  "Consistency beats intensity every single time.",
  "You're not just building habits—you're building a new identity.",
  "Future you will thank present you.",
  "Showing up is 90% of the battle. You showed up.",
  "Trust the process. The results are coming.",
  "A river cuts through rock not by power, but persistence.",
  "You're closer than you think.",
  "Champions are made in the hours nobody watches.",
  "Proof > promises. Keep checking in.",
  "21 days. That's all it takes to change everything.",
];


function ConfettiEffect({ active }) {
  if (!active) return null;
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1.5,
    color: ["#FFD700", "#FF6B35", "#00C9A7", "#845EC2", "#FF6F91", "#FFC75F"][i % 6],
    size: 6 + Math.random() * 8, rotation: Math.random() * 360,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.left}%`, top: "-10px",
          width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: p.id % 3 === 0 ? "50%" : "2px",
          transform: `rotate(${p.rotation}deg)`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

function CircularProgress({ percentage, size = 120, strokeWidth = 10, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const getColor = () => {
    if (percentage >= 100) return "#00C9A7";
    if (percentage >= 50) return "#FFC75F";
    return "#FF6B35";
  };
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={getColor()} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function WaterBottleTracker({ bottlesFilled, onChange }) {
  const handleBottleClick = (index) => {
    onChange(bottlesFilled === index + 1 ? index : index + 1);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "center" }}>
        {Array.from({ length: WATER_BOTTLES }, (_, i) => {
          const filled = i < bottlesFilled;
          return (
            <button key={i} onClick={() => handleBottleClick(i)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transform: filled ? "scale(1.05)" : "scale(1)", transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
              <div style={{ position: "relative", width: 60, height: 96 }}>
                <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 22, height: 14, borderRadius: "6px 6px 2px 2px", background: filled ? "rgba(100,180,255,0.6)" : "rgba(255,255,255,0.1)", border: `2px solid ${filled ? "rgba(100,180,255,0.5)" : "rgba(255,255,255,0.1)"}`, transition: "all 0.4s ease", zIndex: 2 }} />
                <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 18, height: 10, background: filled ? "rgba(100,180,255,0.15)" : "rgba(255,255,255,0.03)", borderLeft: `2px solid ${filled ? "rgba(100,180,255,0.4)" : "rgba(255,255,255,0.1)"}`, borderRight: `2px solid ${filled ? "rgba(100,180,255,0.4)" : "rgba(255,255,255,0.1)"}`, transition: "all 0.4s ease" }} />
                <div style={{ position: "absolute", top: 20, left: 0, right: 0, bottom: 0, borderRadius: "6px 6px 14px 14px", border: `2px solid ${filled ? "rgba(100,180,255,0.5)" : "rgba(255,255,255,0.1)"}`, overflow: "hidden", background: "rgba(255,255,255,0.02)", transition: "border-color 0.4s ease" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: filled ? "100%" : "0%", background: filled ? "linear-gradient(180deg, #7EC8E3 0%, #4DA8DA 40%, #3A8FE0 70%, #2B6CB0 100%)" : "transparent", transition: "height 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)", borderRadius: "0 0 12px 12px" }}>
                    {filled && (<><div style={{ position: "absolute", top: -5, left: -5, right: -5, height: 14, background: "radial-gradient(ellipse at 35% 50%, rgba(255,255,255,0.3) 0%, transparent 65%)", borderRadius: "50%", animation: "pulse 3s ease-in-out infinite" }} /><div style={{ position: "absolute", bottom: "25%", left: "20%", width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} /><div style={{ position: "absolute", bottom: "55%", right: "25%", width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} /></>)}
                  </div>
                  <div style={{ position: "absolute", top: "50%", right: 4, fontSize: 9, fontWeight: 700, color: filled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.15)", textShadow: filled ? "0 1px 2px rgba(0,0,0,0.3)" : "none" }}>1L</div>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: filled ? "#64B4FF" : "rgba(255,255,255,0.25)" }}>{filled ? "✓ Done" : `Bottle ${i + 1}`}</span>
            </button>
          );
        })}
      </div>
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: bottlesFilled >= WATER_DONE_THRESHOLD ? "#00C9A7" : "rgba(255,255,255,0.4)", padding: "6px 12px", borderRadius: 10, background: bottlesFilled >= WATER_BOTTLES ? "rgba(0,201,167,0.08)" : "transparent" }}>
        {bottlesFilled === 0 && "Tap a bottle when you finish it 👆"}
        {bottlesFilled === 1 && "1L down — one more to hit the target! 💧"}
        {bottlesFilled === 2 && "2L done — target hit! Go for all 3 💪"}
        {bottlesFilled >= 3 && "3L — Fully hydrated champion! 💦🏆"}
      </div>
    </div>
  );
}

function CalendarView({ checkins, startDate, currentDay }) {
  const weeks = []; let week = [];
  const [_sy, _sm, _sd] = startDate.split("-").map(Number);
  const start = new Date(_sy, _sm - 1, _sd);
  for (let i = 0; i < start.getDay(); i++) week.push(null);
  for (let d = 0; d < CHALLENGE_DAYS; d++) {
    const date = new Date(start); date.setDate(start.getDate() + d);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; const c = checkins[key];
    let score = 0;
    if (c) { if (c.wakeup) score++; if (c.water >= WATER_DONE_THRESHOLD) score++; if (c.workout) score++; if (c.steps) score++; }
    week.push({ day: d + 1, score, isToday: d + 1 === currentDay, isFuture: d + 1 > currentDay });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  const getColor = (score, isFuture) => { if (isFuture) return "rgba(255,255,255,0.03)"; if (score === 4) return "#00C9A7"; if (score === 3) return "#7BE0C0"; if (score === 2) return "#FFC75F"; if (score === 1) return "#FF9A5C"; return "rgba(255,255,255,0.06)"; };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (<div key={i} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{d}</div>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {weeks.flat().map((cell, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 10, background: cell ? getColor(cell.score, cell.isFuture) : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: cell?.isFuture ? "rgba(255,255,255,0.15)" : cell?.score > 0 ? "#fff" : "rgba(255,255,255,0.4)", border: cell?.isToday ? "2px solid #FFD700" : "2px solid transparent" }}>
            {cell && (<><span>{cell.day}</span>{!cell.isFuture && cell.score > 0 && <span style={{ fontSize: 8, marginTop: 1 }}>{"●".repeat(cell.score)}</span>}</>)}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {[{ color: "#00C9A7", label: "All 4" }, { color: "#FFC75F", label: "2-3" }, { color: "#FF9A5C", label: "1" }, { color: "rgba(255,255,255,0.06)", label: "None" }].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.5)" }}><div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />{l.label}</div>
        ))}
      </div>
    </div>
  );
}

function LeaderboardPanel({ leaderboard, currentUserId }) {
  if (!leaderboard.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {leaderboard.slice(0, 10).map((entry, i) => {
        const isMe = entry.user_id === currentUserId;
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        return (
          <div key={entry.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: isMe ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.02)", border: isMe ? "1px solid rgba(255,215,0,0.2)" : "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 16, width: 28, textAlign: "center" }}>{medal}</span>
            <div style={{ flex: 1 }}><span style={{ fontSize: 14, fontWeight: 700, color: isMe ? "#FFD700" : "#fff" }}>{entry.name} {isMe ? "(You)" : ""}</span></div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>{entry.active_days}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Days</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#00C9A7" }}>{entry.perfect_days}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Perfect</div></div>
              {entry.current_streak > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#FFD700" }}>🔥{entry.current_streak}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>Streak</div></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChallengeTracker() {
  const [screen, setScreen] = useState("loading");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);
  const [checkins, setCheckins] = useState({});
  const [leaderboard, setLeaderboardData] = useState([]);
  const [activeTab, setActiveTab] = useState("today");
  const [showConfetti, setShowConfetti] = useState(false);
  const [animatingHabit, setAnimatingHabit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [authError, setAuthError] = useState("");
  const prevPerfectRef = useRef(false);

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;
  const effectiveStartDate = CHALLENGE_START;
  const [sy, sm, sd] = effectiveStartDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const now = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const currentDay = Math.min(Math.max(diffDays + 1, 1), CHALLENGE_DAYS);
  const todayData = checkins[today] || { wakeup: false, water: 0, workout: false, steps: false };

  const getDayScore = (data) => { if (!data) return 0; let s = 0; if (data.wakeup) s++; if (data.water >= WATER_DONE_THRESHOLD) s++; if (data.workout) s++; if (data.steps) s++; return s; };

  useEffect(() => {
    const init = async () => {
      try {
        const savedId = localStorage.getItem("kudos-user-id");
        if (savedId) {
          const user = await getUser(savedId);
          if (user) {
            setUserId(user.id); setUserName(user.name);
            const allCheckins = await getAllCheckins(user.id);
            setCheckins(allCheckins);
            if (allCheckins[today]) setSubmitted(true);
            prevPerfectRef.current = getDayScore(allCheckins[today] || {}) === 4;
            setScreen("dashboard");
            getLeaderboard().then(setLeaderboardData);
            return;
          }
        }
        setScreen("signup");
      } catch { setScreen("signup"); }
    };
    init();
  }, []);

  const handleSignup = async () => {
    const trimmed = userName.trim();
    if (!trimmed) {
      setAuthError("Please enter your name to join.");
      return;
    }
    setSaving(true);
    setAuthError("");
    try {
      const user = await getOrCreateUser(trimmed);
      if (user?.id) {
        setUserId(user.id);
        setStartDate(user.startDate || today);
        try { localStorage.setItem("kudos-user-id", user.id); } catch { /* ignore */ }
        setScreen("dashboard");
        getLeaderboard().then(setLeaderboardData);
      } else {
        setAuthError("Could not create your profile. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setAuthError("Join failed. Check Firebase config or browser storage settings.");
    }
    setSaving(false);
  };

  const updateHabit = async (habitId, value) => {
    setAnimatingHabit(habitId); setTimeout(() => setAnimatingHabit(null), 400);
    const newTodayData = { ...todayData, [habitId]: value };
    setCheckins((prev) => ({ ...prev, [today]: newTodayData }));
    const newScore = getDayScore(newTodayData);
    if (newScore === 4 && !prevPerfectRef.current) {
      setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000);
      setSubmitted(true);
    }
    prevPerfectRef.current = newScore === 4;
    await upsertCheckin(userId, today, { wakeup: newTodayData.wakeup, water: newTodayData.water, workout: newTodayData.workout, steps: newTodayData.steps });
    if (newScore === 4) getLeaderboard().then(setLeaderboardData);
  };

  const todayScore = getDayScore(todayData);
  const todayPercentage = (todayScore / 4) * 100;
  const getStreak = () => { let s = 0; for (let d = currentDay - 1; d >= 0; d--) { const date = new Date(start); date.setDate(start.getDate() + d); const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; if (getDayScore(checkins[key]) === 4) s++; else break; } return s; };
  const getPerfectDays = () => Object.values(checkins).filter((d) => getDayScore(d) === 4).length;
  const streak = getStreak(); const perfectDays = getPerfectDays();
  const overallProgress = (perfectDays / CHALLENGE_DAYS) * 100;
  const quote = MOTIVATIONAL_QUOTES[currentDay - 1] || MOTIVATIONAL_QUOTES[0];

  if (screen === "loading") return (<div style={styles.container}><style>{keyframes}</style><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><div style={{ fontSize: 40, animation: "pulse 1.5s infinite" }}>🔥</div></div></div>);

  if (screen === "signup") return (
    <div style={styles.container}><style>{keyframes}</style>
      <div style={styles.signupCard}>
        <div style={{ fontSize: 48, marginBottom: 8, animation: "pulse 2s infinite" }}>🔥</div>
        <h1 style={styles.signupTitle}>21-Day Challenge</h1>
        <p style={styles.signupSubtitle}>Wake Up · Hydrate · Workout · Walk</p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6, marginBottom: 32, maxWidth: 320 }}>Join the Kudos community challenge. Track 4 daily habits for 21 days. Build consistency. Earn your streak.</p>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <input type="text" placeholder="Your name" value={userName} onChange={(e) => setUserName(e.target.value)} style={styles.input} onKeyDown={(e) => e.key === "Enter" && handleSignup()} />
          <button
            onClick={handleSignup}
            disabled={saving || !userName.trim()}
            style={{ ...styles.ctaButton, opacity: userName.trim() && !saving ? 1 : 0.4 }}
          >
            {saving ? "Joining..." : "Start My Challenge →"}
          </button>
          {authError && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#FF9A5C", lineHeight: 1.4 }}>
              {authError}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 32 }}>
          {HABITS.map((h) => (<div key={h.id} style={{ textAlign: "center" }}><div style={{ fontSize: 24 }}>{h.icon}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{h.label.split(" ")[0]}</div></div>))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container}><style>{keyframes}</style>
      <ConfettiEffect active={showConfetti} />
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={styles.greeting}>Hey {userName} 👋</h1><p style={styles.dayLabel}>Day {currentDay} of {CHALLENGE_DAYS}</p></div>
          {streak > 0 && <div style={styles.streakBadge}><span style={{ fontSize: 18 }}>🔥</span><span style={styles.streakNumber}>{streak}</span></div>}
        </div>
        <div style={styles.progressBarContainer}><div style={styles.progressBarBg}><div style={{ ...styles.progressBarFill, width: `${(currentDay / CHALLENGE_DAYS) * 100}%` }} /></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}><span>Day 1</span><span>{CHALLENGE_DAYS - currentDay} days left</span><span>Day 21</span></div></div>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3 }}>
          {[{ id: "today", label: "Today" }, { id: "leaderboard", label: "🏆 Leaderboard" }].map((tab) => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "leaderboard") getLeaderboard().then(setLeaderboardData); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: activeTab === tab.id ? "rgba(255,255,255,0.1)" : "transparent", color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s ease" }}>{tab.label}</button>
          ))}
        </div>

        {activeTab === "today" && (<>
          {todayScore < 4 ? (<>
            <div style={styles.quoteCard}><span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>"{quote}"</span></div>
            <h3 style={styles.sectionTitle}>Today's Habits</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {HABITS.map((habit) => {
                const isAnimating = animatingHabit === habit.id;
                if (habit.type === "water") {
                  return (<div key={habit.id} style={{ ...styles.habitCard, borderColor: todayData.water >= WATER_DONE_THRESHOLD ? "rgba(0,201,167,0.3)" : "rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}><span style={{ fontSize: 24 }}>{habit.icon}</span><div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{habit.label}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{habit.description}</div></div>{todayData.water >= WATER_DONE_THRESHOLD && <span style={{ fontSize: 20 }}>✅</span>}</div>
                    <WaterBottleTracker bottlesFilled={todayData.water || 0} onChange={(b) => updateHabit("water", b)} />
                  </div>);
                }
                const isChecked = todayData[habit.id];
                return (<button key={habit.id} onClick={() => updateHabit(habit.id, !isChecked)} style={{ ...styles.habitCard, cursor: "pointer", borderColor: isChecked ? "rgba(0,201,167,0.3)" : "rgba(255,255,255,0.06)", transform: isAnimating ? "scale(0.97)" : "scale(1)", transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 24 }}>{habit.icon}</span><div style={{ textAlign: "left" }}><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{habit.label}</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{habit.description}</div></div>
                    <div style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 8, background: isChecked ? "#00C9A7" : "rgba(255,255,255,0.06)", border: isChecked ? "none" : "2px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff" }}>{isChecked ? "✓" : ""}</div>
                  </div>
                </button>);
              })}
            </div>
            {!submitted && (
              <button
                onClick={() => setSubmitted(true)}
                disabled={todayScore === 0}
                style={{ ...styles.ctaButton, marginTop: 16, opacity: todayScore > 0 ? 1 : 0.4 }}
              >
                Submit Check-in ✓
              </button>
            )}
          </>) : (<>
            <div style={styles.scoreSection}>
              <CircularProgress percentage={todayPercentage} size={110} strokeWidth={10}><span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{todayScore}</span><span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>of 4</span></CircularProgress>
              <div style={{ marginLeft: 20, flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Today's Power Score</h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "4px 0 12px", lineHeight: 1.4 }}>🎉 Perfect day! You crushed it!</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ val: streak, color: "#FFD700", label: "Streak" }, { val: perfectDays, color: "#00C9A7", label: "Perfect" }, { val: `${Math.round(overallProgress)}%`, color: "#FF6B35", label: "Done" }].map((s) => (<div key={s.label} style={styles.miniStat}><span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</span><span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{s.label}</span></div>))}
                </div>
              </div>
            </div>
          </>)}
          {(submitted || todayScore >= 4) && (<>
            <h3 style={{ ...styles.sectionTitle, marginTop: 28 }}>21-Day Calendar</h3>
            <div style={styles.calendarCard}><CalendarView checkins={checkins} startDate={effectiveStartDate} currentDay={currentDay} /></div>
          </>)}
        </>)}

        {activeTab === "leaderboard" && (<>
          <h3 style={styles.sectionTitle}>Community Leaderboard</h3>
          {leaderboard.length > 0 ? <LeaderboardPanel leaderboard={leaderboard} currentUserId={userId} /> : <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)", fontSize: 14 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>No entries yet. Be the first!</div>}
        </>)}
      </div>
    </div>
  );
}

const keyframes = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
  @keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
`;

const styles = {
  container: { fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "linear-gradient(160deg, #0D0D1A 0%, #1A1A2E 40%, #16213E 100%)", display: "flex", justifyContent: "center", padding: 0 },
  signupCard: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center", minHeight: "100vh", maxWidth: 420, width: "100%", animation: "fadeIn 0.6s ease" },
  signupTitle: { fontSize: 32, fontWeight: 800, margin: "0 0 6px", background: "linear-gradient(135deg, #FFD700, #FF6B35)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  signupSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.5)", margin: "0 0 16px", letterSpacing: 1 },
  input: { width: "100%", padding: "14px 16px", fontSize: 16, borderRadius: 12, border: "2px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", outline: "none", marginBottom: 12, boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" },
  ctaButton: { width: "100%", padding: "14px", fontSize: 16, fontWeight: 700, borderRadius: 12, border: "none", cursor: "pointer", color: "#0D0D1A", background: "linear-gradient(135deg, #FFD700, #FF6B35)", fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s ease" },
  dashboard: { width: "100%", maxWidth: 420, padding: "20px 16px", animation: "fadeIn 0.5s ease" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  greeting: { fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 },
  dayLabel: { fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "4px 0 0" },
  streakBadge: { display: "flex", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 20, background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,107,53,0.1))", border: "1px solid rgba(255,215,0,0.25)" },
  streakNumber: { fontSize: 20, fontWeight: 800, color: "#FFD700" },
  progressBarContainer: { marginBottom: 20 },
  progressBarBg: { height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #FF6B35, #FFD700)", transition: "width 0.5s ease" },
  scoreSection: { display: "flex", alignItems: "center", padding: 20, borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 },
  miniStat: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)" },
  quoteCard: { padding: "14px 18px", borderRadius: 14, background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)", marginBottom: 24, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 12px" },
  habitCard: { padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", width: "100%", textAlign: "left", boxSizing: "border-box" },
  calendarCard: { padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" },
};
