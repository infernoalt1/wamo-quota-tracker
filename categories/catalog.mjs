// Category prompts only. There are no answer lists or automated fit judgments.
const entry=(id,name,pack,difficulty,icon,plurals=false)=>({id,name,pack,difficulty,icon,plurals});
export const catalog=[
  entry('animals','Animals','Everyday','Easy','\u{1f98a}',true),
  entry('fruits','Fruits','Everyday','Easy','\u{1f34b}',true),
  entry('vegetables','Vegetables','Everyday','Easy','\u{1f955}',true),
  entry('foods','Foods','Everyday','Easy','\u{1f32e}',true),
  entry('drinks','Drinks','Everyday','Easy','\u{1f9cb}',true),
  entry('jobs','Jobs','Everyday','Medium','\u{1f9d1}\u200d\u{1f680}',true),
  entry('objects','Household objects','Everyday','Easy','\u{1f6cb}',true),
  entry('subjects','School subjects','Everyday','Easy','\u{1f4da}'),
  entry('kitchen','Things in a kitchen','Everyday','Easy','\u{1f373}',true),
  entry('school','Things at school','Everyday','Easy','\u270f\ufe0f',true),
  entry('wear','Things you wear','Everyday','Easy','\u{1f9e2}',true),
  entry('cold','Things that are cold','Everyday','Medium','\u{1f9ca}',true),
  entry('beach','Things at the beach','Everyday','Easy','\u{1f3d6}',true),
  entry('annoying','Things that are annoying','Everyday','Easy','\u{1f99f}',true),
  entry('vacation','Things you bring on vacation','Everyday','Easy','\u{1f9f3}',true),
  entry('countries','Countries','World','Medium','\u{1f30d}'),
  entry('states','US states','World','Medium','\u{1f5fa}'),
  entry('cities','Cities','World','Medium','\u{1f3d9}'),
  entry('planets','Planets','World','Easy','\u{1fa90}'),
  entry('cars','Car brands','Culture','Medium','\u{1f3ce}'),
  entry('clothing','Clothing brands','Culture','Medium','\u{1f45f}'),
  entry('fastfood','Fast food restaurants','Culture','Easy','\u{1f35f}'),
  entry('celebrities','Celebrities','Culture','Medium','\u{1f31f}'),
  entry('musicians','Musicians & bands','Culture','Medium','\u{1f3b8}'),
  entry('movies','Movies','Culture','Medium','\u{1f3ac}'),
  entry('tv','TV shows','Culture','Medium','\u{1f4fa}'),
  entry('games','Video games','Culture','Medium','\u{1f47e}'),
  entry('teams','Sports teams','Culture','Hard','\u{1f3c6}'),
  entry('nba','NBA teams','Culture','Hard','\u{1f3c0}'),
  entry('apps','Apps','Culture','Medium','\u{1f4f1}'),
  entry('brands','Brands','Culture','Medium','\u{1f6cd}'),
  entry('schoolpeople','People at our school','Local','Wildcard','\u{1f392}'),
  entry('teachers','Teachers at our school','Local','Wildcard','\u{1f9d1}\u200d\u{1f3eb}'),
  entry('friends','People in our friend group','Local','Wildcard','\u{1f44b}'),
  entry('jokes','Inside jokes','Local','Wildcard','\u{1f602}'),
];
export const normalize=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'');
// Morphology is only for duplicate detection, never for deciding category fit.
// Named entities, titles, and custom prompts keep their spelling (Cars != Car).
const singularForms={mice:'mouse',geese:'goose',teeth:'tooth',feet:'foot',children:'child',people:'person',men:'man',women:'woman',oxen:'ox',lice:'louse',knives:'knife',wolves:'wolf',shelves:'shelf',leaves:'leaf',loaves:'loaf',calves:'calf',halves:'half',wives:'wife',lives:'life',scarves:'scarf',tomatoes:'tomato',potatoes:'potato',heroes:'hero',echoes:'echo',cacti:'cactus',octopi:'octopus'};
const unchanged=new Set(['species','series','news','means','clothes','pants','shorts','jeans','scissors','pliers','tongs','asparagus','hummus','couscous','molasses','fries']);
function singular(word){
  if(singularForms[word])return singularForms[word];
  if(unchanged.has(word))return word;
  if(word.length>4&&/[^aeiou]ies$/.test(word))return word.slice(0,-3)+'y';
  if(/(?:ches|shes|sses|xes|zzes)$/.test(word))return word.slice(0,-2);
  if(word.length>3&&word.endsWith('s')&&!/(?:ss|us|is)$/.test(word))return word.slice(0,-1);
  return word;
}
export function answerKey(category,answer){
  if(!category.plurals)return normalize(answer);
  const text=String(answer).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
  return normalize(text.replace(/([a-z]+)([^a-z]*)$/,(_,word,end)=>singular(word)+end));
}
export const publicCatalog=catalog.map(({plurals,...item})=>item);
