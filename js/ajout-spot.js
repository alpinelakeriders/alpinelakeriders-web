// Ajouter un spot à partir de photos (page annuaire, admins seulement).
// 1) 1 à 3 photos : position GPS lue dans les EXIF, l'IA vérifie qu'on voit l'eau, la carte confirme un plan d'eau proche.
// 2) Dictée vocale (ou clavier) : type de ponton, public ou privé, autorisation à demander…
// 3) L'IA corrige et met en forme, l'admin relit puis répond « OK pour valider ce spot ».
// Enregistré dans la base : collection spots_new (photos dans le stockage « photos »).
(function(){
  const MAX=3,NEAR=300,WATER_R=150;
  const $=(s,r)=>(r||document).querySelector(s);
  function h(tag,attrs,...kids){const e=document.createElement(tag);
    for(const k in attrs||{}){const v=attrs[k];if(v==null||v===false)continue;
      if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?'':v)}
    kids.flat().forEach(c=>{if(c!=null&&c!==false)e.append(c.nodeType?c:document.createTextNode(c))});return e}
  const libs={};
  function loadScript(src,name){return libs[src]||(libs[src]=new Promise((ok,ko)=>{const sc=document.createElement('script');sc.src=src;sc.onload=()=>window[name]?ok(window[name]):ko(new Error(name));sc.onerror=()=>{delete libs[src];ko(new Error(name))};document.head.append(sc)}))}
  const dist=(a,b,c,d)=>{const R=6371e3,r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
  const fmtD=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(1).replace('.',',')+' km';

  // ---------- Styles ----------
  document.head.append(h('style',{text:`
.as-dlg{border:0;padding:0;width:min(720px,100vw);max-width:100vw;max-height:100dvh;height:auto;background:var(--bg);color:var(--fg);border-radius:18px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5)}
.as-dlg::backdrop{background:rgba(0,0,0,.55)}
@media (max-width:640px){.as-dlg{width:100vw;height:100dvh;max-height:100dvh;border-radius:0;margin:0}}
.as-in{padding:20px clamp(16px,4vw,28px) 28px;display:grid;gap:18px}
.as-top{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;background:var(--bg);padding:14px 0 10px;z-index:5;border-bottom:1px solid var(--line)}
.as-top h2{font-size:22px;line-height:1.1;margin:0}
.as-x{background:none;border:0;font-size:28px;line-height:1;color:var(--fg);cursor:pointer;padding:4px 8px}
.as-step{display:grid;gap:12px}
.as-step[hidden]{display:none}
.as-step h3{font-size:17px;margin:0}
.as-help{color:var(--muted);font-size:14px;margin:0}
.as-ph{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.as-ph figure{margin:0;position:relative;border-radius:10px;overflow:hidden;background:var(--tint);aspect-ratio:1}
.as-ph img{width:100%;height:100%;object-fit:cover;display:block}
.as-ph figcaption{position:absolute;left:0;right:0;bottom:0;padding:6px 8px;font-size:11px;line-height:1.3;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.75))}
.as-ph figure.ko img{opacity:.35;filter:grayscale(1)}
.as-checks{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:14px}
.as-checks li{display:flex;gap:8px;align-items:flex-start}
.as-checks li::before{content:'…';flex:0 0 18px;font-weight:600;color:var(--muted)}
.as-checks li.ok::before{content:'✓';color:var(--lake)}
.as-checks li.ko::before{content:'✕';color:#c0392b}
.as-checks li.warn::before{content:'!';color:#d68910}
.as-map .mk.ed{width:26px;height:26px;border-radius:50%;background:#e8572a;color:#fff;display:grid;place-items:center;font:600 14px/1 sans-serif;box-shadow:0 0 0 3px #fff,0 2px 8px rgba(0,0,0,.5);cursor:grab}
.as-map{height:240px;border-radius:12px;overflow:hidden;background:var(--tint)}
.as-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.as-dlg textarea,.as-dlg input[type=text],.as-dlg select{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:var(--fg);background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.as-dlg textarea{min-height:130px;resize:vertical}
.as-mic{position:relative}
.as-mic.on{background:#c0392b!important;color:#fff!important;box-shadow:none!important}
.as-mic.on::after{content:'';position:absolute;inset:-4px;border-radius:999px;border:2px solid #c0392b;animation:as-p 1.2s infinite}
@keyframes as-p{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.15)}}
.as-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr}
.as-grid label{display:grid;gap:4px;font-size:12px;color:var(--muted)}
.as-grid .full{grid-column:1/-1}
@media (max-width:520px){.as-grid{grid-template-columns:1fr}}
.as-q{background:var(--tint);border-radius:12px;padding:12px 14px;font-size:14px}
.as-q ul{margin:6px 0 0;padding-left:18px}
.as-ok{background:color-mix(in srgb,var(--lake) 12%,transparent);border-radius:14px;padding:16px;display:grid;gap:12px}
.as-ok b{font-size:18px}
.as-msg{font-size:14px;margin:0;color:var(--muted)}
.as-msg.err{color:#c0392b}
.as-dlg .chk{display:flex;gap:8px;align-items:flex-start;font-size:14px}
`}));

  // ---------- Fenêtre ----------
  let dlg,st;
  const reset=()=>{st={items:[],pos:null,posSrc:'',eauPhotos:null,eauGps:null,lieu:{},proches:[],ia:true,resume:'',fiche:null,busy:false}};
  function build(){
    dlg=h('dialog',{class:'as-dlg','aria-labelledby':'as-t'},
      h('div',{class:'as-in'},
        h('div',{class:'as-top'},h('h2',{id:'as-t',text:'Ajouter un spot par photos'}),h('button',{class:'as-x',type:'button','aria-label':'Fermer',onclick:close,text:'×'})),
        // Étape 1
        h('section',{class:'as-step',id:'as-s1'},
          h('h3',{text:'1. Photos du spot'}),
          h('p',{class:'as-help',text:'1 à 3 photos prises sur place, avec l’eau bien visible. La position GPS est lue dans la photo.'}),
          h('div',{class:'as-row'},
            h('label',{class:'pill ink',style:'cursor:pointer'},'Choisir les photos',h('input',{type:'file',id:'as-file',accept:'image/*,.heic,.heif',multiple:true,hidden:true,onchange:onFiles})),
            h('span',{class:'as-msg',id:'as-m1',role:'status'})),
          h('div',{class:'as-ph',id:'as-ph'}),
          h('ul',{class:'as-checks',id:'as-checks'}),
          h('div',{class:'as-map',id:'as-map',hidden:true}),
          h('p',{class:'as-help',id:'as-maphelp',hidden:true,text:'Glissez le repère pour ajuster le point de départ si besoin.'}),
          h('div',{class:'as-row',id:'as-nogps',hidden:true},
            h('button',{class:'pill line small',type:'button',onclick:useHere,text:'Utiliser ma position actuelle'}),
            h('span',{class:'as-help',text:'ou touchez la carte à l’endroit du spot.'})),
          h('label',{class:'chk',id:'as-manuel',hidden:true},h('input',{type:'checkbox',id:'as-manuel-c',onchange:refresh1}),h('span',{text:'Je confirme qu’on voit bien l’eau sur les photos (vérification automatique indisponible).'})),
          h('div',{class:'as-ok',id:'as-go1',hidden:true},h('b',{text:'Créer un spot à cet endroit ?'}),h('div',{class:'as-row'},h('button',{class:'pill ink',type:'button',onclick:()=>show(2),text:'Oui, décrire le spot'})))),
        // Étape 2
        h('section',{class:'as-step',id:'as-s2',hidden:true},
          h('h3',{text:'2. Décrivez le spot'}),
          h('p',{class:'as-help',text:'Parlez librement : type de ponton (flottant, fixe, quai, plage…), public ou privé, faut-il demander l’autorisation, qui gère, parking, profondeur, meilleurs moments.'}),
          h('div',{class:'as-row'},
            h('button',{class:'pill line as-mic',type:'button',id:'as-mic',onclick:toggleMic,text:'🎙 Dicter'}),
            h('span',{class:'as-help',id:'as-michelp'})),
          h('textarea',{id:'as-txt',placeholder:'Ex. : ponton flottant de la base nautique, public, pas besoin de demander, parking juste derrière, profondeur 2 mètres au bout…'}),
          h('div',{class:'as-row'},
            h('button',{class:'pill line small',type:'button',onclick:()=>show(1),text:'← Photos'}),
            h('button',{class:'pill ink',type:'button',id:'as-ia',onclick:runTexte,text:'Mettre en forme'}),
            h('span',{class:'as-msg',id:'as-m2',role:'status'}))),
        // Étape 3
        h('section',{class:'as-step',id:'as-s3',hidden:true},
          h('h3',{text:'3. Relisez la fiche'}),
          h('div',{class:'as-q',id:'as-manque',hidden:true}),
          h('div',{class:'as-grid',id:'as-form'}),
          h('div',{class:'as-ok'},
            h('b',{text:'OK pour valider ce spot ?'}),
            h('div',{class:'as-row'},
              h('button',{class:'pill ink',type:'button',id:'as-save',onclick:save,text:'OK, valider'}),
              h('button',{class:'pill line small',type:'button',onclick:()=>show(2),text:'Reprendre la dictée'})),
            h('p',{class:'as-msg',id:'as-m3',role:'status'}))),
        // Fin
        h('section',{class:'as-step',id:'as-s4',hidden:true},
          h('div',{class:'as-ok'},h('b',{id:'as-done'}),h('p',{class:'as-help',text:'Il apparaît sur la carte avec l’étiquette « Nouveau · à vérifier ». Vous pourrez corriger ses infos et ses départs depuis sa fiche.'}),
            h('div',{class:'as-row'},h('button',{class:'pill ink',type:'button',onclick:close,text:'Voir la carte'}),h('button',{class:'pill line small',type:'button',onclick:()=>{close();open()},text:'Ajouter un autre spot'}))))
      ));
    dlg.addEventListener('cancel',e=>{e.preventDefault();close()});
    document.body.append(dlg);
  }
  function show(n){[1,2,3,4].forEach(k=>$('#as-s'+k).hidden=k!==n);if(n===1&&mini)setTimeout(()=>mini.invalidateSize(),50);
    if(n===2)setupMic();stopMic();dlg.scrollTop=0}
  function open(){if(!dlg)build();reset();
    $('#as-ph').textContent='';$('#as-checks').textContent='';$('#as-txt').value='';$('#as-m1').textContent='';$('#as-file').value='';
    ['#as-map','#as-maphelp','#as-nogps','#as-manuel','#as-go1'].forEach(s=>$(s).hidden=true);$('#as-manuel-c').checked=false;
    if(mini){mini.remove();mini=null;pin=null}
    show(1);dlg.showModal()}
  function close(){stopMic();if(dlg&&dlg.open)dlg.close()}

  // ---------- Photos ----------
  const isHeic=f=>/\.(heic|heif)$/i.test(f.name)||/heic|heif/i.test(f.type);
  async function decode(f){
    try{return await createImageBitmap(f,{imageOrientation:'from-image'})}catch(e){if(!isHeic(f))throw e}
    let out=null;
    try{const H=await loadScript('js/vendor/heic-to-1.6.7.js','HeicTo');out=await H({blob:f,type:'image/jpeg',quality:.92})}catch(e){}
    if(!out){const h2a=await loadScript('js/vendor/heic2any-0.0.4.min.js','heic2any');out=await h2a({blob:f,toType:'image/jpeg',quality:.92});if(Array.isArray(out))out=out[0]}
    return createImageBitmap(out,{imageOrientation:'from-image'});
  }
  function toJpeg(bmp,max,q){const s=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
    c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return new Promise(ok=>c.toBlob(b=>ok({blob:b,url:c.toDataURL('image/jpeg',q)}),'image/jpeg',q))}
  async function gpsOf(f){try{const ex=await loadScript('js/vendor/exifr-lite-7.1.3.js','exifr');const g=await ex.gps(f);
    if(g&&isFinite(g.latitude)&&isFinite(g.longitude)&&(g.latitude||g.longitude))return[+g.latitude.toFixed(6),+g.longitude.toFixed(6)]}catch(e){}return null}
  async function onFiles(e){
    const files=[...e.target.files].filter(f=>/^image\//.test(f.type)||isHeic(f));
    if(!files.length)return;
    if(files.length>MAX)say('#as-m1','Seulement les '+MAX+' premières photos sont gardées.');else say('#as-m1','');
    reset();$('#as-go1').hidden=true;$('#as-manuel').hidden=true;$('#as-nogps').hidden=true;
    const box=$('#as-ph');box.textContent='';
    st.items=files.slice(0,MAX).map(f=>{const cap=h('figcaption',{text:'Lecture…'}),fig=h('figure',null,cap);box.append(fig);return{f,fig,cap}});
    check('ph','Lecture des photos et de leur position GPS');
    await Promise.all(st.items.map(async it=>{
      it.gps=await gpsOf(it.f);
      try{const bmp=await decode(it.f);const big=await toJpeg(bmp,1600,.85),small=await toJpeg(bmp,1024,.78);if(bmp.close)bmp.close();
        it.blob=big.blob;it.small=small.url;it.fig.prepend(h('img',{src:small.url,alt:''}));it.cap.textContent=it.gps?'GPS ✓':'Pas de GPS'}
      catch(err){it.bad=true;it.fig.classList.add('ko');it.cap.textContent='Photo illisible (exportez-la en JPEG)'}
    }));
    st.items=st.items.filter(it=>!it.bad||(it.fig.remove(),false));
    if(!st.items.length){check('ph','Aucune photo lisible','ko');return}
    const g=st.items.filter(it=>it.gps);
    if(g.length){
      st.pos=g[0].gps;st.posSrc='photo';
      const loin=g.some(it=>dist(it.gps[0],it.gps[1],st.pos[0],st.pos[1])>500);
      check('ph',g.length+' photo'+(g.length>1?'s':'')+' sur '+st.items.length+' avec position GPS'+(loin?' (attention : photos prises à plus de 500 m l’une de l’autre, la première est retenue)':''),loin?'warn':'ok');
    }else{
      check('ph','Aucune position GPS dans les photos. Sur iPhone, choisissez « Options > Lieu » au moment de partager, ou placez le spot sur la carte.','warn');
      $('#as-nogps').hidden=false;
    }
    showMap();
    analysePhotos();
    if(st.pos)analysePos();
  }

  // ---------- Contrôles ----------
  function check(key,txt,cls){let li=$('#as-c-'+key);if(!li){li=h('li',{id:'as-c-'+key});$('#as-checks').append(li)}li.className=cls||'';li.textContent=txt}
  function say(sel,t,err){const e=$(sel);if(!e)return;e.textContent=t||'';e.classList.toggle('err',!!err)}
  async function api(body){
    const u=await window.claude.use('user'),tk=await u.token();
    const r=await fetch('/api/spot-ia',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tk},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({error:'réponse illisible ('+r.status+')'}));
    if(!r.ok){const e=new Error(d.message||d.error||('erreur '+r.status));e.code=d.error;e.status=r.status;throw e}
    return d}
  async function analysePhotos(){
    const items=st.items;st.eauPhotos=null;
    check('eau','L’IA vérifie qu’on voit l’eau sur les photos…');refresh1();
    try{
      const d=await api({action:'photos',images:items.map(it=>it.small)});
      if(items!==st.items)return;
      (d.photos||[]).forEach((p,k)=>{const it=items[k];if(!it)return;it.eau=!!p.eau;it.vu=p.vu||'';
        it.cap.textContent=(p.eau?'Eau ✓ · ':'Pas d’eau · ')+(p.vu||'');it.fig.classList.toggle('ko',!p.eau)});
      st.resume=d.resume||'';
      const ok=items.filter(it=>it.eau);
      st.eauPhotos=ok.length>0;
      if(!ok.length)check('eau','Aucune photo ne montre l’eau : ajoutez une photo où l’on voit le plan d’eau.','ko');
      else if(ok.length<items.length)check('eau',(items.length-ok.length)+' photo(s) sans eau visible seront retirées. '+ok.length+' gardée(s).','warn');
      else check('eau','Eau visible sur '+(ok.length>1?'les '+ok.length+' photos':'la photo')+(st.resume?' : '+st.resume:''),'ok');
    }catch(e){
      if(e.code==='cle'||e.status===404||e.status===405){st.ia=false;st.eauPhotos=null;
        check('eau','Vérification des photos par l’IA pas encore activée (clé à ajouter dans Cloudflare). Confirmez vous-même ci-dessous.','warn');$('#as-manuel').hidden=false}
      else{st.ia=false;check('eau','Vérification des photos impossible ('+e.message+'). Confirmez vous-même ci-dessous.','warn');$('#as-manuel').hidden=false}
    }
    refresh1();
  }
  let posSeq=0;
  async function analysePos(){
    const seq=++posSeq,[la,lo]=st.pos;st.eauGps=null;st.lieu={};
    check('pos','Position : '+la.toFixed(5)+', '+lo.toFixed(5)+(st.posSrc==='photo'?' (photo)':st.posSrc==='ici'?' (votre position)':' (placée sur la carte)'),'ok');
    // Spots déjà connus à proximité
    const S=(window.SPOTS||[]).filter(s=>s.la!=null);
    const pr=S.map(s=>{const pts=s.pts&&s.pts.length?s.pts:[[s.la,s.lo]];return{s,d:Math.min(...pts.map(q=>dist(la,lo,q[0],q[1])))}}).filter(x=>x.d<NEAR).sort((a,b)=>a.d-b.d);
    st.proches=pr;
    if(pr.length)check('dbl','Spot déjà dans l’annuaire à '+fmtD(pr[0].d)+' : « '+pr[0].s.n+' ». Vérifiez que ce n’est pas le même (vous pouvez plutôt lui ajouter un départ depuis sa fiche).','warn');
    else check('dbl','Aucun spot connu à moins de '+NEAR+' m','ok');
    check('gps','Recherche d’un plan d’eau autour du point…');refresh1();
    const [w,rv]=await Promise.all([waterNear(la,lo),reverse(la,lo)]);
    if(seq!==posSeq)return;
    st.lieu=rv||{};
    if(w===null){st.eauGps=null;check('gps','Carte des plans d’eau injoignable : vérifiez sur la vue satellite que le point est au bord de l’eau.','warn')}
    else if(w.ok){st.eauGps=true;if(w.nom)st.lieu.e=w.nom;check('gps','Plan d’eau à moins de '+WATER_R+' m'+(w.nom?' : '+w.nom:''),'ok')}
    else{st.eauGps=false;check('gps','Aucun plan d’eau trouvé à moins de '+WATER_R+' m du point. Déplacez le repère sur la carte s’il est faux.','ko')}
    refresh1();
  }
  async function waterNear(la,lo){
    const a='(around:'+WATER_R+','+la+','+lo+')';
    const q='[out:json][timeout:20];(way'+a+'[natural=water];relation'+a+'[natural=water];way'+a+'[water];relation'+a+'[water];way'+a+'[waterway~"^(river|canal|riverbank|dock)$"];way'+a+'[natural=coastline];way'+a+'[man_made=pier];way'+a+'[leisure=marina];node'+a+'[leisure=slipway];);out tags 10;';
    for(const url of['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
      try{const r=await fetch(url,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'content-type':'application/x-www-form-urlencoded'}});
        if(!r.ok)continue;const d=await r.json(),el=d.elements||[];
        const named=el.find(x=>x.tags&&x.tags.name&&(x.tags.natural==='water'||x.tags.water||x.tags.waterway));
        return{ok:el.length>0,nom:named?named.tags.name:''}}catch(e){}
    }
    return null;
  }
  async function reverse(la,lo){
    try{const r=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=fr&lat='+la+'&lon='+lo);
      const d=await r.json(),a=d.address||{};
      return{v:a.city||a.town||a.village||a.municipality||a.hamlet||'',rg:a.state||a.region||'',p:(a.country_code||'').toUpperCase(),pays:a.country||''}}catch(e){return null}
  }
  function refresh1(){
    const eauOk=st.eauPhotos===true||(!st.ia&&$('#as-manuel-c').checked);
    $('#as-go1').hidden=!(st.pos&&eauOk&&st.eauGps!==false);
  }

  // ---------- Mini-carte ----------
  let mini=null,pin=null;
  function showMap(){
    const L=window.L;if(!L)return;
    $('#as-map').hidden=false;$('#as-maphelp').hidden=!st.pos;
    if(!mini){
      mini=L.map($('#as-map'),{zoomControl:true,attributionControl:false});
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(mini);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(mini);
      mini.on('click',ev=>{if(!pin||st.posSrc!=='photo')setPos([ev.latlng.lat,ev.latlng.lng],'carte')});
    }
    if(st.pos){mini.setView(st.pos,17);placePin()}else mini.setView([45.3,5.95],6);
    setTimeout(()=>mini.invalidateSize(),60);
  }
  function placePin(){const L=window.L;if(!mini)return;
    if(!pin){pin=L.marker(st.pos,{draggable:true,icon:L.divIcon({className:'',html:'<div class="mk ed">+</div>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(mini);
      pin.on('dragend',()=>{const p=pin.getLatLng();setPos([p.lat,p.lng],'carte',true)})}
    else pin.setLatLng(st.pos)}
  function setPos(p,src,keepView){st.pos=[+p[0].toFixed(6),+p[1].toFixed(6)];st.posSrc=src;$('#as-maphelp').hidden=false;
    if(mini){placePin();if(!keepView)mini.setView(st.pos,Math.max(mini.getZoom(),17))}analysePos()}
  function useHere(){
    if(!navigator.geolocation){say('#as-m1','Position indisponible sur cet appareil.',true);return}
    say('#as-m1','Recherche de votre position…');
    navigator.geolocation.getCurrentPosition(p=>{say('#as-m1','');setPos([p.coords.latitude,p.coords.longitude],'ici')},
      ()=>say('#as-m1','Position refusée : touchez la carte à l’endroit du spot.',true),{enableHighAccuracy:true,timeout:15000});
  }

  // ---------- Dictée ----------
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  let rec=null,recOn=false,base='';
  function setupMic(){
    const b=$('#as-mic');
    if(!SR){b.hidden=true;$('#as-michelp').textContent='Astuce : touchez le micro du clavier de votre téléphone pour dicter.';return}
    $('#as-michelp').textContent='Touchez pour parler, retouchez pour arrêter.';
  }
  function toggleMic(){recOn?stopMic():startMic()}
  function startMic(){
    if(!SR)return;const ta=$('#as-txt');
    rec=new SR();rec.lang='fr-FR';rec.continuous=true;rec.interimResults=true;
    base=ta.value.trim();
    rec.onresult=ev=>{let fin='',tmp='';for(let i=0;i<ev.results.length;i++){const r=ev.results[i];(r.isFinal?(fin+=r[0].transcript+' '):(tmp+=r[0].transcript))}
      ta.value=(base?base+' ':'')+fin+tmp};
    rec.onerror=ev=>{if(ev.error==='not-allowed')$('#as-michelp').textContent='Micro refusé : autorisez-le, ou utilisez le micro du clavier.';stopMic()};
    rec.onend=()=>{if(recOn){try{base=ta.value.trim();rec.start()}catch(e){stopMic()}}};
    try{rec.start();recOn=true;const b=$('#as-mic');b.classList.add('on');b.textContent='■ Arrêter'}catch(e){stopMic()}
  }
  function stopMic(){recOn=false;if(rec){try{rec.stop()}catch(e){}rec=null}const b=dlg&&$('#as-mic');if(b){b.classList.remove('on');b.textContent='🎙 Dicter'}}

  // ---------- Mise en forme ----------
  const CAT=[['ponton','Ponton ou quai'],['club','Club ou école'],['lac','Lac ou plage'],['port','Port']];
  const ACC=[['libre','Accès libre'],['club','Via club ou école'],['event','Événements'],['restreint','Accès restreint']];
  const PUB=[['public','Public'],['prive','Privé'],['?','Je ne sais pas']];
  const AUT=[['non','Non, accès libre'],['oui','Oui, demander avant'],['?','Je ne sais pas']];
  async function runTexte(){
    stopMic();const txt=$('#as-txt').value.trim();
    if(txt.length<5){say('#as-m2','Dictez ou écrivez quelques mots sur le spot.',true);return}
    const b=$('#as-ia');b.disabled=true;say('#as-m2','L’IA corrige et met en forme…');
    const ctx={position:st.pos,ville:st.lieu.v,region:st.lieu.rg,pays:st.lieu.pays,plan_d_eau:st.lieu.e||'',photos:st.items.filter(it=>it.eau!==false).map(it=>it.vu).filter(Boolean),resume_photos:st.resume};
    let f=null;
    try{f=await api({action:'texte',texte:txt,contexte:ctx})}
    catch(e){say('#as-m2',(e.code==='cle'||e.status===404?'Mise en forme par l’IA pas encore activée':'Mise en forme impossible ('+e.message+')')+' : le texte est repris tel quel, à relire.',true);
      f={n:'',t:'',c:'ponton',pub:'?',aut:'?',ac:'',a:'',st:'',f:'',s:'',rm:txt,manque:[]}}
    b.disabled=false;if(f&&!f.manque)f.manque=[];
    st.fiche=Object.assign({e:st.lieu.e||'',v:st.lieu.v||'',rg:st.lieu.rg||'',p:st.lieu.p||''},f);
    if(!st.fiche.n)st.fiche.n=[st.fiche.e||st.fiche.v,st.fiche.t].filter(Boolean).join(' – ')||'Nouveau spot';
    if(!document.querySelector('#as-m2.err'))say('#as-m2','');
    fillForm();show(3);
  }
  function fillForm(){
    const f=st.fiche,box=$('#as-form');box.textContent='';
    const inp=(k,lab,full)=>box.append(h('label',{class:full?'full':null},lab,h('input',{type:'text','data-k':k,value:f[k]||''})));
    const sel=(k,lab,opts)=>{const s=h('select',{'data-k':k},opts.map(([v,t])=>h('option',{value:v,text:t})));s.value=f[k]||opts[opts.length-1][0];box.append(h('label',null,lab,s))};
    inp('n','Nom du spot',true);
    inp('t','Type de départ (ponton flottant, quai…)');sel('c','Catégorie',CAT);
    sel('pub','Ponton public ou privé',PUB);sel('aut','Autorisation à demander',AUT);
    sel('ac','Accès',[...ACC,['','Non précisé']]);inp('a','Accès en quelques mots');
    inp('st','Géré par');inp('e','Plan d’eau');
    inp('v','Commune');inp('rg','Région');
    inp('f','Fréquentation');inp('s','Saison, horaires');
    box.append(h('label',{class:'full'},'Description',h('textarea',{'data-k':'rm',text:f.rm||''})));
    const m=$('#as-manque');m.textContent='';
    if(f.manque&&f.manque.length){m.hidden=false;m.append(h('b',{text:'À compléter si vous savez :'}),h('ul',null,f.manque.map(q=>h('li',{text:q}))))}else m.hidden=true;
  }

  // ---------- Enregistrement ----------
  async function save(){
    const b=$('#as-save');if(st.busy)return;
    const f=Object.assign({},st.fiche);
    $('#as-form').querySelectorAll('[data-k]').forEach(el=>f[el.dataset.k]=el.value.trim());
    if(!f.n){say('#as-m3','Donnez un nom au spot.',true);return}
    st.busy=true;b.disabled=true;say('#as-m3','Envoi des photos…');
    try{
      const assets=await window.claude.use('assets'),db=await window.claude.use('db');
      if(!assets||!db)throw new Error('session admin expirée, reconnectez-vous');
      let me='';try{me=await(await window.claude.use('user')).email()}catch(e){}
      const keep=st.items.filter(it=>it.eau!==false&&it.blob),photos=[];
      for(const it of keep){const r=await assets.upload(it.blob,{type:'image/jpeg'});photos.push(r.url)}
      say('#as-m3','Enregistrement du spot…');
      const i=Date.now(),[la,lo]=st.pos;
      const spot={i,n:f.n,p:f.p||st.lieu.p||'',rg:f.rg,v:f.v,e:f.e,t:f.t,c:f.c||'ponton',ac:f.ac||'',a:f.a,st:f.st,f:f.f,s:f.s,rm:f.rm,
        la,lo,pts:[[la,lo]],photos,eau:{photos:st.eauPhotos===true?true:'confirmé par l’admin',gps:st.eauGps},
        aut:f.aut||'?',pub:f.pub||'?',statut:'nouveau',par:me,le:new Date().toISOString(),src:'photos',
        dictee:$('#as-txt').value.trim().slice(0,2000)};
      if(spot.aut==='oui'&&!spot.a)spot.a='autorisation à demander';
      Object.keys(spot).forEach(k=>{if(spot[k]===''||spot[k]==null)delete spot[k]});
      await db.doc('spots_new/'+i).set(spot);
      try{if(window.ALR_SPOT_AJOUTE)window.ALR_SPOT_AJOUTE(spot)}catch(e){}
      window.dispatchEvent(new CustomEvent('alr-spot-ajoute',{detail:spot}));
      $('#as-done').textContent='Spot « '+spot.n+' » ajouté.';say('#as-m3','');show(4);
    }catch(e){say('#as-m3','Pas enregistré : '+(e.message||e)+'. Réessayez.',true)}
    st.busy=false;b.disabled=false;
  }

  // ---------- Bouton d'entrée ----------
  function addButtons(){
    const btn=()=>h('button',{class:'pill ink',type:'button',onclick:open},'＋ Ajouter un spot par photos');
    const acts=$('#ajouter .box .acts');if(acts&&!acts.querySelector('.as-open')){const b=btn();b.classList.add('as-open');acts.prepend(b)}
    const near=$('#near');if(near&&!document.querySelector('.as-open-map')){const b=btn();b.className='pill line as-open-map';b.textContent='＋ Ajouter un spot';near.after(b)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addButtons);else addButtons();
  window.ALR_AJOUT_SPOT=open;
})();
