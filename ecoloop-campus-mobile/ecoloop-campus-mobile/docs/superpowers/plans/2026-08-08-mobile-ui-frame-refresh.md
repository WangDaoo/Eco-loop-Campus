# Mobile UI Frame Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Eco-loop Campus Mobile UI while keeping the original app template and business logic intact.

**Architecture:** Update shared tokens and components first, then restyle the existing screens in place. Navigation, Supabase, QR, AI prediction, mission, reward, and volunteer verification flows remain unchanged.

**Tech Stack:** React Native, Expo, React Navigation, TypeScript, Supabase services already present in the app.

---

### Task 1: Shared UI Shell

**Files:**
- Modify: `src/theme/colors.ts`
- Modify: `src/components/Card.tsx`
- Modify: `src/components/AppButton.tsx`
- Modify: `src/components/Screen.tsx`
- Modify: `App.tsx`

- [ ] Add design tokens from the reference template: pastel background, cyan card, coral nav, dark blue text, softer surfaces.
- [ ] Add card variants for default, blue, green, coral, and white surfaces.
- [ ] Add button variants with pressed feedback and minimum touch height.
- [ ] Restyle tab bars while keeping existing tab names and routes.

### Task 2: Student Screens

**Files:**
- Modify: `src/screens/LoginScreen.tsx`
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/SubmitScreen.tsx`
- Modify: `src/screens/MapScreen.tsx`
- Modify: `src/screens/RewardsScreen.tsx`
- Modify: `src/screens/HistoryScreen.tsx`

- [ ] Keep all handlers and data calls.
- [ ] Improve visual hierarchy, cards, quick actions, QR card, AI helper card, map frame, reward list, and history badges.
- [ ] Repair Vietnamese mojibake in edited copy.

### Task 3: Volunteer Screens

**Files:**
- Modify: `src/screens/VolunteerDutyScreen.tsx`
- Modify: `src/screens/ScannerScreen.tsx`

- [ ] Keep anti-fraud scan result logic.
- [ ] Improve scanner frame, proof image section, pending queue, and station duty cards.
- [ ] Repair Vietnamese mojibake in edited copy.

### Task 4: Verification

**Files:**
- Inspect tests under `src/**/*.test.ts`.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Report any blocked LDPlayer/manual check separately.
