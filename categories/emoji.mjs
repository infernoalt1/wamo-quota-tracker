const segments=new Intl.Segmenter('en',{granularity:'grapheme'});

// Keep joined families, skin tones, flags, and keycaps as one avatar.
export function validateEmoji(value='🙂') {
  if(typeof value!=='string')throw Error('Choose one emoji.');
  const emoji=value.trim();
  if(emoji.length>64||[...segments.segment(emoji)].length!==1||
    !/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(emoji)||
    !/^[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\ufe0e\u20e3\u{e0020}-\u{e007f}0-9#*]+$/u.test(emoji))throw Error('Choose one emoji.');
  return emoji;
}
