// A large completion reward, with a smaller timer-normalized speed bonus.
export function guessPoints(remainingMs, durationMs) {
  const fraction = Math.max(0, Math.min(1, remainingMs / durationMs));
  return 300 + 10 * Math.round(20 * fraction);
}
// Fixed starting audience: leaving cannot inflate the artist's reward.
export function artistPoints(solved, eligible) {
  return eligible > 0 ? Math.round(1000 * Math.min(solved, eligible) / eligible) : 0;
}
export function emojiAvatar(value) {
  const text = String(value ?? '').trim();
  const segments = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)];
  if (segments.length !== 1 || text.length > 40 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(text)) {
    throw Error('Choose one emoji for your avatar (combined emojis are welcome).');
  }
  return text;
}
