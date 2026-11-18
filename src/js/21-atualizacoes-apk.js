/* ===== v21: aviso de atualização do APK (releases do GitHub) ===== */
const APP_VERSION='__APP_VERSION__',APP_REPO='__APP_REPO__';
(()=>{const native=!!window.Capacitor?.isNativePlatform?.(),built=/^\d+\.\d+$/.test(APP_VERSION)&&/^[\w.-]+\/[\w.-]+$/.test(APP_REPO);
 if(!native||!built)return;
 const row=$('updateRow');row.hidden=false;$('updateText').textContent='Versão instalada: '+APP_VERSION+'.';
 const num=v=>{const m=String(v).match(/(\d+)\.(\d+)/);return m?Number(m[1])*100000+Number(m[2]):0};let latest=null;
 async function check(manual){$('updateStatus').textContent=manual?'Procurando…':'';
  try{const r=await fetch('https://api.github.com/repos/'+APP_REPO+'/releases/latest',{headers:{Accept:'application/vnd.github+json'}});if(!r.ok)throw Error(r.status);const d=await r.json();
   const apk=(d.assets||[]).find(a=>/\.apk$/i.test(a.name));latest={ver:String(d.tag_name||'').replace(/^v/,''),url:apk?.browser_download_url||d.html_url,page:d.html_url};
   try{localStorage.setItem('intervalo-updcheck',String(Date.now()))}catch{}
   if(num(latest.ver)>num(APP_VERSION)){$('updateGet').hidden=false;$('updateGet').textContent='Baixar a versão '+latest.ver;$('updateStatus').textContent='Tem versão nova. Baixe e instale por cima: seus dados continuam no aparelho.';if(!manual)toast('Nova versão '+latest.ver+' do Intervalo. Veja em Perfil.')}
   else{$('updateGet').hidden=true;$('updateStatus').textContent=manual?'Você já está na versão mais nova.':''}}
  catch(e){if(manual)$('updateStatus').textContent=navigator.onLine===false?'Sem internet agora.':'Não consegui verificar agora. Tente mais tarde.'}}
 $('updateCheck').onclick=()=>check(true);
 $('updateGet').onclick=()=>{if(latest?.url)location.href=latest.url};
 let last=0;try{last=Number(localStorage.getItem('intervalo-updcheck'))||0}catch{}
 setTimeout(()=>check(false),Date.now()-last>6*3600e3?2500:0);
})();
