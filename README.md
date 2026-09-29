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
2. Run the app:
   `npm run dev`

## HTML compiler

Open `/compiler` (or `/compiler/`) in development or on the deployed site. Edit HTML, CSS, and JavaScript, then choose **Run code** to open the result in a new browser tab without an iframe. The editor saves drafts locally and can download a combined `index.html`. Full HTML documents, fragments, and inline scripts are supported; use absolute URLs for external assets. JavaScript in the JavaScript tab runs as a classic script after the HTML. Preview code is not sandboxed and shares the site's origin, so only run trusted code. Run `npm run test:compiler` to check document generation and script execution.

## Categories party game

The Node server also serves the standalone multiplayer game in [`categories/`](categories/README.md) at `/categories/`, alongside `/sketch-party/`. Deploy the folder and root `server.js` together using the existing hosting setup. Run `npm run test:categories` for game tests. Friends judge every category through Call Outs; no external service or API key is needed.
