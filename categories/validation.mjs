import {knownVerdict,normalize} from './catalog.mjs';

// Pure, synchronous, local validation. Unusual custom answers are left to friends.
const placeholders=new Set(['idk','idontknow','dunno','noidea','pass','skip','asdf','asdfgh','qwerty','blahblah']);
export function validateAnswer(category,answer){
  if(knownVerdict(category,answer)==='valid')return {verdict:'valid',reason:'On the answer list.'};
  const key=normalize(answer);
  if(!/\p{L}/u.test(key)||placeholders.has(key)||/^(.)\1{4,}$/u.test(key))return {verdict:'invalid',reason:'That is not a real answer.'};
  if(category.closed)return {verdict:'invalid',reason:'Not in this category\u2019s answer set.'};
  return {verdict:'valid',reason:'Open category \u2014 accepted. Call Out if it doesn\u2019t fit.'};
}
