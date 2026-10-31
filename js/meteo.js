// Météo des spots de pumpfoil : prévision AROME Météo-France (via Open-Meteo, gratuit, sans clé)
// et nuages en direct (satellites EUMETSAT). Utilisé par la page d'accueil et par lacs.html.
// Le vent compte le plus (plan d'eau lisse = bon pump), le soleil départage.
(function(){
  var TZ='Europe/Paris';
  // Version anglaise (?lang=en, voir js/i18n.js)
  var EN=window.ALR_LANG==='en',L=function(fr,en){return EN?en:fr};
  var MODELS=['meteofrance_arome_france_hd','meteofrance_arome_france','meteofrance_seamless'];
  var VARS='wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,sunshine_duration,precipitation,temperature_2m';
  var JOURS=EN?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']:['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  var MOIS=EN?['January','February','March','April','May','June','July','August','September','October','November','December']:['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var DIR=EN?['north','north-east','east','south-east','south','south-west','west','north-west']:['nord','nord-est','est','sud-est','sud','sud-ouest','ouest','nord-ouest'];
  // Heure affichée : 15h en français, 3pm en anglais
  function hh(h){return EN?(h%12||12)+(h%24<12?'am':'pm'):h+'h'}
  // Repères affichés sur l'image satellite quand ils tombent dans le cadre
  var VILLES=[['Grenoble',45.1885,5.7245],['Chambéry',45.5646,5.9178],['Annecy',45.8992,6.1294],['Aix-les-Bains',45.6885,5.9153],['Albertville',45.6755,6.3925],
    ['Voiron',45.3646,5.5888],['Lyon',45.764,4.8357],['Genève',46.2044,6.1432],['Lausanne',46.5197,6.6323],['Thonon',46.3705,6.4793],['Chamonix',45.9237,6.8694],
    ['Sallanches',45.9364,6.6317],['Vizille',45.0772,5.7712],['Montpellier',43.6108,3.8767],['Sète',43.4028,3.6967]];
  // Webcams publiques proches des spots (pages externes ; leurs images ne peuvent pas être reprises sur le site)
  var WEBCAMS={
    bourget:['https://www.windfinder.com/webcams/grand-port-d-aix-les-bains','Webcams du Grand Port d\'Aix-les-Bains'],
    aiguebelette:['https://www.windfinder.com/webcams/aiguebelette','Webcams autour du lac d\'Aiguebelette'],
    monteynard:['https://www.windfinder.com/webcams/lac_de_monteynard-avignonet','Webcams du lac de Monteynard'],
    annecy:['https://www.windfinder.com/webcams/saint_jorioz','Webcams de Saint-Jorioz et du lac d\'Annecy'],
    passy:['https://www.windfinder.com/webcams/lac_de_passy','Webcams autour du lac de Passy'],
    carnon:['https://www.windfinder.com/webcams/port-de-carnon','Webcams du port de Carnon']
  };

  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
  function nowParis(){
    var p={};new Intl.DateTimeFormat('fr-FR',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
      .formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});
    return {day:p.year+'-'+p.month+'-'+p.day,h:+p.hour+(+p.minute)/60};
  }
  function load(url){return fetch(url).then(function(r){if(!r.ok)throw r.status;return r.json()})}

  // Prévisions pour plusieurs points en un seul appel ; cache 30 min dans le navigateur.
  function forecast(pts){
    var la=pts.map(function(p){return (+p.lat).toFixed(4)}).join(','),lo=pts.map(function(p){return (+p.lon).toFixed(4)}).join(',');
    var key='alr-meteo-v2:'+la+'|'+lo;
    try{var c=JSON.parse(localStorage.getItem(key)||'null');if(c&&Date.now()-c.t<30*60e3)return Promise.resolve(c.d)}catch(e){}
    var base='https://api.open-meteo.com/v1/forecast?latitude='+la+'&longitude='+lo+'&hourly='+VARS+'&daily=sunrise,sunset&timezone='+encodeURIComponent(TZ)+'&forecast_days=2&wind_speed_unit=kmh';
    return load(base+'&models='+MODELS.join(','))
      .catch(function(){return load(base+'&models=meteofrance_seamless')})
      .then(function(d){d=Array.isArray(d)?d:[d];try{localStorage.setItem(key,JSON.stringify({t:Date.now(),d:d}))}catch(e){}return d});
  }
  // Valeur d'une variable à l'index i : AROME HD d'abord, puis AROME 2,5 km, puis Météo-France combiné
  function val(H,name,i){
    for(var k=0;k<MODELS.length;k++){var a=H[name+'_'+MODELS[k]];if(a&&a[i]!=null)return a[i]}
    var b=H[name];return b&&b[i]!=null?b[i]:null;
  }

  // Analyse d'une journée : verdict, meilleure heure, vent, soleil, heure par heure
  function analyse(d){
    var H=d&&d.hourly;if(!H||!H.time)return null;
    var now=nowParis(),days=(d.daily&&d.daily.time)||[];
    var di=Math.max(0,days.indexOf(now.day));
    function sun(i){var s=(d.daily.sunrise||[])[i],e=(d.daily.sunset||[])[i];return s&&e?[+s.slice(11,13)+s.slice(14,16)/60,+e.slice(11,13)+e.slice(14,16)/60]:[8,18]}
    var se=sun(di),demain=false;
    // Le soir (moins d'une heure de jour restante), on passe au lendemain
    if(now.h>se[1]-1&&days[di+1]){di++;se=sun(di);demain=true}
    var sr=se[0],ss=se[1],day=days[di]||now.day,hrs=[];
    H.time.forEach(function(t,i){
      if(t.slice(0,10)!==day)return;
      var h=+t.slice(11,13);
      var nx=H.time[i+1]&&H.time[i+1].slice(0,10)===day?i+1:-1; // cumul de l'heure h→h+1 (stocké à h+1)
      var v=val(H,'wind_speed_10m',i),g=val(H,'wind_gusts_10m',i);
      if(v==null)return;
      var sunS=nx>=0?val(H,'sunshine_duration',nx):null,cc=val(H,'cloud_cover',i);
      var jour=Math.max(0,Math.min(h+1,ss)-Math.max(h,sr)); // part de l'heure réellement de jour
      var sf=sunS!=null?Math.min(1,sunS/3600/Math.max(jour,.01)):(cc!=null?1-cc/100:.5);
      hrs.push({h:h,v:v,g:g==null?v:g,dir:val(H,'wind_direction_10m',i),sun:sunS,sf:jour>0?sf:0,cc:cc,
        pr:nx>=0?(val(H,'precipitation',nx)||0):0,t:val(H,'temperature_2m',i),jour:jour});
    });
    if(!hrs.length)return null;
    // Note d'une heure : 75 % vent (rafales comprises), 25 % soleil, malus pluie
    hrs.forEach(function(x){
      x.ve=x.v+.35*Math.max(0,x.g-x.v);
      var w=Math.max(0,Math.min(1,1-(x.ve-5)/15));
      x.score=.75*w+.25*x.sf-(x.pr>=.5?.4:x.pr>0.1?.2:0);
      x.futur=demain||x.h+1>now.h;
    });
    var jourH=hrs.filter(function(x){return x.h>=Math.floor(sr)&&x.h+1<=Math.ceil(ss)&&x.jour>=.5});
    var cand=jourH.filter(function(x){return x.futur});if(!cand.length)cand=jourH;if(!cand.length)return null;
    var pick=function(l){return l.reduce(function(a,b){return b.score>a.score+1e-9?b:a})};
    var best=pick(cand),sess=cand.filter(function(x){return x.h>=15&&x.h<=18}),bestS=sess.length?pick(sess):null;
    var pluie=cand.filter(function(x){return x.pr>=.3}).length>=Math.max(3,cand.length/2);
    var cls,txt,court;
    if(EN){
      if(best.v<=8&&best.g<=20){cls='';court=demain?'Tomorrow: good riding':'Good riding';txt=demain?'Tomorrow: good riding conditions':'Good riding conditions today'}
      else if(best.v<=14){cls='moyen';court=(demain?'Tomorrow: ':'')+'Light chop';txt=(demain?'Tomorrow':'Today')+': rideable, with a little chop'}
      else{cls='bof';court=(demain?'Tomorrow: ':'')+'Too windy';txt=(demain?'Tomorrow':'Today')+': too windy for good pumping'}
      if(pluie)txt+=' · rain forecast';
    }else{
    if(best.v<=8&&best.g<=20){cls='';court=demain?'Demain : ça ride bien':'Ça va bien rider';txt=demain?'Demain, ça va bien rider':'Ça va bien rider aujourd\'hui'}
    else if(best.v<=14){cls='moyen';court=(demain?'Demain : ':'')+'Petit clapot';txt=(demain?'Demain':'Aujourd\'hui')+' : ça ride, avec un peu de clapot'}
    else{cls='bof';court=(demain?'Demain : ':'')+'Trop de vent';txt=(demain?'Demain':'Aujourd\'hui')+' : trop de vent pour un bon pump'}
    if(pluie)txt+=' · pluie annoncée';
    }
    var sfm=cand.reduce(function(a,x){return a+x.sf},0)/cand.length;
    var prev=pluie?['🌧',L('pluie','rain')]:sfm>=.6?['☀️',L('beau temps','fine weather')]:sfm>=.25?['⛅',L('soleil et nuages','sun and clouds')]:['☁️',L('nuageux','cloudy')];
    return {day:day,demain:demain,sr:sr,ss:ss,hrs:hrs,jourH:jourH,cand:cand,best:best,bestS:bestS,cls:cls,txt:txt,court:court,prev:prev};
  }

  // Nuages en direct (masque nuageux Meteosat) : part du ciel couvert autour du point
  function nuages(lat,lon){
    var u='/api/nuages'+(lat!=null?'?lat='+(+lat).toFixed(3)+'&lon='+(+lon).toFixed(3):'');
    return fetch(u).then(function(r){return r.ok?r.json():null}).then(function(d){return d&&d.couverture!=null?d:null}).catch(function(){return null});
  }
  function icSat(c,an){
    var hp=+new Date().toLocaleString('fr-FR',{timeZone:TZ,hour:'numeric',hourCycle:'h23'});
    var so=an?[an.sr,an.ss]:[7.5,17.5],nuit=hp<Math.floor(so[0])||hp>=Math.ceil(so[1]);
    return c<=20?[nuit?'🌙':'☀️',L('ciel dégagé','clear sky')]:c<=60?[nuit?'☁️':'⛅',L('nuages épars','scattered clouds')]:['☁️',L('ciel couvert','overcast')];
  }
  function satUrl(lat,lon,dx,dy,w,h){return 'https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=mtg_fd:rgb_geocolour&styles=&crs=CRS:84&format=image/jpeg&bbox='+[lon-dx,lat-dy,lon+dx,lat+dy].join(',')+'&width='+w+'&height='+h+'&t='+Math.floor(Date.now()/6e5)}

  function hm(x){var h=Math.floor(x),m=Math.round((x-h)*60);if(m===60){h++;m=0}if(EN)return (h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h<12?'am':'pm');return h+'h'+(m?String(m).padStart(2,'0'):'')}
  function dur(sec){var m=Math.round(sec/60/10)*10;if(m<10)return L('pas de soleil','no sun');var h=Math.floor(m/60);m=m%60;return (h?h+' h':'')+(m?(h?' ':'')+m+' min':'')+L(' de soleil',' of sun')}
  function toggle(btn,box,cb){btn.addEventListener('click',function(){var o=box.hidden;box.hidden=!o;btn.setAttribute('aria-expanded',o?'true':'false');btn.querySelector('[aria-hidden]').textContent=o?'↑':'↓';if(cb)cb(o)})}
  function arrowBtn(cls,label,shortLabel){
    var b=el('button',cls);b.type='button';b.setAttribute('aria-expanded','false');
    if(shortLabel!=null){b.setAttribute('aria-label',label);b.append(el('span','mt-mt',label+' '))}else b.append(document.createTextNode(label+' '));
    var a=el('span',null,'↓');a.setAttribute('aria-hidden','true');b.append(a);return b;
  }
  function pourquoi(x){var r=[Math.round(x.v)+' km/h'];r.push(x.sf>=.6?L('ensoleillé','sunny'):x.sf>=.25?L('quelques éclaircies','some sunny spells'):L('couvert','overcast'));if(x.pr>=.3)r.push(L('averses','showers'));if(x.t!=null)r.push(Math.round(x.t)+' °C');return r.join(', ')}

  // Bloc complet d'un spot : ligne résumée + détails (prévision, heure par heure, satellite).
  // o = {name, lat, lon, an (analyse ou null), open (détails dépliés), hourOpen, nuages (true pour charger le direct)}
  function bloc(o){
    var root=el('div','mt-bloc'),line=el('div','mt-line'),det=el('div','mt-det');
    line.setAttribute('aria-live','polite');
    var an=o.an,vb=el('span','mt-verdict'),ip=el('span','mt-ic'),is=el('span','mt-ic'),bh=el('span','mt-bh');
    ip.hidden=is.hidden=bh.hidden=vb.hidden=true;
    ip.append(el('span','mt-e'),el('small',null,L('Prévu','Forecast')));is.append(el('span','mt-e'),el('small',null,L('En direct','Live')));
    var more=arrowBtn('mt-more',L('Détails','Details'),'');
    line.append(vb,ip,is,bh,more);
    det.hidden=!o.open;more.setAttribute('aria-expanded',o.open?'true':'false');more.querySelector('[aria-hidden]').textContent=o.open?'↑':'↓';
    toggle(more,det);
    root.append(line,det);
    var src=el('p','mt-src');
    if(an){
      var dot=el('i');dot.setAttribute('aria-hidden','true');var vs=el('span');vs.append(el('span','mt-l',an.txt),el('span','mt-s',an.court));
      vb.className='mt-verdict'+(an.cls?' '+an.cls:'');vb.append(dot,vs);vb.hidden=false;
      setIc(ip,an.prev,L('Prévision','Forecast'));
      bh.append(el('small','mt-l',L('Meilleure heure','Best time')),el('b','mt-l',hh(an.best.h)+'–'+hh(an.best.h+1)),el('b','mt-s',hh(an.best.h)),el('span','mt-bw',Math.round(an.best.v)+' km/h'));
      bh.title=L('Vent prévu entre '+an.best.h+'h et '+(an.best.h+1)+'h : '+Math.round(an.best.v)+' km/h, rafales '+Math.round(an.best.g)+' km/h','Wind forecast between '+hh(an.best.h)+' and '+hh(an.best.h+1)+': '+Math.round(an.best.v)+' km/h, gusts '+Math.round(an.best.g)+' km/h');bh.hidden=false;
      var dt=new Date(an.day+'T12:00:00');
      det.append(el('p','label mt-titre',L('Météo '+(an.demain?'de demain':'du jour'),(an.demain?'Tomorrow\'s':'Today\'s')+' weather')+' · '+o.name+' · '+JOURS[dt.getDay()]+' '+dt.getDate()+' '+MOIS[dt.getMonth()]));
      var sun=el('p','mt-sun');sun.append(el('span',null,L('🌅 Lever du soleil ','🌅 Sunrise ')),el('b',null,hm(an.sr)),el('span',null,L(' · 🌇 Coucher ',' · 🌇 Sunset ')),el('b',null,hm(an.ss)));det.append(sun);
      det.append(grille(an));
      var hb=arrowBtn('lt-btn',L('Heure par heure : vent et température','Hour by hour: wind and temperature')),ol=heures(an);ol.hidden=!o.hourOpen;
      if(o.hourOpen){hb.setAttribute('aria-expanded','true');hb.querySelector('[aria-hidden]').textContent='↑'}
      toggle(hb,ol);det.append(hb,ol);
      src.textContent=L('Prévision AROME Météo-France (maille 1,3 km) via Open-Meteo · vent moyen à 10 m en km/h · plus le vent est faible, plus le plan d\'eau est lisse. Nuages en direct : satellites Meteosat (EUMETSAT).','AROME Météo-France forecast (1.3 km grid) via Open-Meteo · average wind at 10 m in km/h · the lighter the wind, the smoother the water. Live clouds: Meteosat satellites (EUMETSAT).');
    }else src.textContent=L('Nuages en direct : satellites Meteosat (EUMETSAT).','Live clouds: Meteosat satellites (EUMETSAT).');
    // Satellite
    var sat=el('div','mt-sat');sat.hidden=true;
    var DX=.6,DY=.32,map=el('a','mt-map');map.target='_blank';map.rel='noopener';map.href=satUrl(o.lat,o.lon,DX*2.5,DY*2.5,1600,1200);
    map.setAttribute('aria-label',L('Image satellite des nuages autour de '+o.name+', agrandir','Satellite image of the clouds around '+o.name+', enlarge'));
    var img=el('img');img.alt=L('Image satellite Meteosat des nuages autour de ','Meteosat satellite image of the clouds around ')+o.name;img.decoding='async';img.loading='lazy';
    map.append(img);
    VILLES.forEach(function(v){
      var x=(v[2]-o.lon+DX)/(2*DX),y=(o.lat+DY-v[1])/(2*DY);
      if(x<.08||x>.92||y<.06||y>.94||(Math.abs(x-.5)<.08&&Math.abs(y-.5)<.06))return;
      var e=el('span','vl',v[0]);e.style.left=x*100+'%';e.style.top=y*100+'%';map.append(e);
    });
    var pt=el('span','pt');pt.style.left='50%';pt.style.top='50%';pt.title=o.name;map.append(pt);
    var sb=el('b',null,L('Image satellite en direct','Live satellite image')),sm=el('small',null,L('Les nuages apparaissent en blanc, le point vert marque le spot.','Clouds appear in white; the green dot marks the spot.'));
    var st=el('div');st.append(el('span','label',L('Nuages en direct · satellite','Live clouds · satellite')),sb,sm);
    sat.append(map,st);det.append(sat,src);
    img.onload=function(){sat.hidden=false};
    img.src=satUrl(o.lat,o.lon,DX,DY,640,480);
    root.liveSat=function(d){
      if(!d)return;var c=d.couverture;
      setIc(is,icSat(c,an),L('En direct (satellite)','Live (satellite)'),c+L(' % de nuages','% cloud cover'));
      sb.textContent=EN?(c<=10?'Clear sky':c<=35?'A few clouds':c<=70?'Partly cloudy':c<95?'Very cloudy':'Overcast'):(c<=10?'Ciel dégagé':c<=35?'Quelques nuages':c<=70?'Ciel partiellement couvert':c<95?'Ciel très nuageux':'Ciel couvert');
      var m=c+L(' % de nuages autour du spot','% cloud cover around the spot');
      if(d.auLac===0&&c>10)m+=L(', éclaircie juste au-dessus',', clear right overhead');else if(d.auLac===1&&c<90)m+=L(', nuages juste au-dessus',', clouds right overhead');
      if(d.heure){var t=new Date(d.heure);if(!isNaN(t))m+=EN?' · image from '+t.toLocaleTimeString('en-GB',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true}).replace(/\s/g,''):' · image de '+t.toLocaleTimeString('fr-FR',{timeZone:TZ,hour:'numeric',minute:'2-digit'}).replace(':','h')}
      sm.textContent=m+'.';
    };
    if(o.nuages)nuages(o.terrasse?null:o.lat,o.lon).then(root.liveSat);
    return root;
  }
  function setIc(span,ic,quoi,plus){span.firstChild.textContent=ic[0];span.title=quoi+L(' : ',': ')+ic[1]+(plus?', '+plus:'');span.setAttribute('aria-label',span.title);span.hidden=false}

  function grille(an){
    var jourH=an.jourH,hrs=an.hrs,g=el('div','mt-grid');
    function cell(lbl,b,s,cls){var d=el('div',cls);d.append(el('span','label',lbl),el('b',null,b),el('small',null,s));g.append(d)}
    function plage(a,b){var l=jourH.filter(function(x){return x.h>=a&&x.h<b});if(!l.length)return null;
      var vs=l.map(function(x){return x.v}),gs=l.map(function(x){return x.g});
      return {min:Math.round(Math.min.apply(0,vs)),max:Math.round(Math.max.apply(0,vs)),g:Math.round(Math.max.apply(0,gs))}}
    var am=plage(0,12),pm=plage(12,24);
    function txtV(p){return p.min===p.max?p.min+' km/h':p.min+'–'+p.max+' km/h'}
    var vm=[];if(am&&pm)vm.push(L('Matin ','Morning ')+txtV(am));
    var gm=Math.max(am?am.g:0,pm?pm.g:0);if(gm>0)vm.push(L('rafales jusqu\'à ','gusts up to ')+gm+' km/h');
    var dirs=an.cand.filter(function(x){return x.dir!=null});
    if(dirs.length){var dm=dirs.reduce(function(a,b){return b.v>a.v?b:a}).dir;if(Math.max(am?am.max:0,pm?pm.max:0)>=6)vm.push(L('vent de ','wind from the ')+DIR[Math.round(dm/45)%8])}
    cell(L('Vent','Wind'),pm?L('Après-midi ','Afternoon ')+txtV(pm):L('Matin ','Morning ')+txtV(am),vm.join(' · '));
    var best=an.best,bS=an.bestS,bm=pourquoi(best);
    if(bS&&bS.h!==best.h)bm+=L('. Sur le créneau 15h–18h30 : ','. In the 3pm–6:30pm slot: ')+hh(bS.h)+' ('+Math.round(bS.v)+' km/h'+(bS.sf>=.6?L(', soleil',', sun'):'')+')';
    cell(L('Meilleure heure','Best time'),hh(best.h)+' – '+hh(best.h+1),bm,'mt-top');
    function sol(a,b){var s=0,ok=false,j=0,c=0,n=0;jourH.concat(hrs.filter(function(x){return jourH.indexOf(x)<0&&x.jour>0})).forEach(function(x){if(x.h>=a&&x.h<b){j+=x.jour;if(x.sun!=null){s+=x.sun;ok=true}if(x.cc!=null){c+=x.cc;n++}}});
      return {s:s,ok:ok,j:j,cc:n?c/n:null}}
    function cielTxt(o){var f=o.ok&&o.j?o.s/3600/o.j:(o.cc!=null?1-o.cc/100:0);return EN?(f>=.7?'Full sun':f>=.4?'Sun and clouds':f>=.15?'Rare sunny spells':'Overcast'):(f>=.7?'Grand soleil':f>=.4?'Soleil et nuages':f>=.15?'Rares éclaircies':'Ciel couvert')}
    var sa=sol(0,12),sp=sol(12,24);
    cell(L('Soleil le matin','Morning sun'),cielTxt(sa),(sa.ok?dur(sa.s)+' · ':'')+L('lever ','sunrise ')+hm(an.sr));
    cell(L('Soleil l\'après-midi','Afternoon sun'),cielTxt(sp),(sp.ok?dur(sp.s)+' · ':'')+L('coucher ','sunset ')+hm(an.ss));
    return g;
  }
  // Heure par heure (de jour seulement, 6 colonnes sur mobile : pas de défilement horizontal)
  function heures(an){
    var ol=el('ol','mt-h');ol.setAttribute('aria-label',L('Vent moyen en km/h, heure par heure','Average wind in km/h, hour by hour'));
    an.jourH.forEach(function(x){
      var li=el('li',(x===an.best?'mt-best ':'')+(!x.futur?'mt-past ':'')+(x.v<=8?'mt-calme':x.v>14?'mt-vente':''));
      var c=el('span','mt-pic',x.pr>=.3?'🌧️':x.sf>=.6?'☀️':x.sf>=.4?'🌤️':x.sf>=.15?'⛅':'☁️');c.setAttribute('aria-hidden','true');
      li.title=hh(x.h)+L(' : vent ',': wind ')+Math.round(x.v)+L(' km/h, rafales ',' km/h, gusts ')+Math.round(x.g)+' km/h'+(x.t!=null?', '+Math.round(x.t)+' °C':'');li.setAttribute('aria-label',li.title);
      var w=el('b',null,Math.round(x.v));w.append(el('small','mt-u',' km/h'));
      li.append(el('span',null,hh(x.h)),w,c,el('span','mt-tp',x.t!=null?Math.round(x.t)+' °C':''));ol.append(li);
    });
    return ol;
  }

  window.ALR_METEO={forecast:forecast,analyse:analyse,nuages:nuages,icSat:icSat,bloc:bloc,WEBCAMS:WEBCAMS,WEBCAMS_ON:false};
})();
