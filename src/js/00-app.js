'use strict';
const KEY='intervalo-v1',HOUR=3600000,$=id=>document.getElementById(id),defaults=()=>({version:1,hours:12,theme:'dark',active:null,records:[],water:[],waterGoal:0,notes:{},...v3defaults()});
let state=defaults(),toastTimeout,confirmAction=null;
let committedState=defaults(),loadedRaw=null,recoveryRaw=null,recoveryBlocked=false,writerHeld=false,writerRequestPending=false,releaseWriter=null,readFailure=false;
const RECOVERY_KEY=KEY+':protected-original';
function valid(data){if(!validExtras(data)||!validV3(data))return false;if(!data||data.version!==1||!Number.isFinite(data.hours)||!okHours(data.hours)||!['light','dark','system'].includes(data.theme)||!Array.isArray(data.records)||data.records.length>10000)return false;const duration=okHours;const stamp=n=>Number.isFinite(n)&&n>0&&n<=253402300799999;const session=r=>r&&typeof r.id==='string'&&r.id.length<100&&stamp(r.start)&&duration(r.hours);return (data.active===null||session(data.active))&&data.records.every(r=>session(r)&&stamp(r.end)&&r.end>=r.start&&typeof r.note==='string'&&r.note.length<=240)&&new Set(data.records.map(r=>r.id)).size===data.records.length}
function storageWarning(text){$('storageError').textContent=text;$('storageError').hidden=false}
// Load only; a failed read never grants permission to overwrite the original.
// Tolerant load: valid items are kept; only invalid items are quarantined (never silently dropped).
const QUARANTINE_KEY=KEY+':quarantine';
function salvage(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||d.version!==1)throw Error('invalid');
 const dropped=[],arr=v=>Array.isArray(v)?v:[],isStamp=n=>Number.isFinite(n)&&n>0&&n<=253402300799999;
 const okDur=okHours;
 const okSession=r=>r&&typeof r.id==='string'&&r.id.length<100&&isStamp(r.start)&&okDur(r.hours);
 const keep=(list,test,label,max)=>{const seen=new Set(),out=[];for(const x of arr(list)){let good=false;try{good=!!test(x)&&!seen.has(x.id)}catch{}if(good&&out.length<max){seen.add(x.id);out.push(x)}else dropped.push({kind:label,item:x})}return out};
 const c={...d};
 if(!okHours(c.hours)){dropped.push({kind:'hours',item:c.hours});c.hours=16}
 if(!['light','dark','system'].includes(c.theme)){dropped.push({kind:'theme',item:c.theme});c.theme='system'}
 if(c.active!==null&&c.active!==undefined&&!okSession(c.active)){dropped.push({kind:'active',item:c.active});c.active=null}
 if(c.active===undefined)c.active=null;
 c.records=keep(c.records,r=>okSession(r)&&isStamp(r.end)&&r.end>=r.start&&typeof r.note==='string'&&r.note.length<=240,'records',10000);
 if(c.water!==undefined)c.water=keep(c.water,w=>w&&typeof w.id==='string'&&w.id.length<=100&&Number.isInteger(w.ml)&&w.ml>=1&&w.ml<=5000&&isStamp(w.time),'water',50000);
 if(c.waterGoal!==undefined&&!(Number.isInteger(c.waterGoal)&&c.waterGoal>=0&&c.waterGoal<=10000)){dropped.push({kind:'waterGoal',item:c.waterGoal});c.waterGoal=0}
 if(c.notes!==undefined){if(!c.notes||typeof c.notes!=='object'||Array.isArray(c.notes)){dropped.push({kind:'notes',item:c.notes});c.notes={}}else{const n={};for(const[k,v]of Object.entries(c.notes)){if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&validDay(k)&&typeof v==='string'&&v.length<=500&&Object.keys(n).length<10000)n[k]=v;else dropped.push({kind:'notes',item:{[k]:v}})}c.notes=n}}
 if(c.foods!==undefined)c.foods=keep(c.foods,validFood,'foods',10000);
 if(c.meals!==undefined)c.meals=keep(c.meals,m=>m&&typeof m.id==='string'&&m.id.length<100&&typeof m.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(m.day)&&validDay(m.day)&&Number.isInteger(m.category)&&m.category>=0&&m.category<4&&Number.isFinite(m.amount)&&m.amount>=.1&&m.amount<=10000&&validFood(m.food),'meals',50000);
 if(c.dishes!==undefined)c.dishes=keep(c.dishes,validDish,'dishes',300);
 if(c.weights!==undefined){const days=new Set();c.weights=keep(c.weights,w=>validWeight(w)&&!days.has(w.day)&&days.add(w.day),'weights',5000)}
 if(c.targetKg!==undefined&&c.targetKg!==null&&!(Number.isFinite(c.targetKg)&&c.targetKg>=20&&c.targetKg<=500)){dropped.push({kind:'targetKg',item:c.targetKg});c.targetKg=null}
 if(c.onboarded!==undefined&&typeof c.onboarded!=='boolean')delete c.onboarded;
 if(c.fastCustom!==undefined&&typeof c.fastCustom!=='boolean')delete c.fastCustom;
 if(c.fastOpen!==undefined&&typeof c.fastOpen!=='boolean')delete c.fastOpen;
 if(c.reminders!==undefined&&!validReminders(c.reminders)){dropped.push({kind:'reminders',item:c.reminders});delete c.reminders}
 // Settings blocks fall back to defaults when malformed.
 for(const k of['profile','goals','prefs','plan']){if(c[k]!==undefined){const probe={...c,[k]:c[k]};if(!validV3({[k]:probe[k]})){dropped.push({kind:k,item:c[k]});delete c[k]}}}
 if(!valid(c))throw Error('invalid');
 return{data:c,dropped};
}
function loadRaw(raw){
 const parsed=raw===null?defaults():JSON.parse(raw);
 if(valid(parsed))return{state:normalize(parsed),dropped:[]};
 const r=salvage(parsed);return{state:normalize(r.data),dropped:r.dropped};
}
function quarantine(raw,dropped){
 try{if(localStorage.getItem(RECOVERY_KEY)===null&&raw!==null)localStorage.setItem(RECOVERY_KEY,raw);localStorage.setItem(QUARANTINE_KEY,JSON.stringify({at:Date.now(),items:dropped}))}catch{}
}
let loadNotice='';
try{loadedRaw=localStorage.getItem(KEY);const r=loadRaw(loadedRaw);state=r.state;if(r.dropped.length){quarantine(loadedRaw,r.dropped);loadNotice=r.dropped.length+' item(ns) inválido(s) foram separados e o restante foi carregado. O original foi preservado para exportação.'}}catch(e){recoveryBlocked=true;recoveryRaw=loadedRaw;readFailure=loadedRaw===null;}
committedState=JSON.parse(JSON.stringify(state));
function refreshCommittedUI(){render();if($('catalogDialog').open)renderCatalog();if($('mealDialog').open)renderMeal();}
function rejectSave(message){state=JSON.parse(JSON.stringify(committedState));refreshCommittedUI();storageWarning(message);toast('Não salvo. '+message);return false}
function commitSave(options={}){
 if(recoveryBlocked&&!options.recover)return rejectSave('Os dados originais estão protegidos. Use as opções de recuperação.');
 try{
  const current=localStorage.getItem(KEY);
  if(current!==loadedRaw){reloadStoredData(false);toast('O diário foi atualizado em outra janela. Confira os registros e tente novamente.');return false;}
  if(!valid(state))return rejectSave('A alteração excede os limites ou contém dados inválidos. Os dados anteriores foram mantidos.');
  const candidate=JSON.stringify(state);
  if(options.recover){
   if(current!==null){const previousRecovery=localStorage.getItem(RECOVERY_KEY);if(previousRecovery!==null&&previousRecovery!==current)localStorage.setItem(RECOVERY_KEY+':'+id(),previousRecovery);localStorage.setItem(RECOVERY_KEY,current);}
  }
  localStorage.setItem(KEY,candidate);
  loadedRaw=candidate;committedState=JSON.parse(candidate);recoveryBlocked=false;readFailure=false;
  $('storageError').hidden=true;refreshStorageUI();checkClock();return true;
 }catch(e){return rejectSave('Não foi possível gravar no aparelho. Os dados anteriores foram mantidos. Tente novamente ou exporte um backup.');}
}
const id=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const number=n=>n.toLocaleString('pt-BR');
function duration(ms){const m=Math.floor(Math.max(0,ms)/60000);return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'min'}
function clock(ms){const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,'0')).join(':')}
function dateTime(t){return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(t)}
function localInput(t){const d=new Date(t);return new Date(t-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').hidden=true,4000)}
function openDialog(id){$(id).showModal()}
function confirm(text,action,label='Confirmar'){ $('confirmText').textContent=text;$('confirmAction').textContent=label;confirmAction=action;openDialog('confirmDialog') }
$('confirmAction').onclick=()=>{const action=confirmAction;confirmAction=null;$('confirmDialog').close();action?.()};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function showPage(page){document.querySelectorAll('.page').forEach(s=>s.hidden=s.id!=='page-'+page);document.querySelectorAll('[data-page]').forEach(b=>{if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});window.scrollTo(0,0);if(page==='history')renderHistory();if(page==='home')renderHome();if(page==='today')tataOnShow()}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
const media=matchMedia('(prefers-color-scheme: dark)');function theme(){document.body.classList.toggle('dark',state.theme==='dark'||state.theme==='system'&&media.matches);document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===state.theme)))}media.addEventListener('change',theme);document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=async ()=>{state.theme=b.dataset.theme;if(!await save())return;theme()});


/* ===== Botão central de adicionar ===== */
(()=>{
 const slot=()=>{const h=new Date().getHours()+new Date().getMinutes()/60;return h<10.5?0:h<15?1:h<18?3:2};
 $('fab').onclick=()=>{const c=state.prefs.cup;$('qMealSub').textContent=state.prefs.mealNames[slot()];$('qWaterSub').textContent=number(c)+' ml';$('qFastLabel').textContent=state.active?'Encerrar jejum':'Iniciar jejum';openDialog('quickDialog')};
 $('qMeal').onclick=()=>{$('quickDialog').close();prepareMeal(slot());openCatalog(true)};
 $('qWater').onclick=async()=>{$('quickDialog').close();await addWater(state.prefs.cup)};
 $('qFast').onclick=()=>{$('quickDialog').close();showPage('today');$('mainAction').click()};
})();
/* ===== Tata: mascote do cronômetro ===== */
(()=>{
const el=document.getElementById('tscene'),tata=document.getElementById('tataMain'),bubble=document.getElementById('tBubble');
const tp=document.getElementById('tataTpl').content.firstElementChild.cloneNode(true);tata.append(tp);
const rr=(a,b)=>a+Math.random()*(b-a);
function layer(host,seed,fn){let r=seed;const rnd=()=>(r=(r*9301+49297)%233280)/233280;const W=800;let g='';fn(rnd,W,s=>g+=s);
 host.innerHTML='<svg class="cn" viewBox="0 0 1600 200" preserveAspectRatio="none" fill="currentColor" aria-hidden="true"><g id="'+host.id+'-g">'+g+'</g><use href="#'+host.id+'-g" x="'+W+'"/></svg><svg class="cd" viewBox="0 0 1600 200" preserveAspectRatio="none" fill="currentColor" aria-hidden="true"><use href="#'+host.id+'-g"/><use href="#'+host.id+'-g" x="'+W+'"/></svg>'}
const trees=(count,hMin,hMax,round)=>(rnd,W,add)=>{const H=200;for(let i=0;i<count;i++){const x=(i+.5)*(W/count)+(rnd()-.5)*20,h=hMin+rnd()*(hMax-hMin),w=h*.42;
 if(round&&i%2)add('<rect x="'+(x-3)+'" y="'+(H-h*.45)+'" width="6" height="'+h*.45+'"/><ellipse cx="'+x+'" cy="'+(H-h*.62)+'" rx="'+w*.78+'" ry="'+h*.38+'"/>');
 else{const t=H-h;add('<rect x="'+(x-3)+'" y="'+(H-h*.2)+'" width="6" height="'+h*.2+'"/><path d="M'+x+' '+t+' L'+(x+w*.5)+' '+(t+h*.45)+' L'+(x+w*.28)+' '+(t+h*.45)+' L'+(x+w*.62)+' '+(t+h*.75)+' L'+(x-w*.62)+' '+(t+h*.75)+' L'+(x-w*.28)+' '+(t+h*.45)+' L'+(x-w*.5)+' '+(t+h*.45)+'Z"/>')}}};
layer(document.getElementById('lfar'),3,trees(11,90,130,false));layer(document.getElementById('lmid'),7,trees(7,120,170,true));layer(document.getElementById('lnear'),11,trees(5,150,195,false));
layer(document.getElementById('lgrass'),5,(rnd,W,add)=>{const H=200;for(let i=0;i<26;i++){const x=i*(W/26)+rnd()*20,h=60+rnd()*70;
 add('<path d="M'+x+' '+H+' Q'+(x-4)+' '+(H-h*.6)+' '+(x-9)+' '+(H-h)+' Q'+(x+2)+' '+(H-h*.55)+' '+(x+4)+' '+H+'Z"/><path d="M'+(x+6)+' '+H+' Q'+(x+8)+' '+(H-h*.7)+' '+(x+16)+' '+(H-h*.9)+' Q'+(x+10)+' '+(H-h*.5)+' '+(x+13)+' '+H+'Z"/>');
 if(i%4===1){const c=['#ffd24d','#ff8fa8','#ffffff'][i%3],fy=H-h-6;let pet='';for(const a of [0,72,144,216,288])pet+='<circle cx="'+(x+8.5+Math.cos(a*Math.PI/180)*8)+'" cy="'+(fy+Math.sin(a*Math.PI/180)*8)+'" r="6" fill="'+c+'"/>';
  add('<g class="fl"><rect x="'+(x+7)+'" y="'+fy+'" width="3" height="'+h+'" fill="#3f8a50"/>'+pet+'<circle cx="'+(x+8.5)+'" cy="'+fy+'" r="4" fill="#f59f1b"/></g>')}}});
document.getElementById('tStars').innerHTML=Array.from({length:14},()=>'<i style="left:'+rr(4,96)+'%;top:'+rr(3,40)+'%;animation-delay:'+rr(0,4)+'s"></i>').join('');
document.getElementById('tFlies').innerHTML=Array.from({length:6},()=>'<i style="left:'+rr(6,92)+'%;top:'+rr(46,80)+'%;animation-delay:'+rr(0,9)+'s;animation-duration:'+rr(7,12)+'s"></i>').join('');
document.getElementById('tLeaves').innerHTML=Array.from({length:4},(_,i)=>'<svg viewBox="0 0 20 20" aria-hidden="true" style="left:'+rr(5,90)+'%;animation-duration:'+rr(9,15)+'s;animation-delay:'+(-rr(0,12))+'s"><path d="M3 17 C2 6 10 2 18 3 C18 11 12 18 3 17Z" fill="'+['#8bc34a','#c0ca33','#ffb74d'][i%3]+'" stroke="#2f5d46" stroke-width="1.4"/></svg>').join('');

let timers=[];const later=(f,ms)=>timers.push(setTimeout(f,ms));
const flash=(cls,ms)=>{tp.classList.remove(cls);void tp.getBoundingClientRect();tp.classList.add(cls);setTimeout(()=>tp.classList.remove(cls),ms)};
const mood=m=>tp.dataset.mood=m;
const SCENE={shell:'night',emerge:'dawn',walk:'day',idle:'day'};
const LINES={shell:'Descansando. Tudo no seu tempo.',emerge:'Já está amanhecendo.',done:'Pronto! Encerre quando quiser.',walk:'Janela aberta. Eu vou devagar.',idle:'Pronta para começar?'};
let current=null,speakingUntil=0,wasDone=false;
function say(t,hold){bubble.textContent=t;bubble.classList.remove('pop');void bubble.offsetWidth;bubble.classList.add('pop');if(hold)speakingUntil=Date.now()+hold}
function setPose(s,first){
 const prev=current;current=s;timers.forEach(clearTimeout);timers=[];
 if(first)el.classList.add('notrans');
 el.dataset.scene=SCENE[s];el.dataset.moving=String(s==='walk');tp.dataset.pose=s;
 if(s==='shell')mood('sleepy');
 if(s==='emerge'){mood(first?'happy':'sleepy');if(!first){flash('wiggle',1000);later(()=>mood('yawn'),1500);later(()=>mood('happy'),3300)}}
 if(s==='walk'||s==='idle'){mood('happy');if(!first&&(prev==='shell'||prev==='emerge'))later(()=>flash('settle',700),900)}
 if(first)requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('notrans')));
}
/* chamado a cada segundo por renderTimer */
window.tataSync=function(active,elapsed,goal,reached){
 const pose=active?(reached||elapsed/goal>=.85?'emerge':'shell'):(state.records.length?'walk':'idle');
 const key=active&&reached?'done':pose;
 if(pose!==current){setPose(pose,current===null);say(LINES[key])}
 else if(key==='done'&&!wasDone){say(LINES.done)}
 wasDone=key==='done';
};
/* partículas */
const SVGS={
 heart:'<svg viewBox="0 0 24 24"><path d="M12 21C4 14 3 8 7 5.5 9.5 4 11.5 5.5 12 7c.5-1.5 2.5-3 5-1.5C21 8 20 14 12 21Z" fill="#ef5b78" stroke="#1d2b24" stroke-width="1.6" stroke-linejoin="round"/></svg>',
 spark:'<svg viewBox="0 0 24 24"><path d="M12 1 14.6 9.4 23 12 14.6 14.6 12 23 9.4 14.6 1 12 9.4 9.4Z" fill="#ffd24d" stroke="#1d2b24" stroke-width="1.4" stroke-linejoin="round"/></svg>',
 drop:'<svg viewBox="0 0 24 24"><path d="M12 2C8 9 5 12 5 16a7 7 0 0 0 14 0c0-4-3-7-7-14Z" fill="#6ec3ea" stroke="#1d2b24" stroke-width="1.6" stroke-linejoin="round"/></svg>',
 crumb:'<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3.5" fill="#6fb35f"/></svg>'};
function fx(kind,x,y,n,spread){n=n||1;spread=spread||26;for(let k=0;k<n;k++){const p=document.createElement('i');p.className='p '+(kind==='drop'?'drop':kind==='crumb'?'crumb':'');
 p.innerHTML=SVGS[kind];p.style.left=(x+rr(-spread,spread)/3.8)+'%';p.style.top=(y+rr(-3,3))+'%';p.style.setProperty('--dx',rr(-spread,spread)+'px');p.style.setProperty('--rot',rr(-40,40)+'deg');p.style.animationDelay=(k*.12)+'s';
 document.getElementById('tFx').append(p);setTimeout(()=>p.remove(),1900+k*120)}}
let busy=false;
function act(name,ms,fn){if(busy)return;busy=true;tp.classList.add('act-'+name);fn();setTimeout(()=>{tp.classList.remove('act-'+name);busy=false},ms)}
function restore(ms){later(()=>{if(Date.now()>=speakingUntil)say(LINES[wasDone?'done':current])},ms)}
function react(kind){
 if(!current)return;
 if(kind==='water'){
  if(current==='shell'){say('Água também vale no jejum.',3500);flash('shake',600);fx('drop',70,62,3);restore(3600);return}
  act('drink',2600,()=>{mood('drink');say('Glub, glub. Obrigada!',4000);fx('drop',76,76,4,20);later(()=>mood('happy'),2600);restore(4200)});
 }else if(kind==='meal'){
  if(current==='shell'){say('Registrado. Ainda estamos no jejum, tudo bem?',4000);flash('shake',600);restore(4200);return}
  if(current==='emerge'){say('Hmm, cheiro de comida.',3500);restore(3600);return}
  act('eat',2800,()=>{say('Hmm, folhinha crocante.',4500);later(()=>mood('chew'),700);later(()=>{mood('happy');fx('spark',70,50,4);fx('heart',70,46,2)},2300);fx('crumb',74,74,6,22);restore(4700)});
 }else if(kind==='pet'){
  if(current==='shell'){flash('shake',600);say('Hm? Ainda estou descansando...',3000);fx('spark',58,60,2);restore(3100);return}
  if(current==='emerge')return;
  flash('act-boop',700);mood('love');fx('heart',64,48,3);say('Hihi. Que carinho bom.',2400);
  clearTimeout(react.t);react.t=setTimeout(()=>{mood('happy');},2200);restore(2500);
 }
}
window.tataParty=function(t){if(!current)return;say(t,5500);fx('spark',50,40,9,70);fx('heart',52,46,4,40);if(current==='shell'){flash('wiggle',1000)}else{flash('act-boop',700);mood('love');later(()=>mood('happy'),2400)}};
window.tataSay=function(t,h){if(current)say(t,h||4500)};
window.tataBusy=()=>Date.now()<speakingUntil;
/* reações pedidas em outras abas ficam na fila até a Tata aparecer */
let queued=null;
window.tataReact=function(kind){if(document.getElementById('page-today')?.hidden){queued=kind;return}react(kind)};
window.tataOnShow=function(){if(queued){const k=queued;queued=null;setTimeout(()=>react(k),700)}};
el.addEventListener('click',()=>react('pet'));
el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();react('pet')}});
document.addEventListener('visibilitychange',()=>el.classList.toggle('paused',document.hidden));
})();
function renderTimer(){const a=state.active,open=a?a.open===true:state.fastOpen===true,goal=(a?.hours??state.hours)*HOUR,elapsed=a?Math.max(0,Date.now()-a.start):0,reached=!!a&&!open&&elapsed>=goal; $('status').textContent=a&&a.start>Date.now()?'Confira o horário de início':a?(open?'Intervalo em andamento':reached?'Tempo planejado concluído':'Intervalo em andamento'):'Pronto para começar';$('planChip').textContent=open?'Sem meta':hLabel(goal/HOUR)+((a?a.custom:state.fastCustom)?' · personalizado':'');$('timerLabel').textContent=a?'Tempo decorrido':open?'Jejum sem meta':'Duração planejada';$('timer').textContent=clock(a?elapsed:open?0:goal);$('remaining').textContent=a?(open?(elapsed>=12*HOUR?'Já conta na sequência':'Conta na sequência a partir de 12h'):reached?'Você pode encerrar quando quiser':clock(goal-elapsed)+' restantes'):open?'Você para quando quiser':'Tudo no seu tempo';tataSync(a,elapsed,open?Infinity:goal,reached);$('startTime').textContent=a?dateTime(a.start):'Quando você iniciar';$('endTime').textContent=a&&!open?dateTime(a.start+goal):'—';$('mainAction').querySelector('span').textContent=a?'Encerrar jejum':'Iniciar jejum';$('mainAction').querySelector('svg').style.display=a?'none':'';document.querySelector('.timer-panel').classList.toggle('active',!!a);$('editStart').textContent=a?'Editar horário de início':'Já começou? Ajustar início';}
function render(){theme();renderTimer();const h=state.active?.hours??state.hours;$('durationValue').textContent=hLabel(h);$('dayFill').style.width=Math.min(100,h/24*100)+'%';$('fastLegend').textContent=hLabel(h)+' de jejum';$('otherLegend').textContent=h<24?hLabel(24-h)+' restantes no dia':'Mais de um dia de jejum';const last=[...state.records].sort((a,b)=>b.end-a.end)[0];$('lastRecord').textContent=last?duration(last.end-last.start)+' · '+dateTime(last.end):'Seu primeiro intervalo aparece aqui quando você encerrar o cronômetro.';renderHistory();renderHome();$('todayDate').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}
$('changeDuration').onclick=()=>{$('hours').value=state.active?.hours??state.hours;openDialog('durationDialog')};
$('durationForm').onsubmit=e=>{e.preventDefault();saveDuration()};
async function start(t){state.active={id:id(),start:t,hours:state.hours,custom:state.fastCustom===true,open:state.fastOpen===true};if(!await save())return false;render();toast('Intervalo iniciado');return true}
$('mainAction').onclick=async ()=>{if(!state.active){await start(Date.now());return}$('note').value='';$('finishSummary').textContent='Tempo registrado até agora: '+duration(Date.now()-state.active.start)+'.';openDialog('finishDialog')};
$('editStart').onclick=()=>{$('startInput').value=localInput(state.active?.start??Date.now());$('startInput').max=localInput(Date.now());$('startError').textContent='';openDialog('startDialog')};
$('startForm').onsubmit=async e=>{e.preventDefault();const t=new Date($('startInput').value).getTime();if(!Number.isFinite(t)||t<=0||t>Date.now()){$('startError').textContent='Escolha um horário válido que não esteja no futuro.';return}if(state.records.some(r=>r.end>t)){$('startError').textContent='O início não pode sobrepor um intervalo já registrado.';return}if(state.active){state.active.start=t;if(!await save())return;render();toast('Início atualizado')}else if(!await start(t))return;$('startDialog').close()};
$('finishForm').onsubmit=async e=>{e.preventDefault();if(!state.active)return;const end=Date.now();if(end<state.active.start){toast('Confira o relógio do aparelho antes de salvar.');return}const sBefore=streakInfo().n;state.records.unshift({...state.active,end,note:$('note').value.trim()});state.active=null;if(!await save()){toast('Não consegui salvar. Toque em Encerrar e salvar de novo.');render();return}$('finishDialog').close();render();toast('Intervalo salvo no histórico');celebrateStreak(sBefore)};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='intervalo-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backupStatus').textContent='Backup preparado. Confira o arquivo nos downloads.'};
$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error();const data=JSON.parse(await file.text());if(!valid(data))throw Error();confirm('Substituir todos os dados, alimentos e preferências pelos dados deste backup ('+data.records.length+' intervalos)? Exporte os dados atuais antes, se quiser preservá-los.',async ()=>{state=normalize(data);if(!await save({recover:recoveryBlocked})){$('backupStatus').textContent='Backup não aplicado. Os dados anteriores foram mantidos.';return}noteDirty=false;render();$('backupStatus').textContent='Backup importado.';toast('Backup importado')},'Substituir')}catch(error){$('backupStatus').textContent='Arquivo inválido. Escolha um backup JSON exportado pelo Intervalo.'}finally{e.target.value=''}};
$('reset').onclick=()=>confirm('Apagar intervalos, refeições, água, peso, anotações e o intervalo em andamento? Esta ação não pode ser desfeita.',async ()=>{state.active=null;state.records=[];state.water=[];state.notes={};state.meals=[];state.weights=[];state.targetKg=null;if(!await save())return;noteDirty=false;render();toast('Registros apagados')},'Apagar registros');
window.addEventListener('storage',e=>{if(!saving&&(e.key===KEY||e.key===null))reloadStoredData(false)});

// Optional v2 fields keep backups from version 1 compatible.
function validExtras(d){
 if(!d||typeof d!=='object')return false;
 if(d.waterGoal!==undefined&&(!Number.isInteger(d.waterGoal)||d.waterGoal<0||d.waterGoal>10000))return false;
 if(d.water!==undefined&&(!Array.isArray(d.water)||d.water.length>50000||d.water.some(w=>!w||typeof w.id!=='string'||w.id.length>100||!Number.isInteger(w.ml)||w.ml<1||w.ml>5000||!Number.isFinite(w.time)||w.time<=0||w.time>253402300799999)||new Set(d.water.map(w=>w.id)).size!==d.water.length))return false;
 if(d.notes!==undefined&&(!d.notes||Array.isArray(d.notes)||typeof d.notes!=='object'||Object.keys(d.notes).length>10000||Object.entries(d.notes).some(([k,v])=>!/^\d{4}-\d{2}-\d{2}$/.test(k)||!validDay(k)||typeof v!=='string'||v.length>500)))return false;
 return true;
}
function normalize(d){return {...v3defaults(),version:1,hours:d.hours,theme:d.theme,active:d.active,records:d.records,water:d.water??[],waterGoal:d.waterGoal??0,notes:d.notes??{},foods:d.foods??[],meals:d.meals??[],profile:d.profile??v3defaults().profile,goals:d.goals??v3defaults().goals,prefs:d.prefs??v3defaults().prefs,plan:d.plan??null,weights:d.weights??[],dishes:d.dishes??[],fastCustom:d.fastCustom===true,fastOpen:d.fastOpen===true,reminders:d.reminders??defaultReminders(),targetKg:d.targetKg??null,onboarded:typeof d.onboarded==='boolean'?d.onboarded:!!((d.records&&d.records.length)||(d.meals&&d.meals.length)||(d.water&&d.water.length)||d.active||(d.profile&&d.profile.name))}}
function dayKey(t=Date.now()){const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function parseDay(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12)}
function validDay(k){const d=parseDay(k);return Number.isFinite(d.getTime())&&dayKey(d)===k}
function dayLabel(k){return new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric'}).format(parseDay(k))}
function el(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e}
let selectedDay=dayKey(),calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1,12),editingRecord=null,noteDay=dayKey(),noteDirty=false,lastToday=dayKey();
function totalsFor(k){return state.water.filter(w=>dayKey(w.time)===k).reduce((sum,w)=>sum+w.ml,0)}
function renderHomeTimer(){const a=state.active,h=a?.hours??state.hours,elapsed=a?Math.max(0,Date.now()-a.start):0;$('homePlan').textContent=hLabel(h);$('homeFastTitle').textContent=a?'Jejum em andamento':'Seu próximo intervalo';$('homeTimer').textContent=a?clock(elapsed):number(h)+' horas';$('homeTimerLabel').textContent=a?'Tempo decorrido':'Duração escolhida por você';$('miniRing').style.setProperty('--progress',Math.min(100,elapsed/(h*HOUR)*100)+'%');$('homeFastAction').textContent=a?'Ver meu jejum':'Abrir cronômetro';$('homeFastFooter').textContent=a?'Fim previsto: '+dateTime(a.start+h*HOUR):'Comece quando fizer sentido para sua rotina.'}
function renderHome(){
 const today=dayKey();$('homeDate').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());renderHomeTimer();$('homeTitle').textContent=state.profile.name?'Oi, '+state.profile.name:'Meu diário';
 $('weekStrip').replaceChildren();for(let i=6;i>=0;i--){const date=new Date();date.setDate(date.getDate()-i);const key=dayKey(date),b=el('button',undefined,key===today?'current':'');b.type='button';b.setAttribute('aria-label','Ver registros de '+dayLabel(key));b.append(el('span',new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(date).replace('.','')),el('strong',date.getDate()));const dot=el('i');dot.style.visibility=state.records.some(r=>dayKey(r.end)===key)||totalsFor(key)>0||state.notes[key]?'visible':'hidden';b.append(dot);b.onclick=()=>{selectedDay=key;calendarMonth=new Date(date.getFullYear(),date.getMonth(),1,12);showPage('history')};$('weekStrip').append(b)}
 const total=totalsFor(today);$('waterTotal').textContent=number(total);$('waterGoalLabel').textContent=state.waterGoal?'Referência escolhida: '+number(state.waterGoal)+' ml':'Sem referência diária definida';$('waterFill').style.width=state.waterGoal?Math.min(100,total/state.waterGoal*100)+'%':'0%';$('waterMeter').hidden=!state.waterGoal;$('waterMeter').setAttribute('aria-valuemin','0');$('waterMeter').setAttribute('aria-valuemax',state.waterGoal||1);$('waterMeter').setAttribute('aria-valuenow',Math.min(total,state.waterGoal||1));$('waterMeter').setAttribute('aria-valuetext',total+' ml registrados');renderWaterList($('waterLog'),today);
 if(noteDirty&&noteDay!==today)$('noteStatus').textContent='Rascunho de '+dayLabel(noteDay)+'. Salve para preservar essa anotação.';if(!noteDirty){noteDay=today;$('dailyNote').value=state.notes[today]??'';$('noteStatus').textContent=state.notes[today]?'Anotação salva neste aparelho.':'Só você vê estas anotações neste aparelho.'}
}
$('homeFastAction').onclick=()=>showPage('today');
async function addWater(ml){if(!Number.isInteger(ml)||ml<1||ml>5000)return false;state.water.push({id:id(),ml,time:Date.now()});if(!await save())return false;renderHome();renderHistory();toast(number(ml)+' ml registrados');tataReact('water');return true}
async function removeWater(waterId){state.water=state.water.filter(w=>w.id!==waterId);if(!await save())return;renderHome();renderHistory();toast('Lançamento de água removido')}
function renderWaterList(container,k){container.replaceChildren();const entries=state.water.filter(w=>dayKey(w.time)===k).sort((a,b)=>b.time-a.time);if(!entries.length){container.append(el('p','Nenhum registro de água neste dia.','helper'));return}for(const w of entries){const row=el('div',undefined,'water-row'),label=el('span',number(w.ml)+' ml'),time=el('small',new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(w.time)),button=el('button','Desfazer');label.append(time);button.type='button';button.setAttribute('aria-label','Desfazer '+w.ml+' ml às '+time.textContent);button.onclick=async ()=>await removeWater(w.id);row.append(label,button);container.append(row)}}
document.querySelectorAll('[data-water]').forEach(b=>b.onclick=async ()=>await addWater(Number(b.dataset.water)));
$('customWater').onclick=()=>{$('waterAmount').value='';openDialog('waterDialog')};
$('waterForm').onsubmit=async e=>{e.preventDefault();if($('waterForm').reportValidity()&&await addWater(Number($('waterAmount').value)))$('waterDialog').close()};
$('setWaterGoal').onclick=()=>{$('waterGoal').value=state.waterGoal;openDialog('goalDialog')};
$('goalForm').onsubmit=async e=>{e.preventDefault();const goal=Number($('waterGoal').value);if(!$('goalForm').reportValidity()||!Number.isInteger(goal)||goal<0||goal>10000)return;state.waterGoal=goal;if(!await save())return;renderHome();$('goalDialog').close();toast('Referência atualizada')};
$('dailyNote').oninput=()=>{noteDirty=true;$('noteStatus').textContent='Alteração ainda não salva.'};
$('saveDailyNote').onclick=async ()=>{const target=noteDay,text=$('dailyNote').value.trim().slice(0,500);if(text)state.notes[target]=text;else delete state.notes[target];if(!await save()){$('noteStatus').textContent='Não salvo. Seu texto continua no campo para tentar novamente.';return}noteDirty=false;renderHome();renderHistory();$('noteStatus').textContent='Anotação salva.';toast('Anotação salva para '+dayLabel(target))};
function renderCalendar(){
 $('monthLabel').textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(calendarMonth);$('calendar').replaceChildren();for(const label of ['D','S','T','Q','Q','S','S'])$('calendar').append(el('span',label,'weekday'));
 const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth(),first=new Date(y,m,1,12),days=new Date(y,m+1,0,12).getDate();for(let i=0;i<first.getDay();i++)$('calendar').append(el('span'));
 const today=dayKey();for(let n=1;n<=days;n++){const k=dayKey(new Date(y,m,n,12)),b=el('button',undefined,'calendar-day'+(k===today?' today':'')+(k===selectedDay?' selected':''));b.type='button';b.disabled=k>today;b.setAttribute('aria-pressed',String(k===selectedDay));const records=state.records.filter(r=>dayKey(r.end)===k);b.setAttribute('aria-label',dayLabel(k)+', '+records.length+' intervalos, '+totalsFor(k)+' ml de água'+(state.notes[k]?', com anotação':''));b.append(el('span',n));const dots=el('div',undefined,'day-dots');if(records.length)dots.append(el('i',undefined,'dot'));if(totalsFor(k))dots.append(el('i',undefined,'dot water'));if(state.notes[k])dots.append(el('i',undefined,'dot note'));b.append(dots);b.onclick=()=>{selectedDay=k;renderHistory()};$('calendar').append(b)}
 const current=new Date();$('nextMonth').disabled=y>current.getFullYear()||y===current.getFullYear()&&m>=current.getMonth();
}
$('prevMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1,12);renderCalendar()};$('nextMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1,12);renderCalendar()};
function renderHistory(){
 const all=state.records,records=all.filter(r=>dayKey(r.end)===selectedDay).sort((a,b)=>b.start-a.start);$('count').textContent=number(all.length);$('average').textContent=all.length?duration(all.reduce((sum,r)=>sum+r.end-r.start,0)/all.length):'—';renderCalendar();$('selectedDate').textContent=dayLabel(selectedDay);$('selectedSummary').textContent=records.length+' intervalo(s) encerrado(s) neste dia · '+number(totalsFor(selectedDay))+' ml de água';$('records').replaceChildren();
 if(!records.length)$('records').append(el('p','Nenhum intervalo encerrado neste dia. Você pode adicionar um registro passado.','record-empty'));
 for(const r of records){const row=el('article',undefined,'historyrow'),left=el('div'),title=el('strong','Jejum registrado'),time=el('p',dateTime(r.start)+' → '+dateTime(r.end)),note=el('p',r.note,'note-text'),right=el('div',undefined,'historyright'),total=el('strong',duration(r.end-r.start)),edit=el('button','Editar','edit'),del=el('button','Excluir','delete');edit.type=del.type='button';edit.setAttribute('aria-label','Editar intervalo de '+dateTime(r.start));del.setAttribute('aria-label','Excluir intervalo de '+dateTime(r.start));edit.onclick=()=>editRecord(r);del.onclick=()=>confirm('Excluir este intervalo?',async ()=>{state.records=state.records.filter(x=>x.id!==r.id);if(!await save())return;render();toast('Intervalo excluído')},'Excluir');left.append(title,time);if(r.note)left.append(note);right.append(total,edit,del);row.append(left,right);$('records').append(row)}
 $('selectedNote').textContent=state.notes[selectedDay]?'Anotação do dia\n'+state.notes[selectedDay]:'';renderWaterList($('selectedWater'),selectedDay);
}
function editRecord(r){editingRecord=r?.id??null;$('recordTitle').textContent=r?'Editar intervalo':'Adicionar intervalo';let startTime=new Date(parseDay(selectedDay)).setHours(0,0,0,0),end=Math.min(startTime+state.hours*HOUR,Date.now());$('recordStart').value=localInput(r?.start??startTime);$('recordEnd').value=localInput(r?.end??end);$('recordStart').max=$('recordEnd').max=localInput(Date.now());$('recordNote').value=r?.note??'';$('recordError').textContent='';openDialog('recordDialog')}
$('addRecord').onclick=()=>editRecord(null);
function recordConflict(start,end,excludeId=null){return state.records.some(r=>r.id!==excludeId&&start<r.end&&end>r.start)||(state.active&&end>state.active.start)}
$('recordForm').onsubmit=async e=>{e.preventDefault();const start=new Date($('recordStart').value).getTime(),end=new Date($('recordEnd').value).getTime();if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<=start||end>Date.now()){$('recordError').textContent='O término deve ser depois do início e não pode estar no futuro.';return}if(recordConflict(start,end,editingRecord)){$('recordError').textContent='Esse período se sobrepõe a outro intervalo. Revise os horários.';return}const existing=state.records.find(r=>r.id===editingRecord);if(editingRecord&&!existing){$('recordError').textContent='Este registro não está mais disponível. Feche e tente novamente.';return}const record={id:existing?.id??id(),start,end,hours:existing?.hours??state.hours,note:$('recordNote').value.trim().slice(0,240)};if($('recordCustom').checked)record.custom=true;state.records=state.records.filter(r=>r.id!==record.id);state.records.push(record);selectedDay=dayKey(start);calendarMonth=new Date(new Date(start).getFullYear(),new Date(start).getMonth(),1,12);if(!await save())return;$('recordDialog').close();render();toast('Intervalo salvo')};
async function tick(){if(saving)return;const today=dayKey();checkClock();if(today!==lastToday){
 if(noteDirty&&writerHeld&&!recoveryBlocked){const text=$('dailyNote').value.trim().slice(0,500);if(text)state.notes[noteDay]=text;else delete state.notes[noteDay];if(await save())noteDirty=false;}
 const previous=lastToday;lastToday=today;if(diaryFollowsToday)diaryDay=today;
 if(selectedDay===previous){selectedDay=today;calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1,12)}
 render();
 }else{renderTimer();renderHomeTimer()}}
document.addEventListener('visibilitychange',async ()=>{if(!document.hidden)await tick()});window.addEventListener('beforeunload',e=>{if(noteDirty||basket.length||saving){e.preventDefault();e.returnValue=''}});

function v3defaults(){return {foods:[],meals:[],profile:{name:'',diet:'none'},goals:{kcal:null,carbs:null,protein:null,fat:null,fiber:null},prefs:{showWater:true,showNote:true,cup:250,mealNames:['Café da manhã','Almoço','Jantar','Lanches'],order:['nutrition','meals','water','fast','note']},plan:null}}
function validFoodExtras(f){const ok=(v,max)=>v===undefined||v===null||Number.isFinite(v)&&v>=0&&v<=max;return ok(f.sugars,1000)&&ok(f.satfat,1000)&&ok(f.sodium,100000)&&ok(f.servingG,5000)&&(f.servingLabel===undefined||typeof f.servingLabel==='string'&&f.servingLabel.length<=40)&&(f.brand===undefined||typeof f.brand==='string'&&f.brand.length<=40)}
function validFood(f){return f&&typeof f.id==='string'&&f.id.length<100&&typeof f.name==='string'&&f.name.trim().length>0&&f.name.length<=60&&['100g','portion'].includes(f.base)&&typeof f.portion==='string'&&f.portion.length<=30&&typeof f.favorite==='boolean'&&['kcal','carbs','protein','fat','fiber'].every(k=>Number.isFinite(f[k])&&f[k]>=0&&f[k]<=(k==='kcal'?10000:1000))&&validFoodExtras(f)}
function okHours(n){return Number.isFinite(n)&&n>=1&&n<=168&&Math.abs(n*60-Math.round(n*60))<1e-6}
function validWeight(w){return w&&typeof w.id==='string'&&w.id.length<100&&typeof w.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(w.day)&&validDay(w.day)&&Number.isFinite(w.kg)&&w.kg>=20&&w.kg<=500&&(w.waist===null||w.waist===undefined||Number.isFinite(w.waist)&&w.waist>=20&&w.waist<=300)}
function defaultReminders(){return {fastEnd:false,fastStart:false,water:false,every:2,from:'08:00',to:'22:00'}}
function validReminders(r){const t=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);return !!r&&typeof r==='object'&&['fastEnd','fastStart','water'].every(k=>typeof r[k]==='boolean')&&Number.isInteger(r.every)&&r.every>=1&&r.every<=6&&t(r.from)&&t(r.to)}
function hLabel(h){const H=Math.floor(h+1e-9),M=Math.round((h-H)*60);return M?H+'h'+String(M).padStart(2,'0'):H+'h'}
function validDish(d){return d&&typeof d.id==='string'&&d.id.length<100&&typeof d.name==='string'&&d.name.trim().length>0&&d.name.length<=40&&Array.isArray(d.items)&&d.items.length>=1&&d.items.length<=30&&d.items.every(it=>it&&validFood(it.food)&&Number.isFinite(it.amount)&&it.amount>=.1&&it.amount<=10000)}
function validV3(d){if(!d)return false;const unique=a=>new Set(a.map(x=>x.id)).size===a.length;
 if(d.dishes!==undefined&&(!Array.isArray(d.dishes)||d.dishes.length>300||!d.dishes.every(validDish)||!unique(d.dishes)))return false;
 if(d.weights!==undefined&&(!Array.isArray(d.weights)||d.weights.length>5000||!d.weights.every(validWeight)||!unique(d.weights)||new Set(d.weights.map(w=>w.day)).size!==d.weights.length))return false;
 if(d.targetKg!==undefined&&d.targetKg!==null&&!(Number.isFinite(d.targetKg)&&d.targetKg>=20&&d.targetKg<=500))return false;
 if(d.onboarded!==undefined&&typeof d.onboarded!=='boolean')return false;
 if(d.fastCustom!==undefined&&typeof d.fastCustom!=='boolean')return false;
 if(d.fastOpen!==undefined&&typeof d.fastOpen!=='boolean')return false;
 if(d.reminders!==undefined&&!validReminders(d.reminders))return false;
 if(d.foods!==undefined&&(!Array.isArray(d.foods)||d.foods.length>10000||!d.foods.every(validFood)||!unique(d.foods)))return false;
 if(d.meals!==undefined&&(!Array.isArray(d.meals)||d.meals.length>50000||!unique(d.meals)||!d.meals.every(m=>m&&typeof m.id==='string'&&m.id.length<100&&typeof m.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(m.day)&&validDay(m.day)&&Number.isInteger(m.category)&&m.category>=0&&m.category<4&&Number.isFinite(m.amount)&&m.amount>=.1&&m.amount<=10000&&validFood(m.food))))return false;
 if(d.profile!==undefined&&(!d.profile||typeof d.profile.name!=='string'||d.profile.name.length>40||!['none','varied','vegetarian','vegan'].includes(d.profile.diet)))return false;
 if(d.goals!==undefined&&(!d.goals||!['kcal','carbs','protein','fat','fiber'].every(k=>d.goals[k]===null||Number.isInteger(d.goals[k])&&d.goals[k]>0&&d.goals[k]<=(k==='kcal'?10000:1000))))return false;
 if(d.prefs!==undefined){const p=d.prefs;if(!p||typeof p.showWater!=='boolean'||typeof p.showNote!=='boolean'||!Number.isInteger(p.cup)||p.cup<1||p.cup>5000||!Array.isArray(p.mealNames)||p.mealNames.length!==4||!p.mealNames.every(n=>typeof n==='string'&&n.trim()&&n.length<=24)||!Array.isArray(p.order)||p.order.length!==5||new Set(p.order).size!==5||!p.order.every(k=>['nutrition','meals','water','fast','note'].includes(k)))return false}
 if(d.plan!==undefined&&d.plan!==null){const p=d.plan;if(!p||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start)||!Number.isFinite(p.hours)||p.hours<1||p.hours>24||p.hours*2%1||!Array.isArray(p.days)||!p.days.length||p.days.length>7||new Set(p.days).size!==p.days.length||!p.days.every(n=>Number.isInteger(n)&&n>=0&&n<7))return false}return true}
const nutrientKeys=['kcal','carbs','protein','fat','fiber'],nutrientLabels={carbs:'Carboidratos',protein:'Proteínas',fat:'Gorduras',fiber:'Fibras'},fieldSuffix={kcal:'Kcal',carbs:'Carbs',protein:'Protein',fat:'Fat',fiber:'Fiber'},mealIcons=['coffee','bowl','moon','apple'];
let diaryDay=dayKey(),diaryFollowsToday=true,mealContextDay=dayKey(),mealCategory=0,catalogForMeal=false,editingFood=null,editingEntry=null,portionFood=null,onlyFavorites=false,pendingOrder=[];
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#'+name);svg.append(use);return svg}
function nfmt(n){return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n)}
function nutrients(food,amount){const factor=amount/(food.base==='100g'?100:1);return Object.fromEntries(nutrientKeys.map(k=>[k,food[k]*factor]))}
function mealTotal(entries){const total=Object.fromEntries(nutrientKeys.map(k=>[k,0]));for(const m of entries){const n=nutrients(m.food,m.amount);nutrientKeys.forEach(k=>total[k]+=n[k])}return total}
function dayMeals(k=diaryDay){return state.meals.filter(m=>m.day===k)}
function macroText(n){return nfmt(n.kcal)+' kcal · C '+nfmt(n.carbs)+' g · P '+nfmt(n.protein)+' g · G '+nfmt(n.fat)+' g · F '+nfmt(n.fiber)+' g'}
function renderNutrition(){const totals=mealTotal(dayMeals());$('diaryDate').value=diaryDay;$('diaryDate').max=dayKey();const goal=state.goals.kcal;$('calTotal').textContent=nfmt(goal?Math.abs(goal-totals.kcal):totals.kcal);$('calLabel').textContent=goal?(totals.kcal<=goal?'kcal restantes':'kcal acima da referência'):'kcal registradas';$('energyArc').style.strokeDashoffset=603.19*(1-(goal?Math.min(totals.kcal/goal,1):0));$('energySub').textContent=goal?'Referência informada: '+number(goal)+' kcal · '+dayLabel(diaryDay):'Sem referência definida · '+dayLabel(diaryDay);$('macroGrid').replaceChildren();for(const k of nutrientKeys.slice(1)){const box=el('div',undefined,'macro');box.setAttribute('data-macro',k);const bar=el('div',undefined,'bar'),fill=el('i');fill.style.width=state.goals[k]?Math.min(100,totals[k]/state.goals[k]*100)+'%':'0%';bar.append(fill);box.append(el('span',nutrientLabels[k]),bar,el('strong',nfmt(totals[k])+' g'),el('small',state.goals[k]?'Referência: '+state.goals[k]+' g':'Sem referência'));$('macroGrid').append(box)}
 $('mealGroups').replaceChildren();for(let i=0;i<4;i++){const entries=dayMeals().filter(m=>m.category===i),n=mealTotal(entries),row=el('div',undefined,'meal-row'),image=el('div',undefined,'meal-icon'),name=el('button',undefined,'meal-name'),add=el('button',undefined,'add-circle');image.append(icon(mealIcons[i]));name.append(el('strong',state.prefs.mealNames[i]),el('small',nfmt(n.kcal)+' kcal · '+entries.length+' alimento(s)'));name.onclick=()=>openMeal(i);add.append(icon('plus'));add.setAttribute('aria-label','Adicionar em '+state.prefs.mealNames[i]);add.onclick=()=>{prepareMeal(i);openCatalog(true)};row.append(image,name,add);$('mealGroups').append(row)}
 $('profileLabel').textContent=state.profile.name||'Seu nome';document.querySelector('.profile-line strong').textContent=state.profile.name||'Seu espaço pessoal';
 const cards=[...document.querySelectorAll('[data-home-card]')];for(const key of state.prefs.order){const card=cards.find(c=>c.dataset.homeCard===key);if(card){card.style.order=state.prefs.order.indexOf(key);card.hidden=key==='water'&&!state.prefs.showWater||key==='note'&&!state.prefs.showNote}}
 $('waterCups').replaceChildren();const filled=Math.floor(totalsFor(dayKey())/state.prefs.cup);for(let i=0;i<Math.min(8,Math.max(4,filled+1));i++){const b=el('button',undefined,i<filled?'filled':'');b.append(icon('cup'));b.setAttribute('aria-label','Adicionar '+state.prefs.cup+' ml');b.onclick=async ()=>await addWater(state.prefs.cup);$('waterCups').append(b)}
 $('planSummary').textContent=state.plan?planDescription(state.plan):'Nenhum plano ativo. Você pode usar o cronômetro livremente.';
}
const originalRenderHome=renderHome;renderHome=function(){originalRenderHome();renderNutrition()};
const originalRenderHistory=renderHistory;renderHistory=function(){originalRenderHistory();const entries=dayMeals(selectedDay),box=$('selectedMeals');box.replaceChildren();if(entries.length){box.append(el('div',macroText(mealTotal(entries)),'history-macros'));for(let i=0;i<4;i++){const list=entries.filter(m=>m.category===i);if(list.length){const b=el('button',state.prefs.mealNames[i]+' · '+nfmt(mealTotal(list).kcal)+' kcal','textbtn');b.onclick=()=>{diaryDay=selectedDay;diaryFollowsToday=diaryDay===dayKey();showPage('home');openMeal(i)};box.append(b)}}}};
$('diaryDate').onchange=()=>{const k=$('diaryDate').value;if(validDay(k)&&k<=dayKey()){diaryDay=k;diaryFollowsToday=k===dayKey();renderNutrition()}else{$('diaryDate').value=diaryDay;toast('Escolha hoje ou uma data passada')}};$('diaryToday').onclick=()=>{diaryDay=dayKey();diaryFollowsToday=true;renderNutrition()};
function prepareMeal(category){if(diaryFollowsToday&&diaryDay!==dayKey()){diaryDay=dayKey();renderNutrition()}mealContextDay=diaryDay;mealCategory=category;renderMeal()}
function openMeal(category){prepareMeal(category);openDialog('mealDialog')}
function renderMeal(){$('mealTitle').textContent=state.prefs.mealNames[mealCategory];$('mealDayLabel').textContent=dayLabel(mealContextDay);const entries=dayMeals(mealContextDay).filter(m=>m.category===mealCategory);$('mealTotals').textContent=macroText(mealTotal(entries));$('mealEntries').replaceChildren();if(!entries.length)$('mealEntries').append(el('p','Nenhum alimento registrado. Toque em adicionar para começar.','helper'));for(const m of entries){const row=el('div',undefined,'entry-row'),info=el('div'),edit=el('button',undefined,'icon-button'),del=el('button',undefined,'icon-button');info.append(el('strong',displayName(m.food)),el('small',nfmt(m.amount)+(m.food.base==='100g'?' g':' porção(ões)')+' · '+nfmt(nutrients(m.food,m.amount).kcal)+' kcal'));edit.append(icon('edit'));edit.setAttribute('aria-label','Editar quantidade de '+m.food.name);edit.onclick=()=>openPortion(m.food,m);del.append(icon('trash'));del.setAttribute('aria-label','Excluir '+m.food.name);del.onclick=async ()=>{state.meals=state.meals.filter(x=>x.id!==m.id);if(!await save())return;render();renderMeal()};row.append(info,edit,del);$('mealEntries').append(row)}}
$('addToMeal').onclick=()=>openCatalog(true);$('openCatalog').onclick=()=>openCatalog(false);
const builtinFoods=/*@taco*/[];
let catalogLimit=40;
let onlineFirst=false,onlineTimer=0,basket=[],onlineFoods=[],searchController=null,searchSequence=0,scannerStream=null,scannerTimer=null,recognition=null,scanGeneration=0;
const foodCache=new Map(),requestTimes=[];
const plainSearch=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
// Plural-tolerant matching: "ovos" finds "Ovo, de galinha", "paes" finds "Pao", "limoes" finds "Limao".
function stemTerm(t){if(t.length<4)return t;if(/(oes|aes)$/.test(t))return t.slice(0,-3)+'ao';if(/ns$/.test(t))return t.slice(0,-2)+'m';if(/(res|zes|eses)$/.test(t))return t.slice(0,-2);if(/s$/.test(t))return t.slice(0,-1);return t}
const plainNames=new Map();
function plainName(f){const k=f.id+'|'+f.name;let v=plainNames.get(k);if(v===undefined){const b=bmap().get(f.id);v=plainSearch(f.name+(b?' '+b.name+' '+b.taco:''));plainNames.set(k,v)}return v}
const STOP=new Set(['de','da','do','das','dos','e','a','o','as','os','na','no','em','para','tipo','um','uma','c']);
const SYN={file:['peito'],bife:['file','peito'],peito:['file'],marmitex:['prato'],batatinha:['batata'],refri:['refrigerante'],coca:['refrigerante'],macarrao:['massa'],miojo:['macarrao'],presunto:['apresuntado']};
const swapGender=t=>t.length>=4&&/[ao]$/.test(t)?t.slice(0,-1)+(t.endsWith('o')?'a':'o'):t;
const altCache=new Map();
function termAlts(t){let a=altCache.get(t);if(!a){const st=stemTerm(t);a=[...new Set([t,st,swapGender(t),swapGender(st),...(SYN[t]||[]),...(SYN[st]||[])])];altCache.set(t,a)}return a}
function termsScore(name,terms){let n=0,w=0;for(const t of terms)if(termAlts(t).some(a=>name.includes(a))){n++;w+=t.length}return {n,w}}
function termsMatch(name,terms){return terms.every(t=>termAlts(t).some(a=>name.includes(a)))}
// Household measures (approximate grams) understood by the dictation parser.
const QTY_WORDS={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,meia:.5,meio:.5};
const HOUSEHOLD=[
 {re:'fatias?',g:25,label:'fatia'},{re:'colher(?:es)? de sopa',g:15,label:'colher de sopa',pl:'colheres de sopa'},{re:'colher(?:es)? de cha',g:5,label:'colher de chá',pl:'colheres de chá'},{re:'colher(?:es)?',g:15,label:'colher',pl:'colheres'},
 {re:'xicaras?',g:150,label:'xícara'},{re:'conchas?',g:100,label:'concha'},{re:'copos?',g:200,label:'copo'},
 {re:'ovos?',g:50,keep:true,label:'ovo'},{re:'bananas?',g:80,keep:true,label:'banana'},{re:'macas?',g:130,keep:true,label:'maçã',pl:'maçãs'},{re:'laranjas?',g:130,keep:true,label:'laranja'},
 {re:'(?:pao|paes|paozinho|paezinhos?)(?: frances| franceses)?',g:50,keep:true,label:'pão',pl:'pães'}];
function foodGlyph(path){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',path);svg.append(p);return svg}
for(const [name,path] of Object.entries({search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',barcode:'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M7 8v8M10 8v8M14 8v8M17 8v8',voice:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8'}))$(name+'Glyph').append(foodGlyph(path));

$('searchGlyph').innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><circle cx=\"20\" cy=\"20\" r=\"14\" fill=\"#b6a1ed\"/><circle cx=\"20\" cy=\"20\" r=\"9\" fill=\"#e8f5ff\"/><path d=\"m30 30 11 11\" stroke=\"#f0bc7d\" stroke-width=\"7\" stroke-linecap=\"round\"/><path d=\"M13 18a8 8 0 0 1 7-6\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>";
$('barcodeGlyph').innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect x=\"4\" y=\"5\" width=\"40\" height=\"38\" rx=\"9\" fill=\"#263b43\"/><path d=\"M9 16v-6h6M33 10h6v6M39 32v6h-6M15 38H9v-6\" stroke=\"#e8c28b\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M15 17v14M20 17v14M26 17v14M32 17v14\" stroke=\"#f4e5c5\" stroke-width=\"3\"/><path d=\"M7 24h34\" stroke=\"#f09e8c\" stroke-width=\"2\"/></svg>";
$('voiceGlyph').innerHTML="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" aria-hidden=\"true\"><rect x=\"6\" y=\"5\" width=\"36\" height=\"36\" rx=\"12\" fill=\"#314c4c\"/><rect x=\"18\" y=\"9\" width=\"12\" height=\"21\" rx=\"6\" fill=\"#74e2c3\"/><path d=\"M13 22v3a11 11 0 0 0 22 0v-3M24 36v6M18 42h12\" stroke=\"#b1f5df\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></svg>";
function stopScanner(){scanGeneration++;clearTimeout(scannerTimer);scannerStream?.getTracks().forEach(t=>t.stop());scannerStream=null;$('scannerVideo').srcObject=null;$('scannerVideo').hidden=true;$('scanPlaceholder').hidden=false;$('scannerTorch').hidden=true;torchEnabled=false;$('scannerTorch').setAttribute('aria-pressed','false');}
function stopFoodMedia(){stopScanner();stopVoice();searchController?.abort();searchSequence++;}
function selectFoodTab(tab){stopFoodMedia();for(const b of document.querySelectorAll('[data-food-tab]')){b.setAttribute('aria-selected',String(b.dataset.foodTab===tab));b.tabIndex=b.dataset.foodTab===tab?0:-1}$('barcodePane').hidden=true;$('foodStatus').textContent='';if(tab==='barcode')openScan();if(tab==='voice')openVoice();}
for(const b of document.querySelectorAll('[data-food-tab]')){b.onclick=()=>selectFoodTab(b.dataset.foodTab);b.onkeydown=e=>{const tabs=[...document.querySelectorAll('[data-food-tab]')];let i=tabs.indexOf(b);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();i=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:2))%3;tabs[i].click();tabs[i].focus()}}}
function openCatalog(forMeal){catalogLimit=40;catalogForMeal=forMeal;basket=[];onlineFoods=[];onlineFirst=false;clearTimeout(onlineTimer);$('foodSearch').value='';$('foodSort').value='frequent';$('catalogTitle').textContent=forMeal?state.prefs.mealNames[mealCategory]:'Meus alimentos';$('foodBasket').hidden=true;selectFoodTab('search');renderCatalog();renderBasket();openDialog('catalogDialog');$('catalogDialog').scrollTop=0;$('closeCatalog').focus({preventScroll:true})}
function closeFoodCatalog(){if(basket.length){confirm('Descartar os alimentos selecionados que ainda não foram salvos?',()=>{basket=[];$('catalogDialog').close()},'Descartar')}else $('catalogDialog').close()}
$('closeCatalog').onclick=closeFoodCatalog;$('catalogDialog').addEventListener('cancel',e=>{e.preventDefault();closeFoodCatalog()});$('catalogDialog').addEventListener('close',stopFoodMedia);
function catalogFoods(){const all=new Map();for(const f of builtinFoods)all.set(f.id,f);if(['recent','frequent'].includes($('foodSort').value))for(const m of state.meals)all.set(m.food.id,m.food);for(const f of state.foods)all.set(f.id,f);return [...all.values()]}
let _bmap=null;
function foodSeal(f){if(!_bmap)_bmap=new Map(builtinFoods.map(b=>[b.id,b]));const b=_bmap.get(f.id);
 if(b){const same=['kcal','carbs','protein','fat','fiber'].every(k=>Math.abs((f[k]??0)-b[k])<1e-9);return same?'verified':'edited'}
 const i=String(f.id);return i.startsWith('off-')?'community':i.startsWith('kcal-')?'kcal':'own'}
const SEALS={verified:['✓ TACO','Valores da Tabela TACO (Unicamp), 4ª edição'],community:['Colaborativo','Dado enviado por pessoas ao Open Food Facts. Confira o rótulo.'],own:['Seu cadastro','Cadastrado por você a partir do rótulo'],edited:['Editado','Vem da Tabela TACO, mas você alterou os valores'],kcal:['Só kcal','Registro só com calorias']};
let onlineAll=false,onlineQuery='';
function bmap(){if(!_bmap)_bmap=new Map(builtinFoods.map(b=>[b.id,b]));return _bmap}
function sameAsBuiltin(f,b){return f.name===b.name||f.name===b.taco}
function displayName(f){const b=bmap().get(f.id);return b&&sameAsBuiltin(f,b)?b.name:f.name}
function foodDetail(f){const b=bmap().get(f.id);return b&&sameAsBuiltin(f,b)?(b.detail||''):''}
function isCommon(f){const b=bmap().get(f.id);return b?b.common||0:0}
const capFirst=t=>t?t[0].toUpperCase()+t.slice(1):t;
function foodRow(f){const row=el('div',undefined,'catalog-row'),main=el('button'),add=el('button',catalogForMeal?'+':'›','food-add'),title=el('strong',displayName(f));main.type='button';add.type='button';
 if(foodSeal(f)==='verified'){const sd=el('span',undefined,'seal-dot');sd.setAttribute('role','img');sd.setAttribute('aria-label','Verificado, Tabela TACO');sd.title='Verificado: Tabela TACO (Unicamp)';title.append(sd)}
 const sub=[capFirst(foodDetail(f)),f.brand||'',f.base==='100g'?'100 g':(f.portion||'1 porção')].filter(Boolean).join(' · ');
 main.append(title,el('small',sub));const kc=el('span',nfmt(Math.round(f.kcal))+' kcal','food-kcal');
 const choose=()=>catalogForMeal?openPortion(f):reviewFood(f);main.onclick=choose;add.onclick=choose;add.setAttribute('aria-label',(catalogForMeal?'Adicionar ':'Editar ')+displayName(f));
 row.append(main,kc,add);return row}
function partialRow(x){const f=x.food,row=el('div',undefined,'catalog-row'),main=el('button'),add=el('button','›','food-add');main.type='button';add.type='button';main.append(el('strong',f.name),el('small',[f.brand||'','faltam: '+x.missing.map(k=>MISS_LABEL[k]).join(', ')].filter(Boolean).join(' · ')));const go=()=>openPrefilled(f,x.missing);main.onclick=go;add.onclick=go;add.setAttribute('aria-label','Completar '+f.name);row.append(main,el('span','','food-kcal'),add);return row}
function dishKcal(d){return d.items.reduce((t,it)=>t+nutrients(it.food,it.amount).kcal,0)}
function dishRow(d,withDelete){const row=el('div',undefined,'catalog-row dish-row'),main=el('button'),add=el('button','+','food-add');main.type='button';add.type='button';
 main.append(el('strong',d.name),el('small',d.items.length+(d.items.length===1?' item':' itens')+' · '+d.items.map(it=>displayName(it.food)).join(', ')));
 const kc=el('span',nfmt(Math.round(dishKcal(d)))+' kcal','food-kcal');const go=()=>addDish(d);main.onclick=go;add.onclick=go;add.setAttribute('aria-label','Adicionar o prato '+d.name);row.append(main,kc,add);
 if(withDelete){const del=el('button',undefined,'icon-button dish-del');del.type='button';del.append(icon('trash'));del.setAttribute('aria-label','Excluir o prato '+d.name);del.onclick=()=>confirm('Excluir o prato "'+d.name+'"? O que você já registrou não muda.',async()=>{state.dishes=state.dishes.filter(x=>x.id!==d.id);if(!await save())return;renderCatalog();toast('Prato excluído')},'Excluir');row.append(del);row.classList.add('with-del')}
 return row}
function addDish(d){if(!catalogForMeal){toast('Abra uma refeição no diário para adicionar o prato.');return}for(const it of d.items)basket.push({id:id(),day:mealContextDay,category:mealCategory,food:JSON.parse(JSON.stringify(it.food)),amount:it.amount});renderBasket();toast('Prato adicionado: '+d.items.length+(d.items.length===1?' item':' itens'))}
function renderCatalog(){
 const chip=$('foodSort').value,raw=$('foodSearch').value.trim(),search=plainSearch(raw),terms=search.split(/\s+/).filter(t=>t&&!STOP.has(t)),list=$('foodList');
 document.querySelectorAll('#foodChips button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chip===(chip==='name'||chip==='recent'?'frequent':chip))));
 list.replaceChildren();$('foodCredit').hidden=true;
 const head=t=>list.append(el('p',t,'food-group'));
 const dishMatch=d=>!terms.length||termsMatch(plainSearch(d.name+' '+d.items.map(it=>displayName(it.food)).join(' ')),terms);
 if(chip==='dishes'){const ds=state.dishes.filter(dishMatch);if(!ds.length)list.append(el('p',state.dishes.length?'Nenhum prato com esse nome.':'Você ainda não tem pratos. Escolha 2 ou mais alimentos e toque em "Salvar como prato", ou salve uma refeição inteira na tela da refeição.','food-empty'));for(const d of ds)list.append(dishRow(d,true));return}
 const usage=new Map();for(const m of state.meals)usage.set(m.food.id,(usage.get(m.food.id)||0)+1);const used=f=>usage.get(f.id)||0;
 let base=catalogFoods().filter(f=>!String(f.id).startsWith('kcal-'));
 if(chip==='favorite')base=base.filter(f=>f.favorite);if(chip==='mine')base=base.filter(f=>foodSeal(f)==='own');if(chip==='verified')base=base.filter(f=>foodSeal(f)==='verified');
 const matched=terms.length?base.filter(f=>termsMatch(plainName(f),terms)):base;
 let similar=[];if(terms.length>=2){const need=Math.ceil(terms.length/2),have0=new Set(matched.map(f=>f.id));similar=base.filter(f=>!have0.has(f.id)).map(f=>({f,...termsScore(plainName(f),terms)})).filter(x=>x.n>=need).sort((a,b)=>b.w-a.w||displayName(a.f).length-displayName(b.f).length).slice(0,10).map(x=>x.f)}
 const first=terms[0],starts=f=>first&&termAlts(first).some(a=>plainSearch(displayName(f)).startsWith(a))?1:0;
 const T=new Map(matched.map(f=>{const c=isCommon(f);return [f.id,used(f)||f.favorite||foodSeal(f)==='own'?0:c===2?1:c===1?2:3]}));
 const rk=f=>bmap().get(f.id)?.r||999;matched.sort((a,b)=>T.get(a.id)-T.get(b.id)||starts(b)-starts(a)||used(b)-used(a)||rk(a)-rk(b)||displayName(a).length-displayName(b).length||displayName(a).localeCompare(displayName(b),'pt-BR'));
 const showOnline=chip==='frequent'||chip==='name',have=new Set(matched.map(f=>f.id)),online=showOnline?onlineFoods.filter(f=>!have.has(f.id)):[];
 const onlineBlock=()=>{if(!online.length)return;head('Da internet · '+online.length);const n=onlineAll?online.length:Math.min(5,online.length);for(const f of online.slice(0,n))list.append(foodRow(f));if(online.length>n){const more=el('button','Ver mais da internet ('+(online.length-n)+')','secondary more-online');more.type='button';more.onclick=()=>{onlineAll=true;renderCatalog()};list.append(more)}$('foodCredit').hidden=false};
 const partBlock=()=>{const rows=(onlineFoods.partial||[]).filter(x=>!have.has(x.food.id));if(!showOnline||!rows.length)return;head('Dados incompletos · '+rows.length);for(const x of rows.slice(0,5))list.append(partialRow(x));$('foodCredit').hidden=false};
 if(onlineFirst)onlineBlock();
 if(showOnline&&terms.length){const ds=state.dishes.filter(dishMatch);if(ds.length){head('Seus pratos');for(const d of ds.slice(0,5))list.append(dishRow(d,false))}}
 const labels=['Seus alimentos','Mais comuns','Mais comuns','Outras opções'],multi=showOnline&&new Set([...T.values()].map(t=>labels[t])).size>1;let last='',shown=0;
 for(const f of matched){if(shown>=catalogLimit)break;const lb=labels[T.get(f.id)];if(multi&&lb!==last){head(lb);last=lb}list.append(foodRow(f));shown++}
 if(matched.length>catalogLimit){const more=el('button','Mostrar mais ('+(matched.length-catalogLimit)+')','secondary more-online');more.type='button';more.onclick=()=>{catalogLimit+=40;renderCatalog()};list.append(more)}
 if(similar.length){head('Resultados parecidos');for(const f of similar)list.append(foodRow(f))}
 if(!onlineFirst)onlineBlock();
 partBlock();
 if(!matched.length&&!similar.length&&!online.length&&!(onlineFoods.partial||[]).length)list.append(el('p',chip==='favorite'?(raw?'Nenhum favorito com esse nome.':'Nenhum favorito ainda. Ao escolher um alimento, toque na estrela para guardar aqui.'):chip==='mine'?(raw?'Nenhum alimento seu com esse nome.':'Você ainda não cadastrou alimentos. Use "Cadastrar pelo rótulo" logo abaixo.'):chip==='verified'?'Nenhum alimento verificado com esse nome.':raw?'Nada com esse nome no aparelho.':'Nenhum alimento ainda.','food-empty'));
 if(showOnline&&raw.length>=2&&onlineQuery!==raw&&navigator.onLine!==false&&!onlineFirst){const nb=el('button','Buscar "'+raw+'" na internet','textbtn search-net');nb.type='button';nb.onclick=()=>{clearTimeout(onlineTimer);searchFoods(false,false)};list.append(nb)}
}
function reviewFood(f){if(state.foods.some(x=>x.id===f.id)){openFood(f);return}openFood(null);$('foodName').value=f.name;$('foodBarcode').value=f.barcode??'';$('foodBase').value=f.base;$('foodPortion').value=f.portion;for(const k of nutrientKeys)$('food'+fieldSuffix[k]).value=f[k];updateBase()}
let searchTimer=0;function scheduleOnline(){clearTimeout(onlineTimer);if($('foodSearch').value.trim().length<3||!['frequent','name'].includes($('foodSort').value))return;onlineTimer=setTimeout(()=>searchFoods(false,true),1100)}
$('foodSearch').oninput=()=>{catalogLimit=40;onlineFoods=[];onlineFirst=false;onlineAll=false;searchController?.abort();searchSequence++;$('foodStatus').textContent='';clearTimeout(searchTimer);searchTimer=setTimeout(renderCatalog,120);scheduleOnline()};$('foodSort').onchange=()=>{catalogLimit=40;renderCatalog();scheduleOnline()};$('newFood').onclick=()=>openFood(null);
function renderBasket(){$('showBasket').textContent=basket.length;$('showBasket').hidden=!catalogForMeal;$('finishFoods').textContent=basket.length?'Salvar '+basket.length+' alimento'+(basket.length===1?'':'s'):'Concluir';const box=$('foodBasket');box.replaceChildren();for(const m of basket){const row=el('div',undefined,'entry-row'),remove=el('button','Remover','textbtn');row.append(el('span',displayName(m.food)+' · '+nfmt(m.amount)+(m.food.base==='100g'?' g':' porção(ões)')),remove);remove.onclick=()=>{basket=basket.filter(x=>x.id!==m.id);renderBasket()};box.append(row)}}
$('showBasket').onclick=()=>{$('foodBasket').hidden=!$('foodBasket').hidden};
$('finishFoods').onclick=async ()=>{if(basket.length){state.meals.push(...basket);for(const m of basket)if(!String(m.food.id).startsWith('kcal-')&&!state.foods.some(f=>f.id===m.food.id))state.foods.push({...m.food});if(!await save())return;basket=[];render();renderMeal();toast('Refeição salva');tataReact('meal')}else if(!catalogForMeal){$('catalogDialog').close();return}$('catalogDialog').close()};
function offFood(p){const n=p.nutriments||{},num=v=>v===undefined||v===null||v===''?NaN:Number(v);let pn=p.product_name_pt||p.product_name||'';if(pn&&typeof pn==='object')pn=pn.pt||pn.main||pn.en||Object.values(pn).find(x=>typeof x==='string')||'';const f={id:'off-'+String(p.code),name:String(pn).trim().slice(0,60),base:'100g',portion:'',favorite:false,source:'Open Food Facts',barcode:String(p.code)};offExtras(f,p);if(!/^\d{8,14}$/.test(f.barcode)||!f.name)return null;
 let kcal=num(n['energy-kcal_100g']);if(!Number.isFinite(kcal)){const kj=num(n['energy_100g']??n['energy-kj_100g']);if(Number.isFinite(kj))kcal=Math.round(kj/4.184)}
 const carbs=num(n['carbohydrates_100g']),protein=num(n['proteins_100g']),fat=num(n['fat_100g']),fiber=num(n['fiber_100g']);
 if(![kcal,carbs,protein,fat].every(Number.isFinite))return null;
 f.kcal=kcal;f.carbs=carbs;f.protein=protein;f.fat=fat;f.fiber=Number.isFinite(fiber)?fiber:0;
 if(['ml','l','cl'].includes(String(p.product_quantity_unit).toLowerCase())){f.base='portion';f.portion='100 ml'}return validFood(f)?f:null}
async function getJSON(url,ms){searchController?.abort();const ctrl=new AbortController();searchController=ctrl;const t=setTimeout(()=>ctrl.abort(),ms);try{const r=await fetch(url,{signal:ctrl.signal});if(!r.ok)throw Error('http '+r.status);return await r.json()}finally{clearTimeout(t)}}
function onlineTerms(raw){const out=[];for(const t of raw.toLocaleLowerCase('pt-BR').split(/\s+/)){const p=plainSearch(t);if(!p||STOP.has(p))continue;const s=stemTerm(p);out.push(s===p?t:s)}return out}
// Produto do Open Food Facts com parte dos números faltando: aparece em "Dados incompletos" e abre o formulário para completar pelo rótulo.
function offPartial(p){const code=String(p.code||'');if(!/^\d{8,14}$/.test(code))return null;const {food,missing}=offDraft(p,code);return food.name&&missing.length&&missing.length<4&&!missing.includes('name')?{food,missing}:null}
async function fetchFoods(query,barcode=false){const key=(barcode?'code:':'name:')+query.toLowerCase();const cached=foodCache.get(key);if(cached)return cached;const seq=searchSequence;
 const tick=()=>{const now=Date.now();while(requestTimes.length&&requestTimes[0]<now-60000)requestTimes.shift();if(requestTimes.length>=8)return false;requestTimes.push(now);return true};
 const limitErr=()=>Error('Muitas buscas seguidas. Aguarde um minuto para buscar na internet de novo.');
 const fields='code,product_name,product_name_pt,nutriments,product_quantity_unit,brands,serving_size,serving_quantity';
 if(barcode){if(!tick())throw limitErr();const d=await getJSON('https://world.openfoodfacts.org/api/v3/product/'+encodeURIComponent(query)+'.json?fields='+fields,15000);const r=(d.product?[d.product]:[]).map(offFood).filter(Boolean);foodCache.set(key,r);return r}
 const seen=new Set(),partSeen=new Set(),result=[],partial=[];let failed=null,calls=0;
 const take=hits=>{for(const p of hits){const f=offFood(p);if(f){const k=f.name.toLowerCase()+'|'+(f.brand||'').toLowerCase()+'|'+Math.round(f.kcal);if(!seen.has(k)){seen.add(k);result.push(f)}}else{const x=offPartial(p);if(x&&!partSeen.has(x.food.id)){partSeen.add(x.food.id);partial.push(x)}}}};
 // Cada chamada conta no limite por minuto. Erro de rede não é guardado no cache.
 const run=async(url,ms,pick)=>{if(!tick()){if(!calls)throw limitErr();return}calls++;try{take(pick(await getJSON(url,ms)))}catch(e){if(seq!==searchSequence)throw Object.assign(Error('stale'),{name:'AbortError'});failed=e}};
 const qs=onlineTerms(query),q1=qs.join(' ')||query,q2=qs.length>1?[...qs].sort((a,b)=>b.length-a.length)[0]:'';
 const prim=q=>run('https://search.openfoodfacts.org/search?q='+encodeURIComponent(q)+'&page_size=30&langs=pt&fields='+fields,9000,d=>d.hits||[]);
 await prim(q1);
 if(result.length<3)await run('https://world.openfoodfacts.org/cgi/search.pl?search_terms='+encodeURIComponent(q1)+'&search_simple=1&action=process&json=1&page_size=30&sort_by=unique_scans_n&fields='+fields,15000,d=>d.products||[]);
 if(result.length<3&&q2)await prim(q2);
 if(!result.length&&!partial.length&&failed)throw failed;
 result.partial=partial;if(!failed)foodCache.set(key,result);return result}
async function searchFoods(barcode=false,auto=false){const query=(barcode?$('barcodeInput').value:$('foodSearch').value).trim();if(barcode?!/^\d{8,14}$/.test(query):query.length<(auto?3:2)){if(!auto)$('foodStatus').textContent=barcode?'Digite de 8 a 14 números do código.':'Digite ao menos 2 letras para buscar.';return}
 if(navigator.onLine===false){$('foodStatus').textContent='Sem internet agora. Mostrando só os alimentos do aparelho.';return}
 const sequence=++searchSequence;$('foodStatus').textContent='Buscando na internet…';
 try{const result=await fetchFoods(query,barcode);if(sequence!==searchSequence||!$('catalogDialog').open)return;onlineFoods=result;onlineAll=false;onlineFirst=barcode;if(barcode){$('foodSearch').value='';$('foodSort').value='name'}renderCatalog();if(barcode)$('catalogDialog').scrollTop=0;if(!barcode)onlineQuery=query;$('foodStatus').textContent=result.length||(result.partial||[]).length?'':'Nada na internet para essa busca.'}
 catch(e){if(sequence!==searchSequence)return;$('foodStatus').textContent=e.name==='AbortError'?'A internet demorou demais. Mostrando só os alimentos do aparelho.':/Muitas buscas/.test(e.message)?e.message:'Não consegui buscar na internet agora. Mostrando só os alimentos do aparelho.'}}
$('searchFoodForm').onsubmit=e=>{e.preventDefault();clearTimeout(onlineTimer);renderCatalog();searchFoods(false,false)};
let scannedBarcode='',voiceGeneration=0,voiceListening=false,torchEnabled=false;
let decoderHints=null,offlineReader=null;
function zxingReady(){if(offlineReader)return true;if(!window.ZXing)return false;decoderHints=new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.EAN_13,ZXing.BarcodeFormat.EAN_8,ZXing.BarcodeFormat.UPC_A,ZXing.BarcodeFormat.UPC_E]],[ZXing.DecodeHintType.TRY_HARDER,true]]);offlineReader=new ZXing.MultiFormatReader();return true}
let zxingLoading=null;function ensureZXing(){if(window.ZXing)return Promise.resolve(zxingReady());if(!zxingLoading)zxingLoading=new Promise(res=>{const sc=document.createElement('script');sc.src='vendor/zxing.min.js';sc.onload=()=>res(zxingReady());sc.onerror=()=>{zxingLoading=null;res(false)};document.head.append(sc)});return zxingLoading}
function decodePixels(rgba,width,height){if(!zxingReady())throw Error('leitor indisponível');const gray=new Uint8ClampedArray(width*height);for(let i=0,j=0;i<gray.length;i++,j+=4)gray[i]=(rgba[j]+rgba[j+1]*2+rgba[j+2])>>2;try{return offlineReader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(gray,width,height))),decoderHints).getText()}finally{offlineReader.reset()}}
function decodeImage(source,width,height,rotate=0,maxSize=1200){const scale=Math.min(1,maxSize/Math.max(width,height)),w=Math.round(width*scale),h=Math.round(height*scale);const canvas=document.createElement('canvas');canvas.width=rotate%180?h:w;canvas.height=rotate%180?w:h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotate*Math.PI/180);ctx.drawImage(source,-w/2,-h/2,w,h);return decodePixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height)}
function normalizeCode(value){const code=String(value).trim();if(!/^\d{8,14}$/.test(code))return '';return code.padStart(14,'0')}
function handleScannedCode(value){const code=String(value).trim();if(!normalizeCode(code)){$('scanStatus').textContent='Use os 8 a 14 números da embalagem.';return}stopScanner();scannedBarcode=code;$('barcodeInput').value=code;$('scannerCodeInput').value=code;$('scannedCode').textContent=code;const local=[...state.foods,...state.meals.map(m=>m.food)].find(f=>f.barcode&&normalizeCode(f.barcode)===normalizeCode(code));if(local){$('scanStatus').textContent='Produto encontrado no aparelho.';$('scanDialog').close();catalogForMeal?openPortion(local):reviewFood(local);return}$('scanResult').hidden=false;autoLookup(code)}
function openScan(){stopFoodMedia();$('scanResult').hidden=true;$('scanStatus').textContent='Preparando câmera…';$('manualBarcode').open=false;openDialog('scanDialog');$('scanDialog').scrollTop=0;startOfflineScanner()}
async function startOfflineScanner(){stopScanner();$('scanResult').hidden=true;const gen=scanGeneration;$('scanStatus').textContent='Aguardando acesso à câmera…';if(!navigator.mediaDevices?.getUserMedia){$('scanStatus').textContent='Este navegador não libera a câmera neste arquivo. Toque em Fotografar código para ler uma foto offline, ou digite os números.';return}try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});if(gen!==scanGeneration||!$('scanDialog').open){stream.getTracks().forEach(t=>t.stop());return}scannerStream=stream;const video=$('scannerVideo');video.srcObject=stream;video.hidden=false;$('scanPlaceholder').hidden=true;await video.play();if(gen!==scanGeneration)return;const track=stream.getVideoTracks()[0],caps=track.getCapabilities?.()||{};$('scannerTorch').hidden=!caps.torch;$('scanStatus').textContent='Aponte para as barras. A leitura funciona sem internet.';const scan=()=>{if(gen!==scanGeneration||!$('scanDialog').open)return;if(video.readyState>=2&&video.videoWidth){try{const code=decodeImage(video,video.videoWidth,video.videoHeight,0,960);handleScannedCode(code);return}catch{}}if(gen===scanGeneration)scannerTimer=setTimeout(scan,300)};scan()}catch(e){if(gen!==scanGeneration)return;stopScanner();$('scanStatus').textContent=e.name==='NotAllowedError'?'A câmera não foi autorizada. Permita o acesso no navegador ou use Fotografar código.':'Não foi possível abrir a câmera. Use Fotografar código ou digite os números.'}}
$('startScanner').onclick=$('scanAgain').onclick=startOfflineScanner;
$('closeScan').onclick=()=>$('scanDialog').close();$('scanDialog').addEventListener('close',stopScanner);$('scanDialog').addEventListener('cancel',stopScanner);
$('manualBarcodeForm').onsubmit=e=>{e.preventDefault();if($('manualBarcodeForm').reportValidity())handleScannedCode($('scannerCodeInput').value)};
$('lookupBarcode').onclick=()=>{openDialog('scanDialog');handleScannedCode($('barcodeInput').value)};
$('registerScanned').onclick=()=>{$('scanDialog').close();openFood(null);$('foodBarcode').value=scannedBarcode};
$('lookupScanned').onclick=()=>{$('scanDialog').close();$('barcodeInput').value=scannedBarcode;searchFoods(true)};
$('scannerTorch').append(foodGlyph('M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0l-1 2H9z'));
$('scanLargeIcon').append($('barcodeGlyph').firstChild.cloneNode(true));
$('scannerTorch').onclick=async()=>{const track=scannerStream?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{torch:!torchEnabled}]});torchEnabled=!torchEnabled;$('scannerTorch').setAttribute('aria-pressed',String(torchEnabled));$('scannerTorch').setAttribute('aria-label',torchEnabled?'Desligar lanterna':'Ligar lanterna')}catch{$('scanStatus').textContent='Não foi possível ativar a lanterna neste aparelho.'}};
$('barcodePhoto').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;stopScanner();const gen=scanGeneration;if(file.size>15e6){$('scanStatus').textContent='Escolha uma foto de até 15 MB.';return}$('scanStatus').textContent='Lendo a foto no aparelho…';const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});if(gen!==scanGeneration||!$('scanDialog').open)return;let code;for(const rotate of [0,90,180,270]){try{code=decodeImage(img,img.naturalWidth,img.naturalHeight,rotate,1600);break}catch{}}if(!code)throw Error('notfound');handleScannedCode(code)}catch{if(gen===scanGeneration)$('scanStatus').textContent='Não encontramos o código. Tire uma foto nítida, com as barras inteiras e mais próximas, ou digite os números.'}finally{URL.revokeObjectURL(url)}};
function updateSpeech(){const text=$('mealSpeech').value.slice(0,500);$('mealSpeech').value=text;$('speechRemaining').textContent=(500-text.length)+' caracteres disponíveis';$('analyzeSpeech').disabled=!text.trim();}
function stopVoice(){voiceGeneration++;voiceListening=false;const current=recognition;recognition=null;if(current){current.onend=current.onerror=current.onresult=null;try{current.abort()}catch{}}$('startVoice').setAttribute('aria-pressed','false');$('startVoice').setAttribute('aria-label','Começar ditado')}
function openVoice(){stopFoodMedia();$('speechMatches').replaceChildren();$('speechStatus').textContent='Toque no microfone ou escreva sua refeição.';updateSpeech();openDialog('voiceDialog');$('voiceDialog').scrollTop=0;$('closeVoice').focus({preventScroll:true})}
$('closeVoice').onclick=()=>$('voiceDialog').close();$('voiceDialog').addEventListener('close',stopVoice);$('voiceDialog').addEventListener('cancel',stopVoice);$('mealSpeech').oninput=()=>{stopVoice();updateSpeech()};
$('startVoice').append(foodGlyph('M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8'));
$('startVoice').onclick=()=>{if(voiceListening){const current=recognition;try{current?.stop();$('speechStatus').textContent='Finalizando ditado…'}catch{stopVoice();$('speechStatus').textContent='Confira o texto antes de continuar.'}return}const Speech=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition;if(!Speech){$('speechStatus').textContent='Ditado direto indisponível aqui. Toque no campo e use o microfone do teclado Google (Gboard), ou digite.';$('mealSpeech').focus();return}stopVoice();const token=voiceGeneration,base=$('mealSpeech').value.trim();const session=new Speech();recognition=session;session.lang='pt-BR';session.interimResults=true;session.continuous=false;voiceListening=true;$('startVoice').setAttribute('aria-pressed','true');$('startVoice').setAttribute('aria-label','Parar ditado');session.onresult=e=>{if(token!==voiceGeneration||!$('voiceDialog').open)return;let text='';for(let i=0;i<e.results.length;i++)text+=e.results[i][0].transcript+' ';$('mealSpeech').value=(base+(base?' ':'')+text.trim()).slice(0,500);updateSpeech();$('speechStatus').textContent='Ouvindo… Toque no microfone para parar.'};session.onerror=e=>{if(token!==voiceGeneration)return;const messages={'not-allowed':'Microfone não autorizado. Use o teclado ou permita acesso nas configurações do navegador.','no-speech':'Não ouvimos uma fala. Tente novamente.','network':'O serviço de voz não respondeu. Use o ditado do teclado ou digite.','audio-capture':'Não foi possível acessar o microfone. Confira se outro app está usando ele.','aborted':'Ditado interrompido.'};$('speechStatus').textContent=messages[e.error]||'O ditado não está disponível. Use o teclado.';voiceListening=false;$('startVoice').setAttribute('aria-pressed','false')};session.onend=()=>{if(token!==voiceGeneration)return;voiceListening=false;recognition=null;$('startVoice').setAttribute('aria-pressed','false');$('startVoice').setAttribute('aria-label','Começar ditado');if($('speechStatus').textContent.startsWith('Ouvindo')||$('speechStatus').textContent.startsWith('Finalizando'))$('speechStatus').textContent='Confira o texto e toque em Buscar alimentos.'};try{session.start();$('speechStatus').textContent='Ouvindo… Toque no microfone para parar.'}catch{stopVoice();$('speechStatus').textContent='Não foi possível iniciar o ditado. Use o microfone do teclado.'}};
function parseMealSpeech(text){return text.replace(/(\d),(\d)/g,'$1.$2').split(/[,;\n]+|\s+e\s+/i).map(part=>{
 const amountMatch=part.match(/(\d+(?:[.,]\d+)?)\s*(?:g\b|gramas?\b)/i);let grams=amountMatch?Number(amountMatch[1].replace(',','.')):null,hint='';
 let work=plainSearch(part);
 if(grams===null){const qty='(\\d+(?:\\.\\d+)?|'+Object.keys(QTY_WORDS).join('|')+')';
  for(const u of HOUSEHOLD){const m=work.match(new RegExp('(?:\\b'+qty+'\\s+)?\\b('+u.re+')\\b'+(u.keep?'':'(?:\\s+de\\b)?')));if(!m)continue;
   const n=m[1]===undefined?1:(QTY_WORDS[m[1]]??Number(m[1]));if(!(n>0))continue;grams=Math.round(n*u.g);hint='≈ '+grams+' g ('+(String(n).replace('.',','))+' '+(n>1?(u.pl||u.label+'s'):u.label)+' · medida caseira aproximada)';
   work=work.replace(m[0],u.keep?' '+m[2]+' ':' ');break}}
 const query=work.replace(/\d+(?:\.\d+)?\s*(?:gramas?\b|g\b)?/g,' ').replace(/\b(um|uma|uns|umas|de|do|da|com|e|eu|comi|meia|meio|dois|duas|tres|quatro|cinco|seis)\b/g,' ').trim().replace(/\s+/g,' ');
 return {label:part.trim(),query,grams,hint}}).filter(x=>x.query).slice(0,12)}
$('analyzeSpeech').onclick=()=>{stopVoice();const groups=parseMealSpeech($('mealSpeech').value),box=$('speechMatches');box.replaceChildren();const all=new Map(builtinFoods.map(f=>[f.id,f]));for(const f of [...state.meals.map(m=>m.food),...state.foods])all.set(f.id,f);for(const group of groups){const section=el('section',undefined,'speech-group');section.append(el('h3',group.label));if(group.hint)section.append(el('p',group.hint,'helper'));const tokens=group.query.split(' '),matches=[...all.values()].filter(f=>termsMatch(plainName(f),tokens)).slice(0,6);if(!matches.length)section.append(el('p','Nenhuma correspondência. Tente um nome mais simples, como “arroz”.','helper'));for(const f of matches){const b=el('button',undefined,'speech-choice');b.append(el('span',f.name),el('span','+'));b.onclick=()=>{if(!catalogForMeal){reviewFood(f);return}openPortion(f);if(group.grams&&group.grams<=10000&&f.base==='100g'){$('portionAmount').value=group.grams;portionPreview()}};section.append(b)}box.append(section)}$('speechStatus').textContent=groups.length?'Escolha o preparo correto de cada alimento. As quantidades podem ser ajustadas.':'Digite o nome de um alimento.';};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFoodMedia();if($('scanDialog').open)$('scanStatus').textContent='Leitura pausada. Toque em Abrir câmera para continuar.';if($('voiceDialog').open)$('speechStatus').textContent='Ditado pausado. Seu texto foi mantido.'}});window.addEventListener('pagehide',stopFoodMedia);
function openFood(f){editingFood=f?.id??null;$('deleteCatalogFood').hidden=!f;$('foodTitle').textContent=f?'Editar alimento':'Novo alimento';$('foodName').value=f?.name??'';$('foodBarcode').value=f?.barcode??'';$('foodBase').value=f?.base??'100g';$('foodPortion').value=f?.portion??'';for(const k of nutrientKeys)$('food'+fieldSuffix[k]).value=f?.[k]??'';$('foodError').textContent='';updateBase();openDialog('foodDialog')}
$('deleteCatalogFood').onclick=()=>confirm('Excluir este alimento do catálogo? As refeições anteriores serão mantidas.',async()=>{state.foods=state.foods.filter(f=>f.id!==editingFood);if(!await save())return;$('foodDialog').close();renderCatalog();toast('Alimento removido do catálogo')},'Excluir');
function updateBase(){$('foodPortion').disabled=$('foodBase').value==='100g';$('foodPortion').required=$('foodBase').value==='portion'}$('foodBase').onchange=updateBase;
$('foodForm').onsubmit=async e=>{e.preventDefault();if(!$('foodForm').reportValidity())return;const old=state.foods.find(f=>f.id===editingFood);if(editingFood&&!old){$('foodError').textContent='Este alimento não está mais disponível.';return}const f={id:old?.id??id(),name:$('foodName').value.trim(),base:$('foodBase').value,portion:$('foodBase').value==='portion'?$('foodPortion').value.trim():'',favorite:old?.favorite??false};const barcode=$('foodBarcode').value.trim();if(barcode){if(!/^\d{8,14}$/.test(barcode)){$('foodError').textContent='Confira os números do código de barras.';return}if(state.foods.some(x=>x.id!==f.id&&x.barcode&&normalizeCode(x.barcode)===normalizeCode(barcode))){$('foodError').textContent='Esse código já pertence a outro alimento no catálogo.';return}f.barcode=barcode}for(const k of nutrientKeys)f[k]=Number($('food'+fieldSuffix[k]).value);readFoodExtras(f,old);if(!validFood(f)){ $('foodError').textContent='Confira o nome e os valores informados.';return}state.foods=state.foods.filter(x=>x.id!==f.id);state.foods.push(f);if(!await save())return;$('foodDialog').close();renderCatalog();toast('Alimento salvo. Toque nele para usar ou editar.')};
function openPortion(food,entry=null){portionFood=JSON.parse(JSON.stringify(food));editingEntry=entry?.id??null;$('portionFoodName').textContent=food.name+' · '+dayLabel(entry?.day??mealContextDay)+(food.source?' · '+food.source:'');$('portionLabel').textContent=food.base==='100g'?'Quantidade em gramas':'Número de porções ('+food.portion+')';$('portionAmount').value=entry?.amount??(food.base==='100g'?100:1);portionPreview();openDialog('portionDialog')}
function portionPreview(){const amount=Number($('portionAmount').value);$('portionPreview').textContent=portionFood&&Number.isFinite(amount)&&amount>0?macroText(nutrients(portionFood,amount)):''}$('portionAmount').oninput=portionPreview;
$('portionForm').onsubmit=async e=>{e.preventDefault();if(!$('portionForm').reportValidity())return;const amount=Number($('portionAmount').value);if(!portionFood||!Number.isFinite(amount)||amount<.1||amount>10000)return;const old=state.meals.find(m=>m.id===editingEntry);if(editingEntry&&!old){toast('Este lançamento não está mais disponível.');return}const m={id:old?.id??id(),day:old?.day??mealContextDay,category:old?.category??mealCategory,food:portionFood,amount};if(catalogForMeal&&$('catalogDialog').open&&!old){basket.push(m);$('portionDialog').close();renderBasket();toast('Adicionado à seleção');return}state.meals=state.meals.filter(x=>x.id!==m.id);state.meals.push(m);if(!await save())return;$('portionDialog').close();render();renderMeal();toast('Refeição atualizada')};
$('repeatMeal').onclick=()=>{const targetDay=mealContextDay;const date=parseDay(targetDay);date.setDate(date.getDate()-1);const list=dayMeals(dayKey(date)).filter(m=>m.category===mealCategory);if(!list.length){toast('Não há essa refeição no dia anterior.');return}confirm('Adicionar '+list.length+' alimento(s) de ontem a esta refeição?',async ()=>{state.meals.push(...list.map(m=>({...JSON.parse(JSON.stringify(m)),id:id(),day:targetDay})));if(!await save())return;render();renderMeal();toast('Refeição copiada')},'Copiar')};
function openGoals(){for(const k of nutrientKeys)$('goal'+fieldSuffix[k]).value=state.goals[k]??'';openDialog('goalsDialog')}$('openGoals').onclick=$('profileGoals').onclick=openGoals;
$('goalsForm').onsubmit=async e=>{e.preventDefault();if(!$('goalsForm').reportValidity())return;const goals={};for(const k of nutrientKeys){const raw=$('goal'+fieldSuffix[k]).value;goals[k]=raw===''?null:Number(raw)}if(!validV3({goals})){toast('Revise os valores.');return}state.goals=goals;if(!await save())return;render();$('goalsDialog').close();toast('Referências atualizadas')};
$('openProfile').onclick=()=>{$('profileName').value=state.profile.name;$('profileDiet').value=state.profile.diet;openDialog('profileDialog')};$('profileForm').onsubmit=async e=>{e.preventDefault();state.profile={name:$('profileName').value.trim().slice(0,40),diet:$('profileDiet').value};if(!await save())return;render();$('profileDialog').close()};
const cardLabels={nutrition:'Resumo nutricional',meals:'Refeições',water:'Água',fast:'Jejum',note:'Anotação'};
$('openPreferences').onclick=()=>{$('showWater').checked=state.prefs.showWater;$('showNote').checked=state.prefs.showNote;$('cupSize').value=state.prefs.cup;$('mealNamesFields').replaceChildren();for(let i=0;i<4;i++){const label=el('label','Refeição '+(i+1)),input=el('input');input.id='mealName'+i;input.maxLength=24;input.required=true;input.value=state.prefs.mealNames[i];label.setAttribute('for',input.id);$('mealNamesFields').append(label,input)}pendingOrder=[...state.prefs.order];renderOrder();openDialog('preferencesDialog')};
function renderOrder(){$('orderFields').replaceChildren();pendingOrder.forEach((key,i)=>{const row=el('div',undefined,'order-row'),up=el('button','↑'),down=el('button','↓');up.type=down.type='button';up.disabled=i===0;down.disabled=i===pendingOrder.length-1;up.setAttribute('aria-label','Mover '+cardLabels[key]+' para cima');down.setAttribute('aria-label','Mover '+cardLabels[key]+' para baixo');up.onclick=()=>{[pendingOrder[i-1],pendingOrder[i]]=[key,pendingOrder[i-1]];renderOrder()};down.onclick=()=>{[pendingOrder[i+1],pendingOrder[i]]=[key,pendingOrder[i+1]];renderOrder()};row.append(el('span',cardLabels[key]),up,down);$('orderFields').append(row)})}
$('preferencesForm').onsubmit=async e=>{e.preventDefault();if(!$('preferencesForm').reportValidity())return;const prefs={showWater:$('showWater').checked,showNote:$('showNote').checked,cup:Number($('cupSize').value),mealNames:[0,1,2,3].map(i=>$('mealName'+i).value.trim()),order:[...pendingOrder]};if(!validV3({prefs})){toast('Confira os nomes e o volume.');return}state.prefs=prefs;if(!await save())return;render();$('preferencesDialog').close();toast('Diário personalizado')};
const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function planDescription(p){const [h,m]=p.start.split(':').map(Number),minutes=h*60+m+p.hours*60,next=minutes>=1440;return p.days.map(d=>weekdays[d]).join(', ')+' · '+p.start+' → '+String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')+(next?' do dia seguinte':'')+' · '+number(p.hours)+'h de intervalo / '+number(24-p.hours)+'h restantes no dia.'}
function openPlan(){const plan=state.plan??{start:'20:00',hours:state.hours,days:[0,1,2,3,4,5,6]};$('planStart').value=plan.start;$('planHours').value=plan.hours;$('planDays').replaceChildren();weekdays.forEach((d,i)=>{const label=el('label'),input=el('input');input.type='checkbox';input.value=i;input.checked=plan.days.includes(i);input.setAttribute('aria-label',d);input.onchange=renderPlanPreview;label.append(input,el('span',d));$('planDays').append(label)});$('planError').textContent='';renderPlanPreview();openDialog('planDialog')}
function draftPlan(){return {start:$('planStart').value,hours:Number($('planHours').value),days:[...$('planDays').querySelectorAll('input:checked')].map(i=>Number(i.value))}}
function renderPlanPreview(){const plan=draftPlan();$('planPreview').textContent=validV3({plan})?planDescription(plan):'Selecione os dias e uma duração válida.'}
$('openPlan').onclick=$('profilePlan').onclick=openPlan;$('planStart').oninput=$('planHours').oninput=renderPlanPreview;
$('planForm').onsubmit=async e=>{e.preventDefault();if(!$('planForm').reportValidity())return;const plan=draftPlan();if(!validV3({plan})){$('planError').textContent='Selecione ao menos um dia e uma duração válida.';return}state.plan=plan;state.hours=plan.hours;state.fastCustom=false;state.fastOpen=false;if(!await save())return;render();$('planDialog').close();toast('Plano salvo para os próximos intervalos')};$('removePlan').onclick=async ()=>{state.plan=null;if(!await save())return;render();$('planDialog').close();toast('Plano removido')};
// Meals and historical snapshots are part of the same export/import as the timer.


function refreshStorageUI(){
 $('storagePanel').hidden=!recoveryBlocked;
 $('storageState').textContent='Não foi possível abrir seus registros. O original foi preservado.';
 $('enableEditing').hidden=true;$('releaseEditing').hidden=true;
 $('recoveryImport').hidden=!recoveryBlocked;$('recoveryReset').hidden=!recoveryBlocked;
 let archived=false;try{archived=localStorage.getItem(RECOVERY_KEY)!==null}catch{}
 $('exportProtected').hidden=recoveryRaw===null&&!archived;
}
let saving=false,lockDatabase;
function databaseLock(action){
 if(navigator.locks?.request)return navigator.locks.request('intervalo-write',()=>action());
 // Fallback: IndexedDB coordination; if it is unavailable, commitSave's optimistic check (loadedRaw vs localStorage) still guards writes.
 return idbLock(action).catch(e=>{if(e&&e.fallback)return action();throw e});
}
function idbLock(action){return new Promise((resolve,reject)=>{let ran=false;const fail=m=>{const e=Error(m);e.fallback=!ran;reject(e)};
 if(!globalThis.indexedDB){fail('storage unavailable');return}
 const run=db=>{const tx=db.transaction('writes','readwrite');let result;const request=tx.objectStore('writes').get('lock');request.onsuccess=()=>{try{ran=true;result=action()}catch(e){tx.abort();reject(e)}};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>fail('storage failed');};
 if(lockDatabase){run(lockDatabase);return}
 const request=indexedDB.open('intervalo-write-coordination',1);request.onupgradeneeded=()=>request.result.createObjectStore('writes');request.onerror=()=>fail('idb open failed');request.onblocked=()=>fail('blocked');request.onsuccess=()=>{lockDatabase=request.result;lockDatabase.onversionchange=()=>{lockDatabase.close();lockDatabase=null};run(lockDatabase)};
})}
async function save(options={}){
 if(saving)return false;
 saving=true;document.documentElement.setAttribute('aria-busy','true');
 try{return await databaseLock(()=>commitSave(options))}
 catch(e){return rejectSave('Não foi possível salvar neste navegador. Tente novamente.')}
 finally{saving=false;document.documentElement.removeAttribute('aria-busy')}
}
// The database transaction serializes short writes across windows, without an editing mode.
for(const type of ['click','submit','change','input'])document.addEventListener(type,e=>{if(saving){e.preventDefault();e.stopImmediatePropagation()}},true);
function reloadStoredData(notify=true){
 try{
  const raw=localStorage.getItem(KEY);const r=loadRaw(raw);
  if(r.dropped.length){quarantine(raw,r.dropped);loadNotice=r.dropped.length+' item(ns) inválido(s) foram separados e o restante foi carregado.'}
  state=r.state;committedState=JSON.parse(JSON.stringify(state));loadedRaw=raw;recoveryBlocked=false;readFailure=false;
  $('storageError').hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();refreshStorageUI();checkClock();
  if(loadNotice){storageWarning(loadNotice);loadNotice=''}else if(notify)toast('Dados recarregados.');return true;
 }catch(e){
  try{loadedRaw=localStorage.getItem(KEY);recoveryRaw=loadedRaw;readFailure=false}catch{readFailure=true}
  recoveryBlocked=true;state=JSON.parse(JSON.stringify(committedState));refreshStorageUI();
  storageWarning(readFailure?'Não foi possível acessar os dados. A gravação está bloqueada até a leitura ser restabelecida.':'Os dados não passaram na validação. Exporte o original protegido ou restaure um backup. Nada foi apagado.');return false;
 }
}
function acquireEditor(){writerHeld=true;return true}
$('reloadStored').onclick=()=>reloadStoredData();
function downloadText(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('exportProtected').onclick=()=>{
 let original=recoveryRaw;try{if(original===null)original=localStorage.getItem(RECOVERY_KEY)}catch{}
 if(original===null){toast('Não foi possível ler o original. Tente Recarregar dados.');return}
 downloadText(original,'intervalo-original-protegido.json');toast('Download do original preparado. Confira o arquivo nos downloads.');
};
$('recoveryImport').onclick=()=>{$('importFile').click()};
$('recoveryReset').onclick=()=>confirm('Começar com dados vazios? O conteúdo original será preservado em uma cópia de recuperação neste navegador. Exporte-o antes se quiser guardar fora do aparelho.',async ()=>{state=defaults();if(!await save({recover:true}))return;noteDirty=false;render();toast('Novo diário criado. O original protegido continua disponível para exportar.')},'Preservar e recomeçar');
// Structural validity is independent of the wall clock. Temporal anomalies are informational.
let wallBaseline=Date.now(),monotonicBaseline=performance.now(),lastClockScan=0,clockNotice='';
function checkClock(){
 const now=Date.now(),monotonic=performance.now(),difference=(now-wallBaseline)-(monotonic-monotonicBaseline);
 if(Math.abs(difference)>60000){clockNotice='O relógio do aparelho mudou. Seus registros foram preservados; confira os horários antes de continuar.';wallBaseline=now;monotonicBaseline=monotonic;lastClockScan=0}
 if(!lastClockScan||monotonic-lastClockScan>30000){lastClockScan=monotonic||1;
  const ahead=state.active?.start>now+60000||state.records.some(r=>r.end>now+60000)||state.water.some(w=>w.time>now+60000)||state.meals.some(m=>m.day>dayKey());
  if(ahead)clockNotice='Há registros posteriores ao relógio atual. Eles foram preservados. Confira a data, o fuso e os horários do aparelho.';
 }
 $('clockWarning').hidden=!clockNotice;$('clockWarning').textContent=clockNotice;if(clockNotice)$('storagePanel').hidden=false;
}
render();refreshStorageUI();checkClock();acquireEditor();setInterval(tick,1000);if(loadNotice&&!recoveryBlocked){storageWarning(loadNotice);loadNotice=''}


