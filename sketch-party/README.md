# Sketch Party

An independent multiplayer drawing and guessing game. Everything lives in this folder; no parent-project dependencies or changes are required.

## Run

With Node.js 20 or newer, open a terminal in this folder:

```sh
npm start
```

Open http://localhost:3210. Create a room, copy the invite, and open it in another browser tab to test with two players. Friends on the same network can use your computer's LAN IP instead of localhost. Internet play requires hosting this server with an accessible URL and support for long-lived Server-Sent Events connections. Set `PORT` to change the default port.

Features: 2–12 players, private invite codes, host controls, configurable rounds and timers, three-word selection, rotating artists, shared mouse/touch drawing, brush sizes, colors, eraser, undo, clear, live guesses, server-validated answers, time-based scoring, scoreboards, optional sound, and rematches. Each correct guess earns 100–500 points depending on time remaining; the artist earns 75 points per correct guess. Disconnected players are removed after 60 seconds.

The bundled word list is original, not skribbl.io's proprietary list. Paste comma/newline-separated words or import a text file before creating a room to use your own list. At least three distinct English words are required; otherwise the original list is used. No skribbl.io branding or assets are included.

Room state exists in server memory and resets on restart. This is a working small-group game, not a hardened public hosting service: there are no accounts, durable rooms, moderation, or global abuse controls. System fonts work offline. Drawing and gameplay need no third-party packages or services.

```sh
npm test
```

Tests cover room creation, joining, host permissions, word secrecy, drawing permissions, shared drawing, guessing, scoring, and round completion.


## Scoring

There is no single objectively fairest formula. This version favors solving the drawing over tiny speed differences and keeps an artist's maximum award independent of room size.

- Guesser: `300 + 10 * round(20 * remainingTime / turnDuration)` points. The remaining fraction is clamped to 0?1. At 100%, 75%, 50%, 25%, and 0% time left, the award is 500, 450, 400, 350, and 300. Guesses must arrive before the deadline.
- Artist: `round(1000 * correctGuessers / startingGuessers)`. Awarded incrementally as people solve. Half the audience solving earns 500; everyone solving earns 1,000. The starting audience is fixed when the word is selected, so leaving cannot increase this award.
- No first-place bonus, no penalty for incorrect guesses, and no repeat scoring. Speed bonuses use ten-point steps, reducing sensitivity to tiny network differences (boundaries can still separate close guesses). The server measures receipt time; this does not promise perfect latency compensation.
- Every player gets one drawing turn per round. Longer timers preserve the same point range. Disconnections and differences in word difficulty can still affect fairness.

## Emoji avatars and chat

Pick a suggested emoji or paste any single emoji into the avatar field. Compound emojis, flags, skin tones, and families are supported. Use **Change emoji** in a room to update it. Your selection is remembered on this browser.

During drawing, the one chat panel automatically displays your group: either players still guessing, or the artist and players who already solved. Messages are routed only to that group by the server; they are not merely hidden with CSS. Switching groups clears the old group's messages from view. Correct-guess announcements are public but never include the answer. Everyone rejoins public chat during the reveal; private messages do not become public. Private history is not replayed to later solvers or reconnecting clients.

Correct guesses display a green success strip below the canvas with the points earned, turn the player's row green, reveal the word to that player, and switch the chat to green. The board uses a compact blue-background layout inspired by the left-player / center-canvas / right-chat arrangement of skribbl.io, with original styling.


Version 3: unified stylesheet, compact blue game layout, validated 32-emoji picker with custom emoji support, 1,000-point artist maximum, guarded success messages, and startup-snapshotted assets with no-store responses to avoid mixed frontend/backend versions. Restart the server after code changes.
