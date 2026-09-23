# Sketch Party

Standalone drawing and guessing game, also mounted by the parent Express app at `/sketch-party/`.

Run with Node.js 20+: `npm start` from this folder, then open http://localhost:3210. No game dependencies are required. Run regression tests with `npm test`.

On the existing Render service, push this folder and allow the deployment to finish, then open https://quota.wamomath.org/sketch-party/ and create a room. Send the room invite to friends. No tunnel is required. Restart a local server after source changes because assets are snapshotted on startup.

## Scoring

Scores are calculated once at the end of each drawing, with integer rounding (not multiples of ten).

For a correct guess at elapsed time t, first correct guess f, original duration T:

`round(400 + 200 * (1 - t/T) + 200 * exp(-(t-f)/(0.2*T)))`

Unsolved players get zero. For the drawer, with N eligible guessers at drawing start and successful guess times t:

`round((1000 * numberSolved + 200 * sum(1 - t/T)) / N)`

This gives guessers 400-800 points and the artist up to 1,200. Leaving does not shrink the scoring denominator. Every remaining eligible guesser solving ends the drawing immediately; spectators do not block it. Already earned correct guesses are retained even if the player leaves. If the artist leaves, the drawing ends and recorded guesses settle normally. This is a designed balance of completion, speed, and drawing value, not a proof of globally optimal fun.

## Gameplay

- One letter position is revealed at one-third of the timer, another at two-thirds. Positions are distinct. Short words always retain at least one hidden letter, so one- and two-letter words receive fewer hints.
- Anyone may join an ongoing game. Mid-turn arrivals spectate until the next drawing, start with zero points, and are labeled as late arrivals in the final standings. Their drawing turn is appended to the current round.
- Unsolved guesses are visible to everyone. The artist and correct guessers can reply only to the solved group. Spectators can read public guesses but cannot send messages during the current drawing.
- Scores stay unchanged during drawing. Turn results show the answer and each participant's points earned. Final standings include tied ranks and departed players.
- Play again returns to the same lobby. The host can adjust rounds, time, and custom words before starting; scores reset on Start.
- Leave room removes a player immediately. Lost connections get five seconds to reconnect before removal. Page reloads try to resume the same player using a session-scoped token. A departing host is replaced automatically. A game with fewer than two remaining players finishes after any pending result screen.
- Room state is in memory and resets on restart. Private chat history is not replayed on reconnect. Use one server instance; multiple instances require shared room state.
- Emoji avatars support single Unicode emoji graphemes, including flags, skin tones, and combined emoji.

The original word pack and styling are independent of skribbl.io. You may import your own comma- or newline-separated list. This app is intended for small private groups, without accounts or public-server moderation.
