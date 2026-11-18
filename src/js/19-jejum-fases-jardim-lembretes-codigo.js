/* ===== v19: jejum personalizado, sequência, fases, jardim, semana, proteína, lembretes, código de barras ===== */
/* ---------- duração ---------- */
let durSel='16';
const DUR_PRESETS=['12','14','16','18','20','24'];
function durSync(h,custom){
 durSel=custom||!DUR_PRESETS.includes(String(h))?'custom':String(h);
 document.querySelectorAll('#durChips button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.h===durSel)));
 $('durCustom').hidden=durSel!=='custom';
 if(durSel==='custom'){const H=Math.floor(h+1e-9),M=Math.round((h-H)*60);$('durH').value=H;$('durM').value=String(M-M%5)}
 durNote()}
function durValue(){if(durSel==='custom'){const H=parseInt($('durH').value,10),M=parseInt($('durM').value,10)||0;return Number.isFinite(H)?H+M/60:NaN}return Number(durSel)}
function durNote(){const h=durValue();$('durError').textContent='';
 $('durNote').textContent=Number.isFinite(h)&&h>24?'Jejuns de mais de 24 horas pedem cuidado. Converse antes com um profissional de saúde.':durSel==='custom'?'Jejum personalizado: conta na sequência quando passa de 12 horas.':'Conta na sequência quando você chega na meta.'}
async function saveDuration(){const h=durValue(),custom=durSel==='custom';
 if(!okHours(h)){$('durError').textContent='Escolha entre 1 e 72 horas.';return}
 state.hours=h;state.fastCustom=custom;if(state.active){state.active.hours=h;state.active.custom=custom}
 if(!await save())return;$('durationDialog').close();render();toast('Duração: '+hLabel(h)+(custom?', personalizado':''))}

/* ---------- sequência ---------- */
function qualifies(r){const d=r.end-r.start;return r.custom===true?d>=12*HOUR:d>=r.hours*HOUR-1000}
function streakInfo(){
 const days=new Set(state.records.filter(qualifies).map(r=>dayKey(r.end)));
 const d=new Date();d.setHours(12,0,0,0);const todayDone=days.has(dayKey(d));if(!todayDone)d.setDate(d.getDate()-1);
 let n=0,lastGap=-99,prevMissing=false;
 for(let step=0;step<3000;step++){const k=dayKey(d);
  if(days.has(k)){n++;prevMissing=false}
  else{if(n===0||prevMissing||step-lastGap<7)break;lastGap=step;prevMissing=true}
  d.setDate(d.getDate()-1)}
 return {n,todayDone,days}}
function celebrateStreak(before){const after=streakInfo().n,M=[3,7,14,21,30,50,75,100,150,200,365];const hit=M.filter(m=>before<m&&after>=m).pop();
 if(hit)setTimeout(()=>{window.tataParty?.(hit+' dias seguidos! Que orgulho de você.');toast('Sequência de '+hit+' dias')},700);
 else if(after>before)setTimeout(()=>window.tataSay?.('Sequência: '+after+(after===1?' dia.':' dias.'),4000),900)}
function renderStreak(){const {n,todayDone}=streakInfo();
 $('streakChip').hidden=!n;$('streakChip').textContent=n+(n===1?' dia seguido':' dias seguidos');
 $('homeStreak').hidden=!n;$('homeStreak').textContent='Sequência de '+n+(n===1?' dia':' dias')+(todayDone?'. Hoje já conta.':'. Hoje ainda dá tempo.')}

/* ---------- fases ---------- */
const PHASES=[
 {h:0,name:'Digerindo',line:'Ainda digerindo a última refeição.',text:'O corpo usa a energia da última refeição.'},
 {h:4,name:'Equilibrando',line:'O açúcar no sangue está assentando.',text:'Glicose e insulina tendem a voltar ao nível de base.'},
 {h:8,name:'Usando reservas',line:'Agora uso as reservas guardadas.',text:'O fígado libera o glicogênio armazenado para manter a energia.'},
 {h:12,name:'Troca de combustível',line:'Começando a trocar de combustível.',text:'Em muitas pessoas, o uso de gordura como energia começa a crescer por volta das 12 horas. Essa troca pode acontecer entre 12 e 36 horas, conforme as reservas de cada um.'},
 {h:16,name:'Mais gordura',line:'Gordura virando energia, devagarinho.',text:'A produção de corpos cetônicos tende a subir aos poucos.'},
 {h:18,name:'Jejum longo',line:'Jejum longo. Beba água e se escute.',text:'Os efeitos variam muito de pessoa para pessoa. Beba água e encerre se não se sentir bem.'}];
function phaseIdx(h){let i=0;PHASES.forEach((p,k)=>{if(h>=p.h)i=k});return i}
let lastPhase=-1,psMax=0;
function renderPhase(){const a=state.active,strip=$('phaseStrip'),sc=$('tscene');
 if(!a||a.start>Date.now()){strip.hidden=true;sc.dataset.phase='';lastPhase=-1;return}
 const h=(Date.now()-a.start)/HOUR,idx=phaseIdx(h),max=Math.max(24,a.hours);
 if(max!==psMax){psMax=max;const t=$('psTrack');t.replaceChildren();PHASES.forEach((p,k)=>{const end=k<PHASES.length-1?PHASES[k+1].h:max,seg=el('span',undefined,'seg');seg.style.flexGrow=end-p.h;seg.dataset.a=p.h;seg.dataset.b=end;seg.append(el('i'));t.append(seg)});t.append(el('span',undefined,'goal'))}
 $('psTrack').querySelectorAll('.seg').forEach(s=>{const A=+s.dataset.a,B=+s.dataset.b;s.firstChild.style.transform='scaleX('+Math.max(0,Math.min(1,(h-A)/(B-A))).toFixed(4)+')'});
 $('psTrack').querySelector('.goal').style.left='calc('+(Math.min(a.hours,max)/max*100).toFixed(2)+'% - 1.5px)';
 strip.hidden=false;sc.dataset.phase=String(idx);
 $('psName').textContent='Fase '+(idx+1)+' de 6 · '+PHASES[idx].name;
 $('psNext').textContent=idx<PHASES.length-1?'próxima em '+duration((PHASES[idx+1].h-h)*HOUR):'fase final';
 strip.setAttribute('aria-label','Fase do jejum: '+PHASES[idx].name+'. Toque para ver todas as fases.');
 if(idx!==lastPhase){const first=lastPhase===-1;lastPhase=idx;setTimeout(()=>{if(!window.tataBusy?.())window.tataSay?.(PHASES[idx].line,6000)},first?1200:60)}}
function openPhases(){const a=state.active,h=a?(Date.now()-a.start)/HOUR:-1,cur=a?phaseIdx(h):-1;$('phaseList').replaceChildren(...PHASES.map((p,k)=>{const li=el('li',undefined,k===cur?'now':''),end=k<PHASES.length-1?PHASES[k+1].h+'h':'';li.append(el('small',end?p.h+'h a '+end:'A partir de '+p.h+'h'),el('b',p.name+(k===cur?' · agora':'')),el('p',p.text));return li}));openDialog('phaseDialog')}

/* ---------- jardim ---------- */
let histView='garden';try{histView=localStorage.getItem('intervalo-histview')||'garden'}catch{}
const G_ICON={
 soil:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="18.5" rx="6.5" ry="2.2" fill="#a9845a" opacity=".55"/></svg>',
 sprout:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="18.5" rx="6.5" ry="2.2" fill="#a9845a" opacity=".55"/><path d="M12 18.5V11" stroke="#4f9d55" stroke-width="2" stroke-linecap="round"/><path d="M12 13.5C9 13.5 7.2 11.6 7.2 9.4 9.9 9.4 12 11 12 13.5ZM12 12.3C15 12.3 16.8 10.4 16.8 8.2 14.1 8.2 12 9.8 12 12.3Z" fill="#7cc36a"/></svg>',
 flower:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="19" rx="6.5" ry="2.2" fill="#a9845a" opacity=".55"/><path d="M12 19V10" stroke="#4f9d55" stroke-width="2" stroke-linecap="round"/><path d="M12 15.5C9.4 15.5 7.8 13.9 7.8 12 10.2 12 12 13.4 12 15.5Z" fill="#7cc36a"/><g fill="#ef7aa0"><circle cx="12" cy="4.6" r="2.4"/><circle cx="15.2" cy="7" r="2.4"/><circle cx="14" cy="10.6" r="2.4"/><circle cx="10" cy="10.6" r="2.4"/><circle cx="8.8" cy="7" r="2.4"/></g><circle cx="12" cy="7.8" r="2" fill="#ffd24d"/></svg>'};
function renderGarden(){const panel=document.querySelector('.calendar-panel');if(!panel)return;panel.classList.toggle('garden-mode',histView==='garden');
 document.querySelectorAll('#histView button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===histView)));if(histView!=='garden')return;
 const g=$('garden');g.replaceChildren();for(const l of ['D','S','T','Q','Q','S','S'])g.append(el('span',l,'wd'));
 const today=new Date();today.setHours(12,0,0,0);const tk=dayKey(today),startD=new Date(today);startD.setDate(startD.getDate()-startD.getDay()-49);
 const ended=new Map();for(const r of state.records){const k=dayKey(r.end),x=ended.get(k)||{any:false,ok:false};x.any=true;if(qualifies(r))x.ok=true;ended.set(k,x)}
 const water=new Map();for(const w of state.water){const k=dayKey(w.time);water.set(k,(water.get(k)||0)+w.ml)}
 const wg=state.waterGoal||0,activeDay=state.active?dayKey(state.active.start):'';
 for(let i=0;i<56;i++){const d=new Date(startD);d.setDate(startD.getDate()+i);const k=dayKey(d),fut=k>tk,b=el('button',undefined,'g-day'+(k===tk?' today':''));b.type='button';b.disabled=fut;
  if(!fut){const x=ended.get(k),kind=x?.ok?'flower':x?.any||k===activeDay?'sprout':'soil';b.innerHTML=G_ICON[kind];const wet=wg>0&&(water.get(k)||0)>=wg;if(wet)b.append(el('span',undefined,'gd'));
   b.setAttribute('aria-label',dayLabel(k)+', '+({flower:'jejum que conta na sequência',sprout:'jejum feito',soil:'sem jejum'})[kind]+(wet?', meta de água batida':''));b.setAttribute('aria-pressed',String(k===selectedDay));
   b.onclick=()=>{selectedDay=k;renderHistory();document.querySelector('.day-details')?.scrollIntoView?.({block:'nearest',behavior:'smooth'})}}
  g.append(b)}}

/* ---------- semana ---------- */
let wkOff=0;
function renderWeek(){const s0=new Date();s0.setHours(12,0,0,0);s0.setDate(s0.getDate()-s0.getDay()+wkOff*7);const days=[];for(let i=0;i<7;i++){const d=new Date(s0);d.setDate(s0.getDate()+i);days.push(dayKey(d))}
 const tk=dayKey(),past=days.filter(k=>k<=tk),fmt=k=>parseDay(k).toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','');
 $('wkNext').disabled=wkOff>=0;$('wkRange').textContent=(wkOff===0?'Esta semana · ':wkOff===-1?'Semana passada · ':'')+fmt(days[0])+' a '+fmt(days[6]);
 const recs=state.records.filter(r=>days.includes(dayKey(r.end))),hours=days.map(k=>Math.min(30,recs.filter(r=>dayKey(r.end)===k).reduce((t,r)=>t+(r.end-r.start)/HOUR,0))),ok=days.map(k=>recs.some(r=>dayKey(r.end)===k&&qualifies(r)));
 const W=320,H=118,B=20,T=8,bw=26,gap=(W-7*bw)/7,maxH=Math.max(state.hours,...hours,12),Y=v=>T+(1-v/maxH)*(H-T-B);
 let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Horas de jejum por dia na semana">';
 days.forEach((k,i)=>{const x=gap/2+i*(bw+gap),v=hours[i],y=Y(v);svg+='<rect class="bar'+(ok[i]?' ok':'')+'" x="'+x.toFixed(1)+'" y="'+(v?y:H-B-3).toFixed(1)+'" width="'+bw+'" height="'+(v?H-B-y:3).toFixed(1)+'" rx="6"/><text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle"'+(k===tk?' class="today"':'')+'>'+['D','S','T','Q','Q','S','S'][i]+'</text>'});
 svg+='<line class="goal" x1="0" x2="'+W+'" y1="'+Y(state.hours).toFixed(1)+'" y2="'+Y(state.hours).toFixed(1)+'"/></svg>';$('wkChart').innerHTML=svg;
 const mealDays=past.filter(k=>dayMeals(k).length),kcal=mealDays.map(k=>mealTotal(dayMeals(k)).kcal),prot=mealDays.map(k=>mealTotal(dayMeals(k)).protein),avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
 const durs=recs.map(r=>(r.end-r.start)/HOUR),waterAvg=past.length?past.reduce((t,k)=>t+totalsFor(k),0)/past.length:NaN;
 const ws=[...state.weights].sort((a,b)=>a.day<b.day?-1:1),wIn=ws.filter(w=>w.day<=days[6]),wEnd=wIn.at(-1),wPrev=ws.filter(w=>w.day<days[0]).at(-1)||wIn.find(w=>w.day>=days[0]);
 let wTxt='—',wSub='sem registro';if(wEnd&&wPrev&&wEnd!==wPrev&&wEnd.day>=days[0]){const dlt=wEnd.kg-wPrev.kg;wTxt=(dlt>0?'+':dlt<0?'−':'')+nfmt(Math.abs(Math.round(dlt*10)/10))+' kg';wSub='agora '+nfmt(wEnd.kg)+' kg'}else if(wEnd&&wEnd.day>=days[0]){wTxt=nfmt(wEnd.kg)+' kg';wSub='um registro'}
 const tile=(label,big,sub)=>{const d=el('div');d.append(el('small',label),el('b',big));if(sub)d.append(el('span',sub));return d};
 $('wkGrid').replaceChildren(
  tile('Jejuns que contam',ok.filter(Boolean).length+' de 7',past.length<7?past.length+(past.length===1?' dia':' dias')+' até agora':''),
  tile('Média de jejum',durs.length?hLabel(Math.round(avg(durs)*12)/12):'—',durs.length?durs.length+(durs.length===1?' jejum':' jejuns'):'nenhum jejum'),
  tile('Calorias por dia',kcal.length?nfmt(Math.round(avg(kcal)))+' kcal':'—',kcal.length?'em '+kcal.length+(kcal.length===1?' dia':' dias')+' com registro':'sem refeições'),
  tile('Proteína por dia',prot.length?nfmt(Math.round(avg(prot)))+' g':'—',state.goals.protein?'referência '+state.goals.protein+' g':''),
  tile('Água por dia',Number.isFinite(waterAvg)&&waterAvg>0?nfmt(Math.round(waterAvg/10)*10)+' ml':'—',state.waterGoal?'referência '+nfmt(state.waterGoal)+' ml':''),
  tile('Peso',wTxt,wSub))}

/* ---------- proteína ---------- */
function fillProteinHint(){const box=$('proteinHint');box.replaceChildren();const w=[...state.weights].sort((a,b)=>a.day<b.day?-1:1).at(-1);
 if(!w){box.append(el('small','Registre seu peso no Histórico para ver referências de proteína pelo seu peso.'));return}
 box.append(el('b','Proteína pelo seu peso ('+nfmt(w.kg)+' kg)'));const row=el('div',undefined,'ph-chips');
 for(const gk of [.8,1.2,1.6]){const g=Math.round(w.kg*gk),b=el('button',nfmt(gk)+' g/kg · '+g+' g');b.type='button';b.onclick=()=>{$('goalProtein').value=g;toast('Proteína: '+g+' g. Toque em Salvar referências.')};row.append(b)}
 box.append(row,el('small','0,8 g/kg é a referência mínima para adultos saudáveis. Para quem está emagrecendo, fontes de saúde citam cerca de 1,2 a 1,6 g/kg para preservar os músculos. São referências gerais, não uma prescrição. Quem tem doença nos rins ou outra condição deve conversar com um profissional.'))}

/* ---------- código de barras ---------- */
function nnum(v){return v===undefined||v===null||v===''?NaN:Number(v)}
function offExtras(f,p){const n=p.nutriments||{},br=String(p.brands||'').split(',')[0].trim().slice(0,30);if(br)f.brand=br;
 const sg=nnum(n.sugars_100g),sf=nnum(n['saturated-fat_100g']);let na=nnum(n.sodium_100g);if(Number.isFinite(na))na*=1000;else{const salt=nnum(n.salt_100g);if(Number.isFinite(salt))na=salt/2.5*1000}
 if(Number.isFinite(sg)&&sg>=0&&sg<=1000)f.sugars=Math.round(sg*10)/10;if(Number.isFinite(sf)&&sf>=0&&sf<=1000)f.satfat=Math.round(sf*10)/10;if(Number.isFinite(na)&&na>=0&&na<=100000)f.sodium=Math.round(na);
 const sq=nnum(p.serving_quantity);if(f.base==='100g'&&Number.isFinite(sq)&&sq>0&&sq<=5000){f.servingG=Math.round(sq*10)/10;const sl=String(p.serving_size||'').trim().slice(0,40);if(sl)f.servingLabel=sl}}
function offDraft(p,code){const n=p.nutriments||{};let pn=p.product_name_pt||p.product_name||'';if(pn&&typeof pn==='object')pn=pn.pt||pn.main||'';
 const f={id:'off-'+code,name:String(pn).trim().slice(0,60),base:'100g',portion:'',favorite:false,source:'Open Food Facts',barcode:String(code)};
 if(['ml','l','cl'].includes(String(p.product_quantity_unit).toLowerCase())){f.base='portion';f.portion='100 ml'}
 let kcal=nnum(n['energy-kcal_100g']);if(!Number.isFinite(kcal)){const kj=nnum(n['energy_100g']??n['energy-kj_100g']);if(Number.isFinite(kj))kcal=Math.round(kj/4.184)}
 const vals={kcal,carbs:nnum(n.carbohydrates_100g),protein:nnum(n.proteins_100g),fat:nnum(n.fat_100g)},missing=[];
 for(const [k,v] of Object.entries(vals)){if(Number.isFinite(v)&&v>=0)f[k]=Math.round(v*10)/10;else missing.push(k)}
 const fb=nnum(n.fiber_100g);const fiberMissing=!(Number.isFinite(fb)&&fb>=0);f.fiber=fiberMissing?0:Math.round(fb*10)/10;
 if(!f.name)missing.push('name');offExtras(f,p);return {food:f,missing,fiberMissing}}
async function fetchProduct(code){const key='prod:'+code;if(foodCache.has(key))return foodCache.get(key);const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),12000);
 try{const r=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?fields=code,product_name,product_name_pt,brands,nutriments,serving_size,serving_quantity,product_quantity_unit',{signal:ctrl.signal});
  if(r.status===404){foodCache.set(key,null);return null}if(!r.ok)throw Error('http '+r.status);const d=await r.json();const p=d&&d.status!==0&&d.product?d.product:null;foodCache.set(key,p);return p}finally{clearTimeout(t)}}
const MISS_LABEL={kcal:'calorias',carbs:'carboidratos',protein:'proteínas',fat:'gorduras',name:'nome'};
async function storeFood(food){const same=state.foods.find(x=>x.barcode&&normalizeCode(x.barcode)===normalizeCode(food.barcode));const f=same?{...food,id:same.id,favorite:same.favorite}:{...food};if(!validFood(f))return null;state.foods=state.foods.filter(x=>x.id!==f.id);state.foods.push(f);if(!await save())return null;return f}
function openPrefilled(food,missing){$('scanDialog').close();openFood(null);$('foodName').value=food.name||'';$('foodBarcode').value=food.barcode||'';$('foodBase').value=food.base;$('foodPortion').value=food.portion||'';
 for(const k of nutrientKeys){const inp=$('food'+fieldSuffix[k]);inp.value=missing.includes(k)?'':food[k]??'';inp.classList.toggle('missing',missing.includes(k))}
 $('foodName').classList.toggle('missing',missing.includes('name'));
 $('foodSugars').value=food.sugars??'';$('foodSatfat').value=food.satfat??'';$('foodSodium').value=food.sodium??'';$('foodServingG').value=food.servingG??'';$('foodBrand').value=food.brand||'';
 $('foodMore').open=food.sugars!=null||food.sodium!=null||food.servingG!=null;
 updateBase();$('foodError').textContent=missing.length?'Complete pelo rótulo: '+missing.map(k=>MISS_LABEL[k]).join(', ')+'.':''}
let lookupGen=0;
async function autoLookup(code){const box=$('scanProduct'),gen=++lookupGen;$('scanStaticActions').hidden=true;box.replaceChildren(el('p','Buscando o produto…','helper'));$('scanStatus').textContent='Código lido. Buscando o produto…';
 const acts=()=>el('div',undefined,'prod-actions'),btn=(t,cls,fn)=>{const b=el('button',t,cls);b.type='button';b.onclick=fn;return b};
 const manual=msg=>{box.replaceChildren(el('p',msg,'helper'));const a=acts();a.append(btn('Cadastrar pelo rótulo','primary',()=>{$('scanDialog').close();openFood(null);$('foodBarcode').value=code}));box.append(a);$('scanStatus').textContent=''};
 if(navigator.onLine===false){manual('Sem internet agora. Cadastre pelo rótulo: o código já vai preenchido.');return}
 let p;try{p=await fetchProduct(code)}catch(e){if(gen!==lookupGen)return;manual('Não consegui consultar a base agora. Cadastre pelo rótulo ou tente de novo mais tarde.');return}
 if(gen!==lookupGen||!$('scanDialog').open)return;
 if(!p){manual('Esse código não está na base do Open Food Facts. Cadastre pelo rótulo uma vez e ele fica salvo no aparelho.');return}
 const {food,missing,fiberMissing}=offDraft(p,code);$('scanStatus').textContent='';
 const card=el('div',undefined,'prod-card');card.append(el('h3',food.name||'Produto sem nome'));if(food.brand)card.append(el('p',food.brand,'brand'));
 if(missing.length){card.append(el('p','Encontramos o produto, mas faltam na base: '+missing.map(k=>MISS_LABEL[k]).join(', ')+'. Complete pelo rótulo, leva um minuto.','prod-warn'));const a=acts();a.append(btn('Completar pelo rótulo','primary',()=>openPrefilled(food,missing)));card.append(a);box.replaceChildren(card);$('scanResult').scrollIntoView?.({block:'start',behavior:'smooth'});return}
 const per=food.base==='100g'?'por 100 g':'por 100 ml';const kc=el('div',undefined,'prod-kcal');kc.append(nfmt(food.kcal),el('small','kcal '+per));card.append(kc);
 const mac=el('div',undefined,'prod-macros');for(const [k,l] of [['carbs','Carboidratos'],['protein','Proteínas'],['fat','Gorduras']]){const d=el('div');d.append(el('b',nfmt(food[k])+' g'),el('small',l));mac.append(d)}card.append(mac);
 const ex=[fiberMissing?'Fibras: não informadas (conta 0)':'Fibras '+nfmt(food.fiber)+' g'];if(food.sugars!=null)ex.push('Açúcares '+nfmt(food.sugars)+' g');if(food.satfat!=null)ex.push('Gord. sat. '+nfmt(food.satfat)+' g');if(food.sodium!=null)ex.push('Sódio '+nfmt(food.sodium)+' mg');if(food.servingG)ex.push('Porção do rótulo: '+(food.servingLabel||nfmt(food.servingG)+' g'));
 card.append(el('p',ex.join(' · '),'prod-extra'),el('p','Dados do Open Food Facts, enviados por pessoas. Confira com o rótulo.','prod-extra'));
 const a=acts();a.append(btn(catalogForMeal?'Adicionar à refeição':'Salvar no catálogo','primary',async()=>{const f=await storeFood(food);if(!f){toast('Não consegui salvar esse produto. Revise os valores.');openPrefilled(food,[]);return}$('scanDialog').close();if(catalogForMeal)openPortion(f);else{renderCatalog();toast('Produto salvo. Ele funciona offline nas próximas leituras.')}}),btn('Revisar valores','secondary',()=>openPrefilled(food,[])));card.append(a);box.replaceChildren(card);$('scanResult').scrollIntoView?.({block:'start',behavior:'smooth'})}
function readFoodExtras(f,old){const v=id=>{const x=$(id).value;return x===''?undefined:Number(x)};const sg=v('foodSugars'),sf=v('foodSatfat'),na=v('foodSodium'),sv=v('foodServingG'),br=$('foodBrand').value.trim()||old?.brand;
 if(sg!==undefined)f.sugars=sg;if(sf!==undefined)f.satfat=sf;if(na!==undefined)f.sodium=Math.round(na);if(sv!==undefined&&f.base==='100g'){f.servingG=sv;f.servingLabel=old?.servingG===sv&&old?.servingLabel?old.servingLabel:nfmt(sv)+' g'}if(br)f.brand=br.slice(0,40)}
function portionExtra(){const f=portionFood,a=Number($('portionAmount').value);if(!f||!(a>0)){$('portionExtra').textContent='';return}const k=a/(f.base==='100g'?100:1),parts=[];
 if(f.sugars!=null)parts.push('Açúcares '+nfmt(Math.round(f.sugars*k*10)/10)+' g');if(f.satfat!=null)parts.push('Gord. sat. '+nfmt(Math.round(f.satfat*k*10)/10)+' g');if(f.sodium!=null)parts.push('Sódio '+nfmt(Math.round(f.sodium*k))+' mg');$('portionExtra').textContent=parts.join(' · ')}

/* ---------- lembretes ---------- */
const REM={timers:[],sig:'',t:0,
 ln(){return window.Capacitor?.isNativePlatform?.()&&window.Capacitor.Plugins?.LocalNotifications||null},
 plan(){const out=[],now=Date.now(),r=state.reminders||defaultReminders();
  if(r.fastEnd&&state.active){const at=state.active.start+state.active.hours*HOUR;if(at>now+30000)out.push({id:1001,at,title:'Seu jejum chegou na meta',body:'A Tata já está saindo do casco. Encerre quando quiser.'})}
  if(r.fastStart&&state.plan&&!state.active){const [ph,pm]=state.plan.start.split(':').map(Number);for(let d=0;d<8;d++){const t=new Date(now);t.setDate(t.getDate()+d);t.setHours(ph,pm,0,0);if(t.getTime()>now+30000&&state.plan.days.includes(t.getDay())){out.push({id:1002,at:t.getTime(),title:'Hora do seu jejum',body:'Seu plano começa agora. Toque para iniciar.'});break}}}
  if(r.water){const [fh,fm]=r.from.split(':').map(Number),[th,tm]=r.to.split(':').map(Number),F=fh*60+fm,T=th*60+tm,goal=state.waterGoal||0;
   for(let d=0;d<3;d++){const day=new Date(now);day.setDate(day.getDate()+d);const k=dayKey(day);if(d===0&&goal>0&&totalsFor(k)>=goal)continue;let slot=0;
    for(let m=F;m<=T;m+=r.every*60){const t=new Date(day);t.setHours(Math.floor(m/60),m%60,0,0);if(t.getTime()>now+60000)out.push({id:2000+d*30+slot,at:t.getTime(),title:'Hora de um copo d’água',body:goal?'Sua referência de hoje é '+nfmt(goal)+' ml.':'Um copo agora já ajuda.'});slot++}}}
  return out.slice(0,60)},
 async sync(force){const list=this.plan(),sig=JSON.stringify(list.map(x=>[x.id,x.at]));if(!force&&sig===this.sig)return;this.sig=sig;const LN=this.ln();
  if(LN){try{const p=await LN.getPending();if(p?.notifications?.length)await LN.cancel({notifications:p.notifications.map(n=>({id:n.id}))});if(list.length)await LN.schedule({notifications:list.map(x=>({id:x.id,title:x.title,body:x.body,schedule:{at:new Date(x.at),allowWhileIdle:true},smallIcon:'ic_stat_tata',iconColor:'#2D7A4F'}))})}catch(e){this.sig='';$('remindStatus').textContent='Não consegui agendar os lembretes. Confira a permissão de notificações do Intervalo nas configurações do Android.'}}
  else{this.timers.forEach(clearTimeout);this.timers=[];for(const x of list){const ms=x.at-Date.now();if(ms>0&&ms<2147483647)this.timers.push(setTimeout(()=>this.fire(x),ms))}}},
 fire(x){toast(x.title);window.tataSay?.(x.body,6000);try{if('Notification'in window&&Notification.permission==='granted'){const show=()=>{try{new Notification(x.title,{body:x.body,tag:'intervalo-'+x.id})}catch{}};navigator.serviceWorker?.getRegistration?navigator.serviceWorker.getRegistration().then(reg=>reg?reg.showNotification(x.title,{body:x.body,icon:'icon-192.png',tag:'intervalo-'+x.id}):show()).catch(show):show()}}catch{}},
 async permit(){const LN=this.ln();if(LN){try{let p=await LN.checkPermissions();if(p.display!=='granted')p=await LN.requestPermissions();return p.display==='granted'}catch{return false}}
  try{if('Notification'in window&&Notification.permission==='default')await Notification.requestPermission()}catch{}return true}};
function scheduleReminders(){clearTimeout(REM.t);REM.t=setTimeout(()=>REM.sync(),400)}
function remindUI(){const r=state.reminders||defaultReminders();$('rFastEnd').checked=r.fastEnd;$('rFastStart').checked=r.fastStart;$('rWater').checked=r.water;$('rEvery').value=String(r.every);$('rFrom').value=r.from;$('rTo').value=r.to;$('rWaterOpts').hidden=!r.water;
 $('remindInfo').textContent=REM.ln()?'Os avisos chegam mesmo com o app fechado.':'Neste navegador, os avisos só aparecem com o app aberto. No app instalado pelo APK, eles chegam mesmo com o app fechado.'}

/* ---------- ligações ---------- */
(()=>{
 // duração
 const minSel=$('durM');for(let m=0;m<60;m+=5){const o=el('option',String(m).padStart(2,'0')+' min');o.value=String(m);minSel.append(o)}
 const _cd=$('changeDuration').onclick;$('changeDuration').onclick=()=>{_cd();durSync(state.active?.hours??state.hours,state.active?state.active.custom===true:state.fastCustom===true)};
 $('durChips').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.h==='custom'){const cur=durValue();durSel='custom';document.querySelectorAll('#durChips button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('durCustom').hidden=false;const h=Number.isFinite(cur)?cur:state.hours;$('durH').value=Math.floor(h);$('durM').value=String(Math.round((h-Math.floor(h))*60)-Math.round((h-Math.floor(h))*60)%5);durNote();setTimeout(()=>$('durH').focus(),40)}else durSync(Number(b.dataset.h),false)};
 $('durH').oninput=durNote;$('durM').onchange=durNote;
 // fases
 $('phaseStrip').onclick=openPhases;
 const _rt=renderTimer;renderTimer=function(){_rt.apply(this,arguments);renderPhase()};
 // jardim e semana
 document.querySelectorAll('#histView button').forEach(b=>b.onclick=()=>{histView=b.dataset.v;try{localStorage.setItem('intervalo-histview',histView)}catch{}renderGarden()});
 $('wkPrev').onclick=()=>{wkOff--;renderWeek()};$('wkNext').onclick=()=>{if(wkOff<0){wkOff++;renderWeek()}};
 const _rh=renderHistory;renderHistory=function(){_rh.apply(this,arguments);renderGarden();renderWeek()};
 // proteína (toda abertura das referências)
 const _od=openDialog;openDialog=function(id){if(id==='goalsDialog')fillProteinHint();_od(id)};
 // cadastro: campos extras
 const _of=openFood;openFood=function(f){_of(f);for(const k of nutrientKeys)$('food'+fieldSuffix[k]).classList.remove('missing');$('foodName').classList.remove('missing');$('foodSugars').value=f?.sugars??'';$('foodSatfat').value=f?.satfat??'';$('foodSodium').value=f?.sodium??'';$('foodServingG').value=f?.servingG??'';$('foodBrand').value=f?.brand||'';$('foodMore').open=!!f&&(f.sugars!=null||f.satfat!=null||f.sodium!=null||f.servingG!=null)};
 document.getElementById('foodForm').addEventListener('input',e=>e.target.classList?.remove('missing'));
 // porção: porção do rótulo e extras
 const _op=openPortion;openPortion=function(food,entry=null){_op(food,entry);if(food.base==='100g'&&food.servingG){const q=$('portionQuick'),b=el('button','1 porção · '+nfmt(food.servingG)+' g');b.type='button';b.dataset.v=food.servingG;b.onclick=()=>{$('portionAmount').value=food.servingG;$('portionAmount').dispatchEvent(new Event('input'))};q.prepend(b);b.setAttribute('aria-pressed',String(Number($('portionAmount').value)===food.servingG))}portionExtra()};
 $('portionAmount').addEventListener('input',portionExtra);
 // lembretes
 const onRem=async e=>{const r={...(state.reminders||defaultReminders())},was={...r};r.fastEnd=$('rFastEnd').checked;r.fastStart=$('rFastStart').checked;r.water=$('rWater').checked;r.every=Number($('rEvery').value)||2;r.from=$('rFrom').value||'08:00';r.to=$('rTo').value||'22:00';
  $('remindStatus').textContent='';
  const turnedOn=['fastEnd','fastStart','water'].some(k=>r[k]&&!was[k]);
  if(turnedOn&&!await REM.permit()){r.fastEnd=was.fastEnd;r.fastStart=was.fastStart;r.water=was.water;$('remindStatus').textContent='O Android não liberou as notificações. Ative em Configurações, Apps, Intervalo, Notificações.'}
  if(r.from>r.to){$('remindStatus').textContent='O horário final precisa ser depois do inicial.';r.to=was.to}
  if(!validReminders(r))return;state.reminders=r;if(!await save())return;remindUI();REM.sync(true);
  if(r.fastStart&&!state.plan)$('remindStatus').textContent='Configure um plano de horários no Jejum para este lembrete funcionar.';
  else if(turnedOn&&!$('remindStatus').textContent)$('remindStatus').textContent='Lembretes ativados.'};
 for(const id of ['rFastEnd','rFastStart','rWater','rEvery','rFrom','rTo'])$(id).onchange=onRem;
 // render geral
 const _render=render;render=function(){_render.apply(this,arguments);renderStreak();remindUI();scheduleReminders()};
 renderStreak();remindUI();renderPhase();renderGarden();renderWeek();scheduleReminders();
})();
