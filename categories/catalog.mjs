import {datasets,parseAnswers} from './datasets.mjs';
export const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/&/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');
const list = parseAnswers;
const countries = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');
const regionNames = new Intl.DisplayNames(['en'], {type:'region'});
const countryAnswers = countries.map(code => [regionNames.of(code)]);
const extraCountries = {US:['USA','US','United States of America','America'],GB:['UK','Britain','Great Britain','United Kingdom'],KR:['South Korea'],KP:['North Korea'],CZ:['Czech Republic'],TR:['Turkey'],CI:['Ivory Coast'],VA:['Vatican','Vatican City','Holy See'],CD:['DR Congo','Democratic Republic of the Congo','Congo Kinshasa'],CG:['Republic of the Congo','Congo Brazzaville'],SZ:['Swaziland'],MM:['Burma'],CV:['Cape Verde'],TL:['East Timor'],PS:['Palestine']};
countries.forEach((code,i)=>countryAnswers[i].push(...(extraCountries[code]||[])));
const entry = (id,name,pack,difficulty,icon,answers=null,closed=false) => ({id,name,pack,difficulty,icon,answers:typeof answers==='string'?list(answers):answers,closed});
export const catalog = [
  entry('animals','Animals','Everyday','Easy','🦊','cat=house cat|dog|elephant|lion|tiger|bear|giraffe|zebra|horse|cow|pig|sheep|goat|rabbit=bunny|mouse|rat|deer|fox|wolf|monkey|gorilla|chimpanzee|panda|koala|kangaroo|dolphin|whale|shark|octopus|penguin|eagle|owl|duck|chicken|snake|frog|turtle|crocodile|alligator|hippopotamus=hippo|rhinoceros=rhino'),
  entry('fruits','Fruits','Everyday','Easy','🍋','apple|banana|orange|lemon|lime|grape=grapes|mango|pear|peach|plum|pineapple|strawberry=strawberries|raspberry=raspberries|blueberry=blueberries|watermelon|cantaloupe|kiwi=kiwifruit|papaya|guava|cherry=cherries|apricot|nectarine|grapefruit|pomegranate|passion fruit|dragon fruit|lychee|fig|date|coconut|avocado|tomato'),
  entry('kitchen','Things in a kitchen','Everyday','Easy','🍳','microwave|fork|plate|spoon|knife|oven|stove|fridge=refrigerator|freezer|sink|pan|pot|kettle|toaster|blender|cup|mug|bowl|dishwasher|spatula|whisk|cutting board=chopping board'),
  entry('school','Things at school','Everyday','Easy','✏️'),
  entry('wear','Things you wear','Everyday','Easy','🧢'),
  entry('cold','Things that are cold','Everyday','Medium','🧊'),
  entry('beach','Things at the beach','Everyday','Easy','🏖️'),
  entry('foods','Foods','Everyday','Easy','🌮'),
  entry('drinks','Drinks','Everyday','Easy','🧋'),
  entry('jobs','Jobs','Everyday','Medium','🧑‍🚀'),
  entry('countries','Countries (UN members + observers)','World','Medium','🌍',countryAnswers,true),
  entry('states','US states','World','Medium','🗺️','Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming',true),
  entry('planets','Planets in our solar system','World','Easy','🪐','Mercury|Venus|Earth|Mars|Jupiter|Saturn|Uranus|Neptune',true),
  entry('cars','Car brands','Culture','Medium','🏎️','Toyota|BMW|Ford|Honda|Nissan|Hyundai|Kia|Mercedes Benz=Mercedes|Volkswagen=VW|Audi|Porsche|Ferrari|Lamborghini|Volvo|Subaru|Mazda|Tesla|Chevrolet=Chevy|GMC|Buick|Cadillac|Dodge|Jeep|Chrysler|Ram|Lexus|Acura|Infiniti|Mitsubishi|Suzuki|Peugeot|Renault|Citroen|Fiat|Alfa Romeo|Aston Martin|Bentley|Rolls Royce|Mini|Jaguar|Land Rover|BYD|Rivian|Lucid|Polestar|Genesis|Bugatti|McLaren|Lotus|Skoda|Seat|Opel|Dacia|Saab'),
  entry('clothing','Clothing brands','Culture','Medium','👟'),
  entry('fastfood','Fast food restaurants','Culture','Easy','🍟',"McDonald's=McDonalds|Wendy's|Taco Bell|Burger King|Chick-fil-A|KFC=Kentucky Fried Chicken|Subway|Popeyes|Arby's|Sonic|Five Guys|In-N-Out=In N Out Burger|Chipotle|Domino's|Pizza Hut|Dairy Queen=DQ|Jack in the Box|Whataburger|Culver's|Raising Cane's|Panda Express|Shake Shack|Tim Hortons|Dunkin=Dunkin Donuts|Starbucks|Jollibee"),
  entry('celebrities','Celebrities','Culture','Medium','🌟'),
  entry('musicians','Musicians & bands','Culture','Medium','🎸'),
  entry('movies','Movies','Culture','Medium','🎬'),
  entry('games','Video games','Culture','Medium','👾'),
  entry('teams','Sports teams','Culture','Hard','🏆'),
  entry('nba','NBA teams','Culture','Hard','🏀','Atlanta Hawks=Hawks|Boston Celtics=Celtics|Brooklyn Nets=Nets|Charlotte Hornets=Hornets|Chicago Bulls=Bulls|Cleveland Cavaliers=Cavaliers=Cavs|Dallas Mavericks=Mavericks=Mavs|Denver Nuggets=Nuggets|Detroit Pistons=Pistons|Golden State Warriors=Warriors|Houston Rockets=Rockets|Indiana Pacers=Pacers|Los Angeles Clippers=LA Clippers=Clippers|Los Angeles Lakers=LA Lakers=Lakers|Memphis Grizzlies=Grizzlies|Miami Heat=Heat|Milwaukee Bucks=Bucks|Minnesota Timberwolves=Timberwolves|New Orleans Pelicans=Pelicans|New York Knicks=Knicks|Oklahoma City Thunder=Thunder=OKC|Orlando Magic=Magic|Philadelphia 76ers=76ers=Sixers|Phoenix Suns=Suns|Portland Trail Blazers=Trail Blazers=Blazers|Sacramento Kings=Kings|San Antonio Spurs=Spurs|Toronto Raptors=Raptors|Utah Jazz=Jazz|Washington Wizards=Wizards',true),
  entry('apps','Apps','Culture','Medium','📱'),
  entry('brands','Brands','Culture','Medium','🛍️'),
];
catalog.push(
  entry('vegetables','Vegetables','Everyday','Easy','🥕'),
  entry('cities','Cities','World','Medium','🏙️'),
  entry('tv','TV shows','Culture','Medium','📺'),
  entry('objects','Household objects','Everyday','Easy','🛋️'),
  entry('subjects','School subjects','Everyday','Easy','📚'),
  entry('annoying','Things that are annoying','Everyday','Easy','🦟'),
  entry('vacation','Things you bring on vacation','Everyday','Easy','🧳'),
  entry('schoolpeople','People at our school','Local','Wildcard','🎒'),
  entry('teachers','Teachers at our school','Local','Wildcard','🧑‍🏫'),
  entry('friends','People in our friend group','Local','Wildcard','👋'),
  entry('jokes','Inside jokes','Local','Wildcard','😂'),
);
const nouns=new Set(['animals','fruits','vegetables','foods','jobs','objects']);
for(const c of catalog){
  if(datasets[c.id]){c.answers=list(datasets[c.id]);c.closed=true;}
  c.plurals=nouns.has(c.id);
}
const get=id=>catalog.find(c=>c.id===id);
get('foods').answers.push(...get('fruits').answers,...get('vegetables').answers);
get('celebrities').answers.push(...get('musicians').answers);
get('teams').answers.push(...get('nba').answers);
get('fastfood').answers.push(...list("Hardee's|Carl's Jr|Checkers=Rally's|Cook Out|Bojangles|Zaxby's|Church's Chicken=Church's Texas Chicken|El Pollo Loco|Del Taco|Taco John's|Taco Cabana|Moe's Southwest Grill=Moe's|Qdoba|Baja Fresh|Wienerschnitzel|White Castle|Krystal|Steak n Shake|Freddy's|Smashburger|Habit Burger|Fatburger|Johnny Rockets|A and W Restaurants|Long John Silver's|Captain D's|Jimmy John's|Jersey Mike's|Firehouse Subs|Quiznos|Potbelly|Schlotzsky's|Panera Bread|Au Bon Pain|Pret a Manger|Greggs|Leon|Nando's|Pepe's Piri Piri|Wimpy|Hungry Jack's|Red Rooster|Oporto|Guzman y Gomez|Mad Mex|Zambrero|MOS Burger|Lotteria|Freshness Burger|Yoshinoya|Sukiya|Matsuya|CoCo Ichibanya|Dicos|Wallace|Chowking|Mang Inasal|Bonchon|Pollo Campero|Wingstop|Buffalo Wild Wings|Little Caesars|Papa John's|Papa Murphy's|Marco's Pizza|Blaze Pizza|MOD Pizza|Sbarro|Cici's Pizza|Round Table Pizza|Raising Cane's Chicken Fingers=Raising Cane's|Boston Market|Panda Inn|Pei Wei|Sweetgreen|Cava|Saladworks|Just Salad|Tropical Smoothie Cafe|Smoothie King|Jamba=Jamba Juice|Orange Julius|Baskin Robbins|Cold Stone Creamery|Krispy Kreme|Duck Donuts|Tim Horton's=Tim Hortons|Insomnia Cookies|Crumbl Cookies=Crumbl|Auntie Anne's|Wetzel's Pretzels|Cinnabon"));
get('fastfood').closed=true;
get('brands').answers.push(...get('cars').answers,...get('clothing').answers,...get('fastfood').answers);

// Merge overlapping explicit aliases before indexing; a repeated fact is one answer.
export function mergeAnswers(groups){
  const byKey=new Map(),merged=[];
  for(const input of groups){
    const hits=new Set(input.map(normalize).map(key=>byKey.get(key)).filter(Boolean));
    const target=hits.values().next().value||new Set();
    if(!hits.size)merged.push(target);
    for(const group of hits)if(group!==target){for(const alias of group)target.add(alias);group.clear();}
    for(const alias of input)target.add(alias);
    for(const alias of target)byKey.set(normalize(alias),target);
  }
  return merged.filter(g=>g.size).map(g=>[...g]);
}
const irregular={mouse:'mice',louse:'lice',goose:'geese',ox:'oxen',person:'people',child:'children',man:'men',woman:'women',foot:'feet',tooth:'teeth',knife:'knives',wife:'wives',life:'lives',wolf:'wolves',calf:'calves',leaf:'leaves',loaf:'loaves',shelf:'shelves',elf:'elves',thief:'thieves',deer:'deer',sheep:'sheep',moose:'moose',fish:'fish',salmon:'salmon',trout:'trout',tuna:'tuna',shrimp:'shrimp',cod:'cod',bass:'bass',species:'species',series:'series',bison:'bison',dice:'dice',rice:'rice',pasta:'pasta',clothes:'clothes',scissors:'scissors',glasses:'glasses',pants:'pants',shorts:'shorts',jeans:'jeans',tongs:'tongs',pliers:'pliers',asparagus:'asparagus',hummus:'hummus',couscous:'couscous',molasses:'molasses',tomato:'tomatoes',potato:'potatoes',hero:'heroes',echo:'echoes'};
function plural(text){
  return text.replace(/[a-z]+$/i,word=>{const w=word.toLowerCase();if(irregular[w])return irregular[w];if(/[^aeiou]y$/.test(w))return w.slice(0,-1)+'ies';if(/(?:s|x|z|ch|sh)$/.test(w))return w+'es';return w+'s';});
}
const indexes=new WeakMap();
function indexFor(category){
  if(indexes.has(category))return indexes.get(category);
  const index=new Map();
  // Exact dataset spellings win over inferred plurals/articles.
  for(const group of category.answers||[])for(const alias of group)index.set(normalize(alias),normalize(group[0]));
  for(const group of category.answers||[])for(const alias of group){
    const key=normalize(group[0]);
    if(category.plurals&&!index.has(normalize(plural(alias))))index.set(normalize(plural(alias)),key);
    if(['movies','tv','games','musicians','celebrities'].includes(category.id)&&/^the /i.test(alias)){
      const short=normalize(alias.replace(/^the /i,''));if(!index.has(short))index.set(short,key);
    }
  }
  indexes.set(category,index);return index;
}
for(const c of catalog)c.answers=mergeAnswers(c.answers||[]);
// Common noun morphology only: do not stem names, brands, or titles (Cars != Car).
const openPlurals=new Map();
for(const c of catalog.filter(c=>c.plurals))for(const group of c.answers)for(const alias of group){
  const singular=normalize(alias),multiple=normalize(plural(alias));
  if(singular!==multiple)openPlurals.set(multiple,singular);
}
export function answerKey(category,answer){
  const key=normalize(answer),known=indexFor(category).get(key);
  return known||(!category.closed?openPlurals.get(key):null)||key;
}
export function knownVerdict(category,answer){
  if(indexFor(category).has(normalize(answer)))return 'valid';
  return category.closed?'invalid':null;
}
export const publicCatalog=catalog.map(({answers,closed,plurals,...item})=>({...item,validation:closed?'Dataset':'Open · Call Outs',answerCount:answers.length}));
