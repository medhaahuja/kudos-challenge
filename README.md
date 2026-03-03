# Kudos 21-Day Challenge Tracker

## Quick Setup in Cursor

1. Open Cursor
2. File → Open Folder → select this `kudos-21day-challenge` folder
3. Open the terminal in Cursor (Ctrl + ` or Cmd + `)
4. Run:

```bash
npm install
npm run dev
```

5. Open http://localhost:5173 in your browser — done!

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com → Sign up with GitHub
3. Click "New Project" → Import your repo
4. Click "Deploy" — that's it!
5. You'll get a URL like `kudos-21day-challenge.vercel.app`
6. Share that link in your WhatsApp group

## Project Structure

```
kudos-21day-challenge/
├── index.html          ← Entry HTML
├── package.json        ← Dependencies
├── vite.config.js      ← Build config
└── src/
    ├── main.jsx            ← React mount
    └── ChallengeTracker.jsx ← All the app logic
```

## Customization

- **Start date**: Change `startDate` in ChallengeTracker.jsx (line ~232)
- **Challenge duration**: Change `CHALLENGE_DAYS` constant
- **Water bottles**: Change `WATER_BOTTLES` and `WATER_DONE_THRESHOLD`
- **Habits**: Edit the `HABITS` array to add/remove/rename habits
- **Quotes**: Edit `MOTIVATIONAL_QUOTES` array
