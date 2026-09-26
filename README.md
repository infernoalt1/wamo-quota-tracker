<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1iZftsT3Nd-jxKPSUg3tdNSJbS2vOFIKZ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Categories party game

The Node server also serves the standalone multiplayer game in [`categories/`](categories/README.md) at `/categories/`, alongside `/sketch-party/`. Deploy the folder and root `server.js` together using the existing hosting setup. Run `npm run test:categories` for game tests. Set `GEMINI_API_KEY` on the server for AI judging; open-ended answers use group voting without it.
