/* ===== v18: busca limpa, nomes, pratos, porções rápidas, copiar, só calorias ===== */
(()=>{
$('openScanBtn').onclick=()=>selectFoodTab('barcode');
$('openVoiceBtn').onclick=()=>selectFoodTab('voice');
document.querySelectorAll('#foodChips button').forEach(b=>b.onclick=()=>{$('foodSort').value=b.dataset.chip;catalogLimit=40;renderCatalog();scheduleOnline();$('foodList').parentElement.scrollTop=0});
const _oc=openCatalog;openCatalog=function(forMeal){onlineAll=false;onlineQuery='';_oc(forMeal);$('kcalOnly').hidden=!forMeal;dishBar()};
function dishBar(){const show=catalogForMeal&&basket.length>=2;$('dishBar').hidden=!show;if(show)$('dishBarText').textContent=basket.length+' alimentos selecionados'}
const _rb=renderBasket;renderBasket=function(){_rb();dishBar()};
// porção: título legível, favorito e quantidades rápidas
const _op=openPortion;openPortion=function(food,entry=null){_op(food,entry);
 $('portionFoodTitle').textContent=displayName(food);
 $('portionFoodName').textContent=[capFirst(foodDetail(food)),dayLabel(entry?.day??mealContextDay),/TACO/.test(food.source||'')?'Tabela TACO':food.source].filter(Boolean).join(' · ');
 const kc=String(food.id).startsWith('kcal-');$('portionFav').hidden=kc;
 const saved=state.foods.find(x=>x.id===food.id);$('portionFav').setAttribute('aria-pressed',String(!!(saved?saved.favorite:food.favorite)));
 const q=$('portionQuick');q.replaceChildren();const g=food.base==='100g',vals=g?[50,100,150,200,300]:[.5,1,1.5,2,3];
 const mark=()=>q.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.v)===Number($('portionAmount').value))));
 for(const v of vals){const b=el('button',g?v+' g':(v===.5?'½':nfmt(v))+(g?'':v<=1?' porção':' porções'));b.type='button';b.dataset.v=v;b.onclick=()=>{$('portionAmount').value=v;$('portionAmount').dispatchEvent(new Event('input'));mark()};q.append(b)}
 $('portionAmount').addEventListener('input',mark);mark()};
$('portionFav').onclick=async()=>{if(!portionFood)return;const cur=state.foods.find(x=>x.id===portionFood.id)||portionFood;const copy={...cur,favorite:!cur.favorite};state.foods=state.foods.filter(x=>x.id!==copy.id);state.foods.push(copy);if(!await save())return;$('portionFav').setAttribute('aria-pressed',String(copy.favorite));if($('catalogDialog').open)renderCatalog();toast(copy.favorite?'Guardado nos favoritos':'Removido dos favoritos')};
// copiar refeição de outro dia
function copyList(){return state.meals.filter(m=>m.day===$('copyDay').value&&m.category===Number($('copyCat').value))}
function copyPreview(){const l=copyList();$('copyGo').disabled=!l.length;$('copyPreview').textContent=l.length?l.length+(l.length===1?' alimento':' alimentos')+' · '+nfmt(Math.round(mealTotal(l).kcal))+' kcal: '+l.map(m=>displayName(m.food)).join(', '):'Nada registrado nessa refeição nesse dia.'}
$('repeatMeal').onclick=()=>{const d=parseDay(mealContextDay);d.setDate(d.getDate()-1);$('copyDay').max=dayKey();$('copyDay').value=dayKey(d);$('copyCat').replaceChildren(...state.prefs.mealNames.map((n,i)=>{const o=el('option',n);o.value=i;return o}));$('copyCat').value=mealCategory;$('copyTarget').textContent='Vai para: '+state.prefs.mealNames[mealCategory]+' de '+dayLabel(mealContextDay).toLowerCase();copyPreview();openDialog('copyDialog')};
$('copyDay').onchange=copyPreview;$('copyCat').onchange=copyPreview;
$('copyForm').onsubmit=async e=>{e.preventDefault();const l=copyList();if(!l.length)return;state.meals.push(...l.map(m=>({...JSON.parse(JSON.stringify(m)),id:id(),day:mealContextDay,category:mealCategory})));if(!await save())return;$('copyDialog').close();render();renderMeal();toast(l.length+(l.length===1?' alimento copiado':' alimentos copiados'))};
// só calorias
$('kcalOnly').onclick=()=>{$('kcalName').value='';$('kcalValue').value='';openDialog('kcalDialog');setTimeout(()=>$('kcalValue').focus(),60)};
$('kcalForm').onsubmit=e=>{e.preventDefault();const k=Math.round(Number($('kcalValue').value));if(!(k>=1&&k<=10000))return;const name=($('kcalName').value.trim()||'Refeição rápida').slice(0,40);const food={id:'kcal-'+id(),name,base:'portion',portion:'1 porção',favorite:false,source:'Só calorias',kcal:k,carbs:0,protein:0,fat:0,fiber:0};if(!validFood(food))return;basket.push({id:id(),day:mealContextDay,category:mealCategory,food,amount:1});renderBasket();$('kcalDialog').close();toast('Adicionado à seleção. Toque em Salvar para registrar.')};
// pratos
let pendingDish=[];
function openDish(items){pendingDish=items.map(m=>({food:JSON.parse(JSON.stringify(m.food)),amount:m.amount}));$('dishName').value='';$('dishError').textContent='';$('dishItems').textContent=pendingDish.map(it=>displayName(it.food)+' ('+nfmt(it.amount)+(it.food.base==='100g'?' g':' porç.')+')').join(', ');openDialog('dishDialog');setTimeout(()=>$('dishName').focus(),60)}
$('saveDish').onclick=()=>{if(basket.length<2)return;openDish(basket)};
$('mealSaveDish').onclick=()=>{const l=dayMeals(mealContextDay).filter(m=>m.category===mealCategory);if(!l.length){toast('Registre algum alimento nesta refeição antes.');return}openDish(l)};
$('dishForm').onsubmit=async e=>{e.preventDefault();const name=$('dishName').value.trim();if(!name){$('dishError').textContent='Dê um nome ao prato.';return}if(pendingDish.length>30){$('dishError').textContent='Um prato pode ter até 30 alimentos.';return}if(state.dishes.length>=300){$('dishError').textContent='Limite de 300 pratos atingido.';return}
 const d={id:id(),name:name.slice(0,40),items:pendingDish};if(!validDish(d)){$('dishError').textContent='Não consegui salvar esse prato.';return}state.dishes.push(d);if(!await save())return;$('dishDialog').close();if($('catalogDialog').open)renderCatalog();toast('Prato salvo. Ele aparece em Pratos e na busca.')};
})();
