// All awards are computed once, at turn end, using the original duration.
export function guessPoints(elapsedMs, firstGuessMs, durationMs) {
  const elapsed=Math.max(0,Math.min(durationMs,elapsedMs));
  const lag=Math.max(0,elapsed-firstGuessMs);
  return Math.round(400+200*(1-elapsed/durationMs)+200*Math.exp(-lag/(.2*durationMs)));
}
export function artistPoints(guessTimes, eligible, durationMs) {
  if(!eligible)return 0;
  const speed=guessTimes.reduce((sum,t)=>sum+Math.max(0,Math.min(1,1-t/durationMs)),0);
  return Math.round((1000*guessTimes.length+200*speed)/eligible);
}
export function wordHint(word, positions, elapsedMs, durationMs) {
  const count=elapsedMs>=2*durationMs/3?2:elapsedMs>=durationMs/3?1:0;
  const shown=new Set(positions.slice(0,count));
  return [...word].map((c,i)=>/[a-z0-9]/i.test(c)&&!shown.has(i)?'_':c).join('');
}
export function emojiAvatar(value) {
  const text = String(value ?? '').trim();
  const segments = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)];
  if (segments.length !== 1 || text.length > 40 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(text)) {
    throw Error('Choose one emoji for your avatar (combined emojis are welcome).');
  }
  return text;
}
