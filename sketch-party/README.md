# Sketch Party

Standalone drawing and guessing game, also mounted by the parent Express app at `/sketch-party/`.

Run with Node.js 20+: `npm start` from this folder, then open http://localhost:3210. No game dependencies are required. Run regression tests with `npm test`.

On the existing Render service, push this folder and allow the deployment to finish, then open https://quota.wamomath.org/sketch-party/ and create a room. Send the room invite to friends. No tunnel is required. Restart a local server after source changes because assets are snapshotted on startup.

## Scoring

Scores are calculated once at the end of each drawing, with integer rounding (not multiples of ten).

For a correct guess at elapsed time t, finishing position k (1-based server receipt order), original duration T:

`round(100 + 400 * (1 - t/T) + 400/k)`

This is an explicitly custom order-plus-time formula: first receives a 400-point order bonus, second 200, third approximately 133, in addition to 100-500 time-based points. The exact current skribbl.io server scoring formula could not be verified from https://skribbl.io/ or available public references; this implementation does not claim to reproduce it exactly.

Unsolved players get zero. For the drawer, with N eligible guessers at drawing start and successful guess times t:

`round((1000 * numberSolved + 200 * sum(1 - t/T)) / N)`

This gives guessers up to 900 points and the artist up to 1,200. Leaving does not shrink the scoring denominator. Every remaining eligible guesser solving ends the drawing immediately; spectators do not block it. Already earned correct guesses are retained even if the player leaves. If the artist leaves, the drawing ends and recorded guesses settle normally. This is a designed balance of completion, speed, and drawing value, not a proof of globally optimal fun.

## Gameplay

- One letter position is revealed at one-third of the timer, another at two-thirds. Positions are distinct. Short words always retain at least one hidden letter, so one- and two-letter words receive fewer hints.
- Anyone may join an ongoing game. Mid-turn arrivals spectate until the next drawing, start with zero points, and are labeled as late arrivals in the final standings. Their drawing turn is appended to the current round.
- Unsolved guesses are visible to everyone. The artist and correct guessers can reply only to the solved group. Spectators can read public guesses but cannot send messages during the current drawing.
- Scores stay unchanged during drawing. Turn results show the answer and each participant's points earned. Final standings include tied ranks and departed players.
- Play again returns to the same lobby. The host can adjust rounds, time, and custom words before starting; scores reset on Start.
- Leave room removes a player immediately. Lost connections get 15 seconds before removal from the active player list, then may resume their existing identity for up to two minutes. Explicit Leave removes immediately and cannot be resumed. Page reloads try to resume the same player using a session-scoped token. A departing host is replaced automatically. A game with fewer than two remaining players finishes after any pending result screen.
- Room state is in memory and resets on restart. The latest 250 messages delivered to each player are retained and replayed only to that same player on reconnect. Private messages remain visible across turns, without becoming visible to previous non-recipients. Use one server instance; multiple instances require shared room state.
- Emoji avatars support single Unicode emoji graphemes, including flags, skin tones, and combined emoji.

The default word pack contains 2,312 unique words from the user-supplied word,count CSV. Exact duplicates were removed; capitalization and punctuation are preserved. The count column is metadata, not a selection weight. You may import your own comma- or newline-separated list. This app is intended for small private groups, without accounts or public-server moderation.


## Connection recovery

SSE sends a state heartbeat every second. If no event arrives for 12 seconds, the client resumes the session and opens a fresh stream, receiving authoritative canvas/state and authorized chat history. Network failures retry; only HTTP 410 expires the session. Requests have a 10-second timeout. Drawing uploads are batched and checked against their turn ID. Reconnects and wake-from-background restore current state. These fixes address reproducible client failure paths; they do not establish the cause of every live Render outage. A Render process restart still clears all in-memory rooms.
