/* ===== v14: peso, primeiro uso guiado, instalação ===== */
(()=>{
const kg1=n=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
const dShort=k=>parseDay(k).toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','');
let wRange=30;
const wSorted=()=>[...state.weights].sort((a,b)=>a.day<b.day?-1:a.day>b.day?1:0);
function chart(pts,target){
 if(!pts.length)return '<p class="w-empty">Sem registros nesse período.</p>';
 const W=320,H=150,L=8,R=8,T=14,B=26;
 const vals=pts.map(p=>p.kg).concat(target?[target]:[]);let lo=Math.min(...vals),hi=Math.max(...vals);if(hi-lo<1){const m=(hi+lo)/2;lo=m-.5;hi=m+.5}const pad=(hi-lo)*.15;lo-=pad;hi+=pad;
 const t0=parseDay(pts[0].day).getTime(),t1=parseDay(pts.at(-1).day).getTime(),span=t1-t0;
 const X=p=>pts.length===1||!span?W/2:L+(parseDay(p.day).getTime()-t0)/span*(W-L-R),Y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
 const line=pts.map((p,i)=>(i?'L':'M')+X(p).toFixed(1)+' '+Y(p.kg).toFixed(1)).join(' ');
 const area=pts.length>1?line+' L'+X(pts.at(-1)).toFixed(1)+' '+(H-B)+' L'+X(pts[0]).toFixed(1)+' '+(H-B)+' Z':'';
 let g='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gráfico de peso, de '+kg1(pts[0].kg)+' kg em '+dShort(pts[0].day)+' a '+kg1(pts.at(-1).kg)+' kg em '+dShort(pts.at(-1).day)+'">';
 g+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+(H-B)+'" y2="'+(H-B)+'"/>';
 if(target&&target>=lo&&target<=hi)g+='<line class="tg" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(target).toFixed(1)+'" y2="'+Y(target).toFixed(1)+'"/><text class="tgt" x="'+(W-R)+'" y="'+(Y(target)-5).toFixed(1)+'" text-anchor="end">meta '+kg1(target)+'</text>';
 if(area)g+='<path class="ar" d="'+area+'"/>';
 if(pts.length>1)g+='<path class="ln" d="'+line+'"/>';
 pts.forEach((p,i)=>{g+='<circle class="pt'+(i===pts.length-1?' last':'')+'" cx="'+X(p).toFixed(1)+'" cy="'+Y(p.kg).toFixed(1)+'" r="'+(i===pts.length-1?6:pts.length>40?2.5:4)+'"/>'});
 g+='<text x="'+L+'" y="'+(H-8)+'">'+dShort(pts[0].day)+'</text>';if(pts.length>1)g+='<text x="'+(W-R)+'" y="'+(H-8)+'" text-anchor="end">'+dShort(pts.at(-1).day)+'</text>';
 return g+'</svg>';
}
function renderWeight(){
 const all=wSorted(),cut=wRange?dayKey(Date.now()-wRange*864e5):'',pts=all.filter(w=>w.day>=cut),last=all.at(-1);
 $('weightNow').replaceChildren();
 if(!last){$('weightNow').textContent='—';$('weightSub').textContent='Registre seu peso para ver a tendência.';$('weightChart').innerHTML='<p class="w-empty">Seu gráfico aparece aqui depois do primeiro registro.</p>';$('weightList').replaceChildren();$('weightRange').hidden=true;return}
 $('weightRange').hidden=false;
 $('weightNow').append(kg1(last.kg),el('small','kg'));
 const first=pts[0];let sub=dShort(last.day);
 if(first&&first!==last){const d=last.kg-first.kg;sub=(d>0?'+':d<0?'−':'')+kg1(Math.abs(d))+' kg desde '+dShort(first.day)}
 if(state.targetKg){const r=last.kg-state.targetKg;sub+=' · '+(Math.abs(r)<.05?'meta atingida':kg1(Math.abs(r))+' kg '+(r>0?'para a meta':'abaixo da meta'))}
 $('weightSub').textContent=sub;
 $('weightChart').innerHTML=chart(pts,state.targetKg);
 $('weightList').replaceChildren(...all.slice(-4).reverse().map(w=>{const b=el('button');b.type='button';b.append(el('strong',dayLabelShort(w.day)),el('span',kg1(w.kg)+' kg'+(w.waist?' · cintura '+kg1(w.waist)+' cm':'')));b.onclick=()=>openWeight(w.day);return b}));
}
function dayLabelShort(k){return parseDay(k).toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'')}
const _rh=renderHistory;renderHistory=function(){_rh.apply(this,arguments);renderWeight()};
document.querySelectorAll('#weightRange button').forEach(b=>b.onclick=()=>{wRange=+b.dataset.range;document.querySelectorAll('#weightRange button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderWeight()});
function fillWeight(day){const w=state.weights.find(x=>x.day===day);$('weightKg').value=w?w.kg:(wSorted().at(-1)?.kg??'');$('weightWaist').value=w?.waist??'';$('weightDelete').hidden=!w;$('weightTitle').textContent=w?'Editar peso':'Registrar peso'}
function openWeight(day){$('weightDay').max=dayKey();$('weightDay').value=day||dayKey();fillWeight($('weightDay').value);$('weightTarget').value=state.targetKg??'';$('weightError').textContent='';openDialog('weightDialog');setTimeout(()=>$('weightKg').select?.(),60)}
$('weightDay').onchange=()=>{if($('weightDay').value)fillWeight($('weightDay').value)};
$('addWeight').onclick=()=>openWeight();$('openWeight').onclick=()=>openWeight();
$('qWeight').onclick=()=>{$('quickDialog').close();openWeight()};
const _fab=$('fab').onclick;$('fab').onclick=()=>{const t=wSorted().at(-1);$('qWeightSub').textContent=t?'Último: '+kg1(t.kg)+' kg':'Registrar hoje';_fab()};
$('weightForm').onsubmit=async e=>{e.preventDefault();const day=$('weightDay').value,kg=Math.round(parseFloat($('weightKg').value)*10)/10,wRaw=$('weightWaist').value,waist=wRaw===''?null:Math.round(parseFloat(wRaw)*2)/2,tRaw=$('weightTarget').value,target=tRaw===''?null:Math.round(parseFloat(tRaw)*10)/10;
 const err=m=>{$('weightError').textContent=m};
 if(!day||!validDay(day)||day>dayKey())return err('Escolha um dia que já aconteceu.');
 if(!Number.isFinite(kg)||kg<20||kg>500)return err('Informe o peso entre 20 e 500 kg.');
 if(waist!==null&&!(waist>=20&&waist<=300))return err('A cintura deve ficar entre 20 e 300 cm.');
 if(target!==null&&!(target>=20&&target<=500))return err('A meta deve ficar entre 20 e 500 kg.');
 const old=state.weights.find(w=>w.day===day);
 if(old){old.kg=kg;old.waist=waist}else{if(state.weights.length>=5000)return err('Limite de registros atingido. Exporte um backup e apague os mais antigos.');state.weights.push({id:id(),day,kg,waist})}
 state.targetKg=target;
 if(!await save())return;$('weightDialog').close();render();if(!$('page-history').hidden)renderHistory();toast('Peso salvo')};
$('weightDelete').onclick=()=>{const day=$('weightDay').value;$('weightDialog').close();confirm('Excluir o peso de '+dayLabelShort(day)+'?',async()=>{state.weights=state.weights.filter(w=>w.day!==day);if(!await save())return;render();if(!$('page-history').hidden)renderHistory();toast('Registro excluído')},'Excluir')};

// ----- primeiro uso -----
let step=1,obHours=16;
const obDlg=$('onboardDialog');
function obShow(n){step=n;obDlg.querySelectorAll('[data-ob]').forEach(s=>s.hidden=+s.dataset.ob!==n);obDlg.querySelectorAll('.ob-dots i').forEach((d,i)=>d.classList.toggle('on',i===n-1));$('obBack').hidden=n===1;$('obNext').textContent=n===3?'Começar':'Continuar'}
function obOpen(){const t=$('obTata');if(!t.firstElementChild){const tp=document.getElementById('tataTpl').content.firstElementChild.cloneNode(true);tp.setAttribute('data-pose','walk');tp.setAttribute('data-mood','happy');t.append(tp)}
 $('obName').value=state.profile.name;obHours=state.hours||16;obDlg.querySelectorAll('#obHours button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.h===obHours));obShow(1);openDialog('onboardDialog')}
$('obHours').onclick=e=>{const b=e.target.closest('button');if(!b)return;obHours=+b.dataset.h;obDlg.querySelectorAll('#obHours button').forEach(x=>x.setAttribute('aria-pressed',x===b))};
$('obBack').onclick=()=>obShow(step-1);
async function obDone(){
 state.profile={...state.profile,name:$('obName').value.trim().slice(0,40)};
 if(step>=2||true){state.hours=obHours;state.fastCustom=false;state.fastOpen=false;const st=/^([01]\d|2[0-3]):[0-5]\d$/.test($('obStart').value)?$('obStart').value:'20:00';state.plan={start:st,hours:obHours,days:[0,1,2,3,4,5,6]}}
 const kcal=parseInt($('obKcal').value,10);if(Number.isInteger(kcal)&&kcal>=500&&kcal<=10000)state.goals={...state.goals,kcal};
 const kg=Math.round(parseFloat($('obKg').value)*10)/10;if(Number.isFinite(kg)&&kg>=20&&kg<=500){const t=dayKey(),o=state.weights.find(w=>w.day===t);if(o)o.kg=kg;else state.weights.push({id:id(),day:t,kg,waist:null})}
 state.onboarded=true;
 if(!await save())return;obDlg.close();render();toast(state.profile.name?'Tudo pronto, '+state.profile.name+'!':'Tudo pronto!')}
$('obNext').onclick=()=>{if(step<3)obShow(step+1);else obDone()};
$('obSkip').onclick=async()=>{state.onboarded=true;if(!await save())return;obDlg.close();render()};
obDlg.addEventListener('cancel',e=>{e.preventDefault();$('obSkip').click()});
$('replayIntro').onclick=obOpen;
if(!state.onboarded&&!recoveryBlocked&&!readFailure)setTimeout(obOpen,350);

// ----- instalação -----
let deferred=null;
const native=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const standalone=native||matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function installText(){const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 $('installBtn').hidden=!deferred;
 $('installText').textContent=standalone?'Você já está usando o app instalado.':deferred?'Instale para abrir em tela cheia, com ícone na tela inicial.':ios?'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.':location.protocol==='file:'?'Para instalar, publique os arquivos que acompanham o app em um endereço https. Veja o guia INSTALAR.md.':'No menu do navegador, escolha Instalar app ou Adicionar à tela inicial.'}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;installText()});
addEventListener('appinstalled',()=>{deferred=null;installText();toast('Intervalo instalado')});
$('installBtn').onclick=async()=>{if(!deferred)return;deferred.prompt();try{await deferred.userChoice}catch{}deferred=null;installText()};
installText();
if(native){$('export').onclick=async()=>{try{const P=window.Capacitor.Plugins,name='intervalo-backup-'+new Date().toISOString().slice(0,10)+'.json';const r=await P.Filesystem.writeFile({path:name,data:JSON.stringify(state,null,2),directory:'CACHE',encoding:'utf8'});await P.Share.share({title:'Backup do Intervalo',url:r.uri,dialogTitle:'Salvar backup'});$('backupStatus').textContent='Backup pronto. Escolha onde salvar.'}catch(e){if(!/cancel/i.test(String(e&&e.message)))$('backupStatus').textContent='Não consegui gerar o backup. Tente de novo.'}}}
if(/^https?:$/.test(location.protocol)&&!native){
 try{const l=document.createElement('link');l.rel='manifest';l.href='manifest.webmanifest';document.head.append(l);
  const a=document.createElement('link');a.rel='apple-touch-icon';a.href='icon-192.png';document.head.append(a);
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})}catch{}
}
})();
