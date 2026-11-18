/* ---------- USDA FoodData Central em português ----------
   Busca: os termos em português viram inglês (USDA_PT, coluna 1 -> 2).
   Resultado: a descrição em inglês vira português, palavra por palavra (coluna 2 -> 1).
   Palavras sem tradução ficam em inglês. Terceiro item 'q' = só na busca, 'r' = só no resultado. */
const USDA_KEY='__USDA_KEY__';
const USDA_PT=[
 // carnes e peixes
 ['frango','chicken'],['galinha','chicken','q'],['peru','turkey'],['pato','duck'],['coelho','rabbit'],
 ['carne bovina','beef','r'],['bovina','beef','q'],['boi','beef','q'],['carne','beef','q'],['carne','meat','r'],
 ['porco','pork'],['suína','pork','q'],['suíno','pork','q'],['bacon','bacon'],['presunto','ham'],['linguiça','sausage'],['salsicha','frankfurter'],['mortadela','bologna'],
 ['cordeiro','lamb'],['carneiro','lamb','q'],['vitela','veal'],['fígado','liver'],['coração','heart'],['rim','kidney'],
 ['peixe','fish'],['salmão','salmon'],['atum','tuna'],['sardinha','sardine'],['tilápia','tilapia'],['bacalhau','cod'],['truta','trout'],['anchova','anchovy'],['merluza','hake','q'],
 ['camarão','shrimp'],['lagosta','lobster'],['caranguejo','crab'],['lula','squid'],['polvo','octopus'],['ostra','oyster'],['mexilhão','mussel'],
 ['ovo','egg'],['gema','egg yolk','q'],['clara','egg white','q'],
 ['peito','breast'],['coxa','thigh'],['sobrecoxa','thigh','q'],['asa','wing'],['perna','leg'],['costela','rib'],['lombo','loin'],['picanha','sirloin'],['alcatra','sirloin'],['patinho','round'],['acem','chuck'],['fraldinha','flank'],['mignon','tenderloin'],['moído','ground'],['moida','ground','q'],['pele','skin'],['osso','bone'],['magra','lean'],['magro','lean','q'],
 // laticínios
 ['leite','milk'],['queijo','cheese'],['iogurte','yogurt'],['manteiga','butter'],['creme','cream'],['nata','cream','q'],['requeijão','cream cheese','q'],['ricota','ricotta'],['muçarela','mozzarella'],['muçarela','mozzarella','q'],['parmesão','parmesan'],['cottage','cottage'],['sorvete','ice cream'],['whey','whey'],['soro','whey','r'],['desnatado','nonfat'],
 // cereais, massas, pães
 ['arroz','rice'],['feijão','bean'],['lentilha','lentil'],['grão-de-bico','chickpea'],['ervilha','pea'],['soja','soy'],['milho','corn'],['trigo','wheat'],['aveia','oat'],['centeio','rye'],['cevada','barley'],['quinoa','quinoa'],
 ['macarrão','pasta'],['massa','pasta','q'],['pão','bread'],['farinha','flour'],['torrada','toast'],['biscoito','cookie'],['bolacha','cracker'],['bolo','cake'],['cereal','cereal'],['granola','granola'],['tapioca','tapioca'],['mandioca','cassava'],['macaxeira','cassava','q'],['aipim','cassava','q'],['cuscuz','couscous'],['amido','starch'],['fubá','cornmeal'],['pipoca','popcorn'],
 // frutas
 ['banana','banana'],['maçã','apple'],['laranja','orange'],['limão','lemon'],['lima','lime'],['uva','grape'],['morango','strawberry'],['abacaxi','pineapple'],['manga','mango'],['mamão','papaya'],['melancia','watermelon'],['melão','melon'],['pera','pear'],['pêssego','peach'],['ameixa','plum'],['abacate','avocado'],['coco','coconut'],['kiwi','kiwi'],['goiaba','guava'],['maracujá','passion fruit'],['cereja','cherry'],['framboesa','raspberry'],['mirtilo','blueberry'],['figo','fig'],['tâmara','date'],['passa','raisin'],['açaí','acai'],['caqui','persimmon'],['romã','pomegranate'],['tangerina','tangerine'],['mexerica','tangerine','q'],['toranja','grapefruit'],['damasco','apricot'],
 // legumes e verduras
 ['batata','potato'],['batata-doce','sweet potato'],['tomate','tomato'],['cebola','onion'],['alho','garlic'],['cenoura','carrot'],['brócolis','broccoli'],['couve','kale'],['couve-flor','cauliflower'],['espinafre','spinach'],['alface','lettuce'],['repolho','cabbage'],['pepino','cucumber'],['abobrinha','squash'],['abóbora','pumpkin'],['beterraba','beet'],['berinjela','eggplant'],['pimentão','pepper'],['pimenta','pepper','q'],['cogumelo','mushroom'],['champignon','mushroom','q'],['aipo','celery'],['salsão','celery','q'],['aspargo','asparagus'],['quiabo','okra'],['rabanete','radish'],['nabo','turnip'],['rúcula','arugula'],['agrião','watercress'],['inhame','yam'],['chuchu','chayote'],['vagem','green bean','q'],['salsa','parsley'],['coentro','coriander'],
 // oleaginosas e sementes
 ['amendoim','peanut'],['castanha','nut'],['noz','walnut'],['nozes','walnut','q'],['caju','cashew'],['amêndoa','almond'],['pistache','pistachio'],['avelã','hazelnut'],['macadâmia','macadamia'],['semente','seed'],['chia','chia'],['linhaça','flaxseed'],['gergelim','sesame'],['girassol','sunflower'],
 // gorduras, molhos, doces
 ['azeite','olive oil','q'],['oliva','olive'],['óleo','oil'],['gordura','fat'],['margarina','margarine'],['banha','lard'],['maionese','mayonnaise'],['molho','sauce'],['ketchup','catsup'],['mostarda','mustard'],['vinagre','vinegar'],
 ['açúcar','sugar'],['mel','honey'],['chocolate','chocolate'],['cacau','cocoa'],['geleia','jam'],['pudim','pudding'],['bala','candy'],['sal','salt'],
 // bebidas
 ['água','water'],['café','coffee'],['chá','tea'],['suco','juice'],['refrigerante','carbonated beverage','q'],['cerveja','beer'],['vinho','wine'],['vodka','vodka'],
 // preparo e descrição (só no resultado, mais algumas na busca)
 ['cru','raw','r'],['cozido','cooked','r'],['assado','roasted','r'],['assado','baked','r'],['grelhado','grilled','r'],['grelhado','broiled','r'],['frito','fried','r'],['refogado','braised','r'],['fervido','boiled','r'],['cozido no vapor','steamed','r'],['defumado','smoked','r'],['curado','cured','r'],['em conserva','pickled','r'],['enlatado','canned','r'],['congelado','frozen','r'],['seco','dried','r'],['desidratado','dehydrated','r'],['fresco','fresh','r'],['salgado','salted','r'],['sem sal','unsalted','r'],['sem sal','without salt','r'],['com sal','with salt','r'],['sem açúcar','unsweetened','r'],['adoçado','sweetened','r'],['natural','plain','r'],
 ['apenas carne','meat only','r'],['carne com pele','meat and skin','r'],['apenas pele','skin only','r'],['apenas parte magra','separable lean only','r'],['parte magra e gordura','separable lean and fat','r'],['sem osso','boneless','r'],['sem pele','skinless','r'],['não enriquecido','not enriched','r'],['enriquecido','enriched','r'],['baixo teor de gordura','low fat','r'],['sem gordura','fat free','r'],['gordura reduzida','reduced fat','r'],['pronto para consumo','ready-to-eat','r'],['escorrido','drained','r'],['sólidos e líquido','solids and liquids','r'],['de corte','broilers or fryers','r'],['todos os tipos','all grades','r'],['uso geral','all-purpose','r'],
 ['grão longo','long-grain','r'],['grão curto','short-grain','r'],['grão médio','medium-grain','r'],['inteiro','whole','r'],['integral','whole-wheat','r'],['integral','whole wheat','r'],['cozido duro','hard-boiled','r'],['cozido mole','soft-boiled','r'],['para salada ou cozinhar','salad or cooking','r'],['industrializado','commercial','r'],['sementes maduras','mature seeds','r'],['líquido','fluid','r'],['gordura do leite','milkfat','r'],['com casca','in skin','r'],['carne magra','lean meat','r'],['assado com casca','baked in skin','r'],['em','in','r'],['cozinhar','cooking','r'],['salada','salad','r'],['de','of','r'],['sem sementes','seedless','r'],['preto','black','r'],['fatiado','sliced','r'],['picado','chopped','r'],['aparado','trimmed','r'],['grande','large','r'],['pequeno','small','r'],['médio','medium','r'],
 ['branco','white','r'],['integral','brown','r'],['vermelho','red','r'],['verde','green','r'],['amarelo','yellow','r'],['preto','black','r'],['doce','sweet','r'],['silvestre','wild','r'],['escuro','dark','r'],['claro','light','r'],['com','with','r'],['sem','without','r'],['e','and','r'],['ou','or','r'],['apenas','only','r'],['feijão','beans','r'],['ovos','eggs','r'],['nozes','nuts','r'],['aveia','oats','r']
];
const _usdaQ=new Map(),_usdaR=new Map();
for(const [pt,en,flag] of USDA_PT){const p=plainSearch(pt);if(flag!=='r'&&!_usdaQ.has(p))_usdaQ.set(p,en);if(flag!=='q'&&!_usdaR.has(en))_usdaR.set(en,pt)}
const _usdaRe=new RegExp('\\b('+[..._usdaR.keys()].sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?:s|es)?\\b','g');
function usdaPt(desc){const out=String(desc).split(/,\s*/).map(seg=>seg.toLowerCase().replace(_usdaRe,(m,k)=>_usdaR.get(k)||m)).join(', ');return out?out[0].toUpperCase()+out.slice(1):out}
function usdaQuery(raw){const en=[];for(const t of raw.toLocaleLowerCase('pt-BR').split(/\s+/)){const p=plainSearch(t);if(!p||STOP.has(p))continue;const e=_usdaQ.get(p)??_usdaQ.get(stemTerm(p))??_usdaQ.get(swapGender(p));if(e&&!en.includes(e))en.push(e)}return en.join(' ')}
const usdaTimes=[];
function usdaFood(x){const n={};for(const fn of x.foodNutrients||[]){const v=Number(fn.value);if(Number.isFinite(v))n[fn.nutrientId]=v}
 const kcal=n[1008]??n[2047]??n[2048],carbs=n[1005],protein=n[1003],fat=n[1004],r1=v=>Math.round(v*10)/10;
 if(![kcal,carbs,protein,fat].every(Number.isFinite)||!x.fdcId||!x.description)return null;
 const f={id:'usda-'+x.fdcId,name:usdaPt(x.description).slice(0,60),base:'100g',portion:'',favorite:false,source:'USDA FoodData Central',kcal:r1(kcal),carbs:r1(carbs),protein:r1(protein),fat:r1(fat),fiber:Number.isFinite(n[1079])?r1(n[1079]):0};
 if(Number.isFinite(n[2000]))f.sugars=r1(n[2000]);if(Number.isFinite(n[1258]))f.satfat=r1(n[1258]);if(Number.isFinite(n[1093]))f.sodium=Math.round(n[1093]);
 return validFood(f)?f:null}
// Devolve a lista de alimentos genéricos, [] se nada a buscar, ou null se a consulta falhou.
async function fetchUsda(query){const q=usdaQuery(query);if(!q)return [];const now=Date.now();while(usdaTimes.length&&usdaTimes[0]<now-60000)usdaTimes.shift();if(usdaTimes.length>=15)return null;usdaTimes.push(now);
 const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),9000);
 try{const r=await fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key='+encodeURIComponent(USDA_KEY||'DEMO_KEY')+'&query='+encodeURIComponent(q)+'&dataType=Foundation,SR%20Legacy&pageSize=25&requireAllWords=true',{signal:ctrl.signal});if(!r.ok)return null;
  const d=await r.json(),seen=new Set(),out=[];for(const x of d.foods||[]){const f=usdaFood(x);if(!f)continue;const k=f.name.toLowerCase()+'|'+Math.round(f.kcal);if(seen.has(k))continue;seen.add(k);out.push(f)}return out}
 catch(e){return null}finally{clearTimeout(t)}}
