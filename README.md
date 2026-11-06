# VolleyBoard

A web app for our volleyball team to plan and discuss **rotations**, simulate **rallies** and track **stats**.
Everything runs in the browser (no backend) and is saved automatically in `localStorage`.

## Features

- **Rotations** – drag players on the court for each of the 6 rotations and 3 phases
  (*serve receive*, *after receive / attack*, *our serve*). Every spot you place is remembered.
  - Live **overlap-rule check** (P1 behind P2, P4 left of P3 …) with red warnings in serve receive. On our serve positioning is free (Swiss regional rules), so no check there.
  - Movement arrows between receive ⇄ attack, notes per rotation/phase, overview of all 6 rotations.
  - Change who plays a position (dropdown or drag a bench player onto the court) – the spots stay with the *position*, the new player takes them over.
  - Libero automatically replaces the back-row middle (toggle). Multiple **lineup plans** (e.g. 5-1 with Maciek / with Tristan).
  - Arrow keys nudge the selected player, `[` / `]` change rotation.
- **Play** – ball simulation: opponent serves (click where), you grade the pass (1–3), click who gets the set, pick the attack result
  (kill, block-out, feint, roll shot, tooled block, dug, blocked, error). Players glide from receive to attack positions. Auto-play mode, side-out → rotate → serve.
- **Stats** – tap-to-record serve (ace / tough / error), pass, set (1–3 + target), attack (kill, block-out, feint …), block, dig, other errors, team events.
  Player table, hitting efficiency, pass distribution, set distribution, points by rotation, sessions per match/practice, full log with delete/undo.
- **Share / Backup** – copy a link that contains roster + lineups + positions, or export/import everything (incl. stats) as JSON.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # checks that every default formation is legal
npm run build      # type-check + production build into dist/
```

## Deploy to Vercel

1. Push this folder to a Git repository (GitHub, GitLab …) and *Import Project* on [vercel.com/new](https://vercel.com/new) – the Vite framework is detected automatically (`vercel.json` is included), or
2. run `npx vercel` in this folder (and `npx vercel --prod` to publish).

Data lives in each person's browser. To get everybody on the same page use **Share / Backup → Copy link**.
If you later want live shared data, the store in `src/lib/store.ts` is the only place that would need a backend.

## Project layout

```
src/lib/formation.ts   rotation maths, default formations, overlap rules
src/lib/stats.ts       stat catalogue + aggregation
src/lib/store.ts       zustand store (persisted) + ephemeral UI state
src/components/        BoardView, PlayView, StatsView, RosterView, Court/Token, dialogs
scripts/check-formations.ts
```
