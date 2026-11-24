/* ===== v22: jejum sem meta, até 168h, contagem por dia, fases longas, voltar do Android, backups automáticos ===== */
/* ---------- duração (substitui as versões anteriores) ---------- */
function durSync(h,custom,open){
 if(open===undefined)open=state.active?state.active.open===true:state.fastOpen===true;
 durSel=open?'open':custom||!DUR_PRESETS.includes(String(h))?'custom':String(h);
 document.querySelectorAll('#durChips button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.h===durSel)));
 $('durCustom').hidden=durSel!=='custom';
 if(durSel==='custom'){const H=Math.floor(h+1e-9),M=Math.round((h-H)*60);$('durH').value=H;$('durM').value=String(M-M%5)}
 durNote()}
function durValue(){if(durSel==='open')return state.hours;if(durSel==='custom'){const H=parseInt($('durH').value,10),M=parseInt($('durM').value,10)||0;return Number.isFinite(H)?H+M/60:NaN}return Number(durSel)}
function durNote(){const h=durValue();$('durError').textContent='';
 $('durNote').textContent=durSel==='open'?'O cronômetro só conta. Você encerra quando quiser, e o jejum entra na sequência quando passa de 12 horas.'
  :Number.isFinite(h)&&h>72?'Acima de 3 dias, faça só com acompanhamento de um profissional de saúde.'
  :Number.isFinite(h)&&h>24?'Jejuns de mais de 24 horas pedem cuidado. Converse antes com um profissional de saúde.'
  :durSel==='custom'?'Jejum personalizado: conta na sequência quando passa de 12 horas.':'Conta na sequência quando você chega na meta.'}
async function saveDuration(){const open=durSel==='open',h=durValue(),custom=durSel==='custom';
 if(!open&&!okHours(h)){$('durError').textContent='Escolha entre 1 e 168 horas.';return}
 if(!open)state.hours=h;state.fastCustom=custom;state.fastOpen=open;
 if(state.active){if(!open)state.active.hours=h;state.active.custom=custom;state.active.open=open}
 if(!await save())return;$('durationDialog').close();render();toast(open?'Jejum sem meta: encerre quando quiser':'Duração: '+hLabel(h)+(custom?', personalizado':''))}

/* ---------- contagem por dia ---------- */
function qualifies(r){const d=r.end-r.start;return r.custom===true||r.open===true?d>=12*HOUR:d>=r.hours*HOUR-1000}
function coveredDays(start,end){const out=new Set([dayKey(end)]),d=new Date(start);d.setHours(0,0,0,0);d.setDate(d.getDate()+1);
 for(let i=0;i<400;i++){const nx=new Date(d);nx.setDate(d.getDate()+1);if(nx.getTime()>end)break;out.add(dayKey(d));d.setDate(d.getDate()+1)}return out}
function fastList(){const l=state.records.slice();if(state.active&&state.active.start<Date.now())l.push({...state.active,end:Date.now(),live:true});return l}
function countedDays(){const s=new Set();for(const r of fastList())if(qualifies(r))for(const k of coveredDays(r.start,r.end))s.add(k);return s}
function hoursByDay(r){const out=new Map();let t=r.start;while(t<r.end){const d=new Date(t);d.setHours(24,0,0,0);const stop=Math.min(d.getTime(),r.end);const k=dayKey(t);out.set(k,(out.get(k)||0)+(stop-t)/HOUR);t=stop}return out}
function streakInfo(){const days=countedDays();const d=new Date();d.setHours(12,0,0,0);const todayDone=days.has(dayKey(d));if(!todayDone)d.setDate(d.getDate()-1);
 let n=0,lastGap=-99,prevMissing=false;
 for(let step=0;step<3000;step++){const k=dayKey(d);if(days.has(k)){n++;prevMissing=false}else{if(n===0||prevMissing||step-lastGap<7)break;lastGap=step;prevMissing=true}d.setDate(d.getDate()-1)}
 return {n,todayDone,days}}

/* ---------- fases longas ---------- */
PHASES[5].name='Jejum longo';PHASES[5].line='Jejum longo. Beba água e se escute.';PHASES[5].text='A partir daqui os efeitos variam muito de pessoa para pessoa. Beba água e encerre se não se sentir bem.';
PHASES.push(
 {h:24,name:'Um dia inteiro',line:'Um dia inteiro! Água por perto, combinado?',text:'Para muita gente, a troca de combustível já aconteceu e a gordura virou a principal fonte de energia. Hidrate-se.'},
 {h:36,name:'Troca concluída',line:'Já passamos de um dia e meio. Vá com calma.',text:'O estudo de referência descreve a troca metabólica até cerca de 36 horas. Tontura, fraqueza ou mal-estar são sinais para encerrar.'},
 {h:48,name:'Jejum prolongado',line:'Dois dias. Se algo não estiver bem, pode parar.',text:'Jejum prolongado. Cuide da água e dos sais minerais e encerre se não se sentir bem.'},
 {h:72,name:'Três dias ou mais',line:'Três dias. Só com acompanhamento, tá?',text:'Acima de 3 dias, o jejum deve ser feito com acompanhamento de um profissional de saúde.'});

function renderPhase(){const a=state.active,strip=$('phaseStrip'),sc=$('tscene');
 if(!a||a.start>Date.now()){strip.hidden=true;sc.dataset.phase='';lastPhase=-1;return}
 const h=(Date.now()-a.start)/HOUR,idx=phaseIdx(h),open=a.open===true;
 const max=open?([24,36,48,72,96,120,144,168].find(x=>x>h+.01)||Math.ceil(h/24)*24+24):Math.max(24,a.hours);
 if(max!==psMax){psMax=max;const t=$('psTrack');t.replaceChildren();PHASES.filter(p=>p.h<max).forEach((p,k,arr)=>{const end=k<arr.length-1?arr[k+1].h:max,seg=el('span',undefined,'seg');seg.style.flexGrow=end-p.h;seg.dataset.a=p.h;seg.dataset.b=end;seg.append(el('i'));t.append(seg)});t.append(el('span',undefined,'goal'))}
 $('psTrack').querySelectorAll('.seg').forEach(s=>{const A=+s.dataset.a,B=+s.dataset.b;s.firstChild.style.transform='scaleX('+Math.max(0,Math.min(1,(h-A)/(B-A))).toFixed(4)+')'});
 const g=$('psTrack').querySelector('.goal');g.hidden=open;if(!open)g.style.left='calc('+(Math.min(a.hours,max)/max*100).toFixed(2)+'% - 1.5px)';
 strip.hidden=false;sc.dataset.phase=String(Math.min(idx,5));
 $('psName').textContent='Fase '+(idx+1)+' de '+PHASES.length+' · '+PHASES[idx].name;
 $('psNext').textContent=idx<PHASES.length-1?'próxima em '+duration((PHASES[idx+1].h-h)*HOUR):'fase final';
 strip.setAttribute('aria-label','Fase do jejum: '+PHASES[idx].name+'. Toque para ver todas as fases.');
 if(idx!==lastPhase){const first=lastPhase===-1;lastPhase=idx;setTimeout(()=>{if(!window.tataBusy?.())window.tataSay?.(PHASES[idx].line,6000)},first?1200:60)}}

/* ---------- jardim e semana (contagem por dia) ---------- */
function renderGarden(){const panel=document.querySelector('.calendar-panel');if(!panel)return;panel.classList.toggle('garden-mode',histView==='garden');
 document.querySelectorAll('#histView button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===histView)));if(histView!=='garden')return;
 const g=$('garden');g.replaceChildren();for(const l of ['D','S','T','Q','Q','S','S'])g.append(el('span',l,'wd'));
 const today=new Date();today.setHours(12,0,0,0);const tk=dayKey(today),startD=new Date(today);startD.setDate(startD.getDate()-startD.getDay()-49);
 const flower=countedDays(),sprout=new Set();for(const r of fastList())for(const k of hoursByDay(r).keys())sprout.add(k);
 const water=new Map();for(const w of state.water){const k=dayKey(w.time);water.set(k,(water.get(k)||0)+w.ml)}const wg=state.waterGoal||0;
 for(let i=0;i<56;i++){const d=new Date(startD);d.setDate(startD.getDate()+i);const k=dayKey(d),fut=k>tk,b=el('button',undefined,'g-day'+(k===tk?' today':''));b.type='button';b.disabled=fut;
  if(!fut){const kind=flower.has(k)?'flower':sprout.has(k)?'sprout':'soil';b.innerHTML=G_ICON[kind];const wet=wg>0&&(water.get(k)||0)>=wg;if(wet)b.append(el('span',undefined,'gd'));
   b.setAttribute('aria-label',dayLabel(k)+', '+({flower:'dia que conta na sequência',sprout:'dia com jejum',soil:'sem jejum'})[kind]+(wet?', meta de água batida':''));b.setAttribute('aria-pressed',String(k===selectedDay));
   b.onclick=()=>{selectedDay=k;renderHistory();document.querySelector('.day-details')?.scrollIntoView?.({block:'nearest',behavior:'smooth'})}}
  if(fut)b.setAttribute('aria-label',dayLabel(k)+', ainda não chegou');g.append(b)}}
function renderWeek(){const s0=new Date();s0.setHours(12,0,0,0);s0.setDate(s0.getDate()-s0.getDay()+wkOff*7);const days=[];for(let i=0;i<7;i++){const d=new Date(s0);d.setDate(s0.getDate()+i);days.push(dayKey(d))}
 const tk=dayKey(),past=days.filter(k=>k<=tk),fmt=k=>parseDay(k).toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','');
 $('wkNext').disabled=wkOff>=0;$('wkRange').textContent=(wkOff===0?'Esta semana · ':wkOff===-1?'Semana passada · ':'')+fmt(days[0])+' a '+fmt(days[6]);
 const per=new Map();for(const r of fastList())for(const [k,v] of hoursByDay(r))per.set(k,(per.get(k)||0)+v);
 const counted=countedDays(),hours=days.map(k=>Math.min(24,per.get(k)||0)),ok=days.map(k=>counted.has(k));
 const W=320,H=118,B=20,T=8,bw=26,gap=(W-7*bw)/7,goalH=state.fastOpen?12:Math.min(24,state.hours),maxH=24,Y=v=>T+(1-v/maxH)*(H-T-B);
 let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Horas de jejum em cada dia da semana">';
 days.forEach((k,i)=>{const x=gap/2+i*(bw+gap),v=hours[i],y=Y(v);svg+='<rect class="bar'+(ok[i]?' ok':'')+'" x="'+x.toFixed(1)+'" y="'+(v?y:H-B-3).toFixed(1)+'" width="'+bw+'" height="'+(v?H-B-y:3).toFixed(1)+'" rx="6"/><text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle"'+(k===tk?' class="today"':'')+'>'+['D','S','T','Q','Q','S','S'][i]+'</text>'});
 svg+='<line class="goal" x1="0" x2="'+W+'" y1="'+Y(goalH).toFixed(1)+'" y2="'+Y(goalH).toFixed(1)+'"/></svg>';$('wkChart').innerHTML=svg;
 const mealDays=past.filter(k=>dayMeals(k).length),kcal=mealDays.map(k=>mealTotal(dayMeals(k)).kcal),prot=mealDays.map(k=>mealTotal(dayMeals(k)).protein),avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
 const recs=state.records.filter(r=>days.includes(dayKey(r.end))),durs=recs.map(r=>(r.end-r.start)/HOUR),waterAvg=past.length?past.reduce((t,k)=>t+totalsFor(k),0)/past.length:NaN;
 const ws=[...state.weights].sort((a,b)=>a.day<b.day?-1:1),wIn=ws.filter(w=>w.day<=days[6]),wEnd=wIn.at(-1),wPrev=ws.filter(w=>w.day<days[0]).at(-1)||wIn.find(w=>w.day>=days[0]);
 let wTxt='—',wSub='sem registro';if(wEnd&&wPrev&&wEnd!==wPrev&&wEnd.day>=days[0]){const dlt=wEnd.kg-wPrev.kg;wTxt=(dlt>0?'+':dlt<0?'−':'')+nfmt(Math.abs(Math.round(dlt*10)/10))+' kg';wSub='agora '+nfmt(wEnd.kg)+' kg'}else if(wEnd&&wEnd.day>=days[0]){wTxt=nfmt(wEnd.kg)+' kg';wSub='um registro'}
 const tile=(label,big,sub)=>{const d=el('div');d.append(el('small',label),el('b',big));if(sub)d.append(el('span',sub));return d};
 $('wkGrid').replaceChildren(
  tile('Dias que contam',ok.filter(Boolean).length+' de 7',past.length<7?past.length+(past.length===1?' dia':' dias')+' até agora':''),
  tile('Média de jejum',durs.length?hLabel(Math.round(avg(durs)*12)/12):'—',durs.length?durs.length+(durs.length===1?' jejum encerrado':' jejuns encerrados'):'nenhum encerrado'),
  tile('Calorias por dia',kcal.length?nfmt(Math.round(avg(kcal)))+' kcal':'—',kcal.length?'em '+kcal.length+(kcal.length===1?' dia':' dias')+' com registro':'sem refeições'),
  tile('Proteína por dia',prot.length?nfmt(Math.round(avg(prot)))+' g':'—',state.goals.protein?'referência '+state.goals.protein+' g':''),
  tile('Água por dia',Number.isFinite(waterAvg)&&waterAvg>0?nfmt(Math.round(waterAvg/10)*10)+' ml':'—',state.waterGoal?'referência '+nfmt(state.waterGoal)+' ml':''),
  tile('Peso',wTxt,wSub))}

/* ---------- lembretes: sem meta ---------- */
const _remPlan=REM.plan.bind(REM);
REM.plan=function(){let out=_remPlan();const a=state.active,r=state.reminders||defaultReminders();
 if(a&&a.open){out=out.filter(x=>x.id!==1001);const at=a.start+12*HOUR;if(r.fastEnd&&at>Date.now()+30000)out.unshift({id:1003,at,title:'Seu jejum já conta na sequência',body:'12 horas de jejum. Continue no seu ritmo ou encerre quando quiser.'})}
 return out};

/* ---------- copias automáticas (IndexedDB) ---------- */
const AB={db:null,
 open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{let rq;try{rq=indexedDB.open('intervalo-backups',1)}catch(e){rej(e);return}rq.onupgradeneeded=()=>rq.result.createObjectStore('snaps',{keyPath:'day'});rq.onsuccess=()=>{this.db=rq.result;res(this.db)};rq.onerror=()=>rej(rq.error)})},
 async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('snaps',mode),st=t.objectStore('snaps');let out;Promise.resolve(fn(st)).then(v=>out=v);t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error)})},
 async list(){return this.tx('readonly',st=>new Promise(r=>{const q=st.getAll();q.onsuccess=()=>r((q.result||[]).sort((a,b)=>b.day<a.day?-1:1))}))},
 async snap(){if(recoveryBlocked||readFailure)return;const json=JSON.stringify(state);if(!state.records.length&&!state.meals.length&&!state.water.length)return;const day=dayKey();
  try{await this.tx('readwrite',st=>{st.put({day,at:Date.now(),size:json.length,records:state.records.length,meals:state.meals.length,json})});const all=await this.list();for(const old of all.slice(7))await this.tx('readwrite',st=>st.delete(old.day))}catch{}},
 t:0,soon(){clearTimeout(this.t);this.t=setTimeout(()=>this.snap(),4000)}};
async function renderAutoBackups(){const box=$('autoBackupList');if(!box)return;let all=[];try{all=await AB.list()}catch{box.replaceChildren(el('p','Este navegador não permite cópias automáticas.','helper'));return}
 if(!all.length){box.replaceChildren(el('p','Nenhuma cópia ainda. A primeira é feita assim que você registrar algo.','helper'));return}
 box.replaceChildren(...all.map(s=>{const row=el('div',undefined,'ab-row'),info=el('div'),b=el('button','Restaurar','secondary');info.append(el('span',dayLabel(s.day)),el('small',s.records+' jejuns · '+s.meals+' refeições · '+new Date(s.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})));b.type='button';
  b.onclick=()=>confirm('Voltar os dados para a cópia de '+dayLabel(s.day).toLowerCase()+'? O que foi registrado depois dela será perdido.',async()=>{let r;try{r=loadRaw(s.json)}catch{toast('Essa cópia está danificada.');return}state=r.state;if(!await save({recover:recoveryBlocked}))return;noteDirty=false;render();toast('Dados restaurados')},'Restaurar');
  row.append(info,b);return row}))}
function lastExportText(){let t=0;try{t=Number(localStorage.getItem('intervalo-lastexport'))||0}catch{}const el2=$('lastExport');if(!el2)return t;
 el2.textContent=t?'Última cópia fora do aparelho: '+(Date.now()-t<864e5?'hoje':'há '+Math.floor((Date.now()-t)/864e5)+' dias')+'.':'Você ainda não fez uma cópia fora do aparelho.';return t}

/* ---------- ligações ---------- */
(()=>{
 const native=!!window.Capacitor?.isNativePlatform?.();
 // duração: "sem meta"
 $('durChips').onclick=e=>{const b=e.target.closest('button');if(!b)return;const v=b.dataset.h;
  if(v==='open'){durSel='open';document.querySelectorAll('#durChips button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('durCustom').hidden=true;durNote();return}
  if(v==='custom'){const cur=durSel==='open'?state.hours:durValue();durSel='custom';document.querySelectorAll('#durChips button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('durCustom').hidden=false;const h=Number.isFinite(cur)?cur:state.hours;$('durH').value=Math.floor(h);$('durM').value=String(Math.round((h-Math.floor(h))*60)-Math.round((h-Math.floor(h))*60)%5);durNote();setTimeout(()=>$('durH').focus(),40);return}
  durSync(Number(v),false,false)};
 // jejum passado
 const _er=editRecord;editRecord=function(r){_er(r);$('recordCustom').checked=!!(r&&(r.custom||r.open))};
 // tela inicial e painel de duração com "sem meta"
 const _rht=renderHomeTimer;renderHomeTimer=function(){_rht();const a=state.active,open=a?a.open===true:state.fastOpen===true;if(!open)return;const el_=a?Date.now()-a.start:0;
  $('homePlan').textContent='Sem meta';if(!a){$('homeTimer').textContent='Sem meta';$('homeTimerLabel').textContent='Você para quando quiser'}
  $('miniRing').style.setProperty('--progress',Math.min(100,el_/(12*HOUR)*100)+'%');if(a)$('homeFastFooter').textContent=el_>=12*HOUR?'Já conta na sequência. Encerre quando quiser.':'Conta na sequência a partir de 12h.'};
 const _render=render;render=function(){_render.apply(this,arguments);const a=state.active,open=a?a.open===true:state.fastOpen===true;
  if(open){$('durationValue').textContent='Sem meta';$('fastLegend').textContent='Sem duração definida';$('otherLegend').textContent='';$('dayFill').style.width='0%'}
  else if(!a||!a.open){const s=$('durationValue').nextElementSibling;if(s)s.textContent='de jejum planejado'}
  AB.soon();lastExportText()};
 // voltar do Android: fecha a janela de cima, depois volta ao Diário, depois sai
 const stack=[];const _od=openDialog;openDialog=function(id){_od(id);const d=$(id);if(!d)return;const i=stack.indexOf(id);if(i>=0)stack.splice(i,1);stack.push(id);if(!d.dataset.stk){d.dataset.stk='1';d.addEventListener('close',()=>{const j=stack.indexOf(d.id);if(j>=0)stack.splice(j,1)})}};
 window.handleBack=function(){const openIds=stack.filter(x=>$(x)?.open);let top=openIds.length?$(openIds.at(-1)):[...document.querySelectorAll('dialog[open]')].at(-1);
  if(top){const ev=new Event('cancel',{cancelable:true});top.dispatchEvent(ev);if(!ev.defaultPrevented&&top.open)top.close();return true}
  const cur=[...document.querySelectorAll('.page')].find(p=>!p.hidden)?.id;if(cur&&cur!=='page-home'){showPage('home');return true}return false};
 const App=native&&window.Capacitor.Plugins?.App;
 if(App?.addListener)App.addListener('backButton',()=>{if(!window.handleBack())App.exitApp()});
 // microfone no APK: o Android não oferece ditado dentro do app, então usamos o microfone do teclado
 const hasSpeech=!!(globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition);
 if(!hasSpeech){const _ov=openVoice;openVoice=function(){_ov();$('speechStatus').textContent='Toque no microfone do teclado para ditar, ou escreva. Ex.: 2 ovos e 1 pão francês.';setTimeout(()=>{try{$('mealSpeech').focus()}catch{}},250)}}
 // leitor de código de barras carregado só quando a câmera abre
 const _sos=startOfflineScanner;startOfflineScanner=async function(){$('scanStatus').textContent='Preparando o leitor…';const ok=await ensureZXing();if(!ok){$('scanStatus').textContent='Não consegui carregar o leitor agora. Digite os números do código.';$('manualBarcode').open=true;return}return _sos.apply(this,arguments)};
 const _bp=$('barcodePhoto').onchange;$('barcodePhoto').onchange=async e=>{await ensureZXing();return _bp(e)};
 // backups
 const _ex=$('export').onclick;$('export').onclick=async(...a)=>{const r=await _ex(...a);try{localStorage.setItem('intervalo-lastexport',String(Date.now()))}catch{}lastExportText();return r};
 $('autoBackups').addEventListener('toggle',()=>{if($('autoBackups').open)renderAutoBackups()});
 const t=lastExportText();let nag=0;try{nag=Number(localStorage.getItem('intervalo-backupnag'))||0}catch{}
 const hasData=state.records.length+state.meals.length+state.water.length>5;
 if(hasData&&Date.now()-t>14*864e5&&Date.now()-nag>3*864e5)setTimeout(()=>{toast(t?'Faz '+Math.floor((Date.now()-t)/864e5)+' dias sem cópia fora do aparelho. Exporte em Perfil.':'Faça uma cópia dos seus dados fora do aparelho em Perfil.');try{localStorage.setItem('intervalo-backupnag',String(Date.now()))}catch{}},5000);
 AB.snap();render();
})();
