<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# InternPlus Portal

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create your environment file:
   - Copy `.env.example` to `.env`
   - Fill in all `VITE_FIREBASE_*` variables
3. Run the app:
   `npm run dev`

## Deploy (Netlify)

1. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
2. Environment variables:
   - Set all variables from `.env.example` in Netlify (Site settings -> Environment variables)
