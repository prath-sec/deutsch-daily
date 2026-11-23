# Deutsch Daily 🇩🇪

A 90-day German speaking course in 3 sections that get harder as you go:
1. **Basics (A1)**, days 1–30: bakery, supermarket, uni, transport, WG.
2. **Everyday life (A2)**, days 31–60: doctor, phone calls, offices, past and future, Werkstudent job.
3. **Fluent & confident (B1)**, days 61–90: harder words for discussing, negotiating, contracts, IT security, storytelling and idioms.

Each lesson takes **2 days**: on day 1 you learn it, on day 2 you revise it from memory. Every week has 3 lessons and then a **weekly test** on that week. Each section ends with a review day and a **section exam** (20 questions).

## How it works
- **Today**: each lesson you get 5 new words and 5 everyday sentences. Each one has 🔊 audio (normal and 🐢 slow) and a 🎤 *Say it* check that listens to you and scores your pronunciation. A grammar tip and a speaking challenge with a timer come with every lesson.
- **Your German hour**: a daily 60-minute checklist that matches the German blocks in the timetable. It resets every day on its own.
- **Review**: finished lessons turn into flashcards. You see the English and say the German out loud. Spaced repetition brings each card back after 1, 2, 4, 7, 15 and 30 days.
- **💬 Conversation practice**: every lesson has a short real-life dialogue. The app plays the other person and you answer out loud.
- **🎙 Record yourself**: record any sentence and play it right after the native audio. Speaking-challenge recordings are saved under *90 days → My recordings*, so you can compare Day 1 with Day 90.
- **Tests**: weekly tests and section exams mix *type it*, *say it*, multiple choice and fill-the-gap, so you produce German yourself. You need 70% to pass, and missed cards go straight into Review.
- **⭐ Phrases**: add your own sentences from real life. They go straight into Review.
- **➕ Bonus words**: an optional pack of 10 common words with every lesson (360 in total, harder in Section 3).
- **🔤 Pronunciation crash course**: one sound per day for the first 8 days, plus a full guide.
- **Daily reminder & backup**: set a reminder time in ⚙️ Settings, and export or import a backup to move your progress to another device (recordings are not included).
- **90 days**: the whole path, with your test scores.
- Streak counter, dark mode, works offline, installable.

The 🎤 speech check works in Chrome and Edge. In other browsers, use 🔊 and compare by ear.

## Put it on GitHub Pages
Upload all files (including `icons/`) to a public repository. Then go to **Settings → Pages → Deploy from a branch → main / (root) → Save**. Your link appears on that page after a minute or two.

## Add or change lessons
Edit `data.js`. Each section has 12 lessons. Dialogues and bonus words are in `extra.js`, in the same order as the lessons. Lesson format: `{ theme, emoji, tip, w: [[German, English] ×5], s: [[German, English] ×5], challenge }`. The 90-day plan is built from them automatically. After changing files, bump `CACHE` in `sw.js` so installed copies update.

Your progress is saved in your browser only.
