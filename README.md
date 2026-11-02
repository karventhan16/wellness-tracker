# Wellness Tracker

Employee wellness and productivity tracker built with React.js and CSS. Modeled on Desklog's employee wellness idea.

## Features
- **Landing page** with features, how it works and privacy sections
- **Create account** and **Sign in** with an Employee / Management switch
- **Forgot password with a 6-digit OTP:** email, code (5 minute expiry, 3 tries, resend after 30 s), then a new password with a strength meter
- **Employee dashboard:** overview, work sessions with peak hours, wellness check-in and AI insights, focus mode (pomodoro, distraction tracker, break reminders), fitness, weekly survey and anonymous feedback, weekly report (CSV), integrations, privacy settings
- **Management dashboard (weekly):** team overview, live status, team table with search and filter, attendance, wellness and burnout risk, analytics, anonymous feedback themes, HR wellness programs, billing, weekly report (CSV), integrations, privacy settings
- **"Open it on your phone" section** on the landing page (desktop only): a QR code and a copy-link button. It fills in your hosted link by itself. If it is empty, paste your GitHub Pages link
- **Back and Home buttons on every page.** Dashboard pages have their own URL, so the browser Back button works too
- Notification bell with stress and break alerts
- Responsive, works on mobile

## Run locally
```bash
npm install
npm run dev
```
Open the Local link. To test on your phone, open the Network link on the same Wi-Fi.

## Demo login
Accounts are stored only in your browser (demo). Create an account, or sign in with any email and a password of 6+ characters. In the forgot-password step no email is sent: the 6-digit code is shown on screen in demo mode.
All dashboard numbers are dummy data (see the arrays in `src/App.jsx`).

## Project structure
- `src/App.jsx` pages: Login, Forgot password, Employee and Management dashboards
- `src/App.css` styles
- `src/main.jsx` entry point
- `src/qr.js` small QR code generator (MIT licensed, by Kazuhiko Arase)
- `docs/index.html` pre-built single-file version for GitHub Pages

## Live site (GitHub Pages)
Settings > Pages > Branch `main`, folder `/docs`.

## Next steps
Connect the login and dashboards to a Node.js/Express and MongoDB API (MERN).
