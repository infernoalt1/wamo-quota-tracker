Retro Bowl route changes for infernoalt1/wamo-quota-tracker

1. Copy public/retrobowl/index.html into the repository at that path.
2. Replace vite.config.ts with the supplied file (based on main as inspected October 15, 2026).
3. Run npm run dev; visit http://localhost:5173/retrobowl.
4. In production, npm run build copies public/retrobowl/index.html to dist/retrobowl/index.html; Express static handling serves /retrobowl/.

Note: This is a launcher embedding the third-party website retrobowl.dev, not a redistribution of the game's copyrighted assets. If that website blocks embedding, the "Open game" link takes the user directly there.
