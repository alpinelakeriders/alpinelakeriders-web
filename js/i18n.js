// Version anglaise du site.
// Le français reste la langue par défaut. ?lang=en (ou le choix mémorisé) affiche le site en anglais :
// les textes de la page, y compris ceux créés en JavaScript (agenda, météo, températures), sont
// traduits à la volée grâce au dictionnaire ci-dessous (texte français exact -> texte anglais)
// et à quelques règles pour les textes variables (dates, heures, nombres).
// L'administration et les récits des comptes rendus ne sont pas traduits.
// Pour traduire un nouveau texte : ajouter une ligne « 'texte français': 'English text' » dans D.
(function(){
  var qs={};try{qs=new URLSearchParams(location.search)}catch(e){}
  var asked=String((qs.get&&qs.get('lang'))||'').toLowerCase(),saved=null;
  try{saved=localStorage.getItem('alr-lang')}catch(e){}
  if(asked==='en'||asked==='fr'){try{localStorage.setItem('alr-lang',asked)}catch(e){}}
  var lang=asked==='en'||asked==='fr'?asked:(saved==='en'?'en':'fr');
  var EN=lang==='en';
  window.ALR_LANG=lang;
  window.ALR_L=function(fr,en){return EN?en:fr};

  // Lien vers la même page dans l'autre langue
  function urlFor(l){
    var u=new URL(location.href);
    if(l==='en')u.searchParams.set('lang','en');else u.searchParams.set('lang','fr');
    return u.pathname+u.search+u.hash;
  }
  // Heures à l'anglaise : 15h -> 3pm, 18h30 -> 6:30pm
  function hour(h,m){h=+h;m=m==null?0:+m;var s=(h%12||12)+(m?':'+String(m).padStart(2,'0'):'');return s+(h<12||h===24?'am':'pm')}
  function times(s){return s.replace(/\b(\d{1,2})\s?h\s?(\d{2})?\b/g,function(_,h,m){return +h<=24?hour(h,m):_})}
  window.ALR_I18N={lang:lang,url:urlFor,hour:hour,times:times};

  // Sélecteur FR / EN (barre du haut de chaque page)
  function addSwitch(){
    var bar=document.querySelector('.topbar .wrap')||document.querySelector('body > .top .wrap');
    if(!bar||bar.querySelector('.lang-sw'))return;
    var st=document.createElement('style');
    st.textContent='.lang-sw{display:inline-flex;align-items:center;gap:2px;font:500 12px/1 var(--mono,ui-monospace,monospace);letter-spacing:.04em;flex:none}'+
      '.lang-sw a{padding:7px 6px;border-radius:6px;color:var(--muted)!important;text-decoration:none}.lang-sw a:hover{color:var(--fg)!important}'+
      '.lang-sw a[aria-current]{color:var(--fg)!important;font-weight:600}.lang-sw i{font-style:normal;color:var(--line)}'+
      '@media (max-width:860px){.topbar .lang-sw{margin-left:auto}.topbar .lang-sw~.a2hs-top,.topbar .a2hs-top~.lang-sw{margin-left:0}}'+
      '.top .lang-sw{margin-left:auto}';
    document.head.append(st);
    var w=document.createElement('span');w.className='lang-sw';w.setAttribute('data-noi18n','');
    w.setAttribute('aria-label',EN?'Language':'Langue');
    [['fr','FR','Version française'],['en','EN','English version']].forEach(function(x,i){
      if(i){var sep=document.createElement('i');sep.textContent='/';sep.setAttribute('aria-hidden','true');w.append(sep)}
      var a=document.createElement('a');a.href=urlFor(x[0]);a.textContent=x[1];a.lang=x[0];a.title=x[2];a.hreflang=x[0];
      if(x[0]===lang)a.setAttribute('aria-current','true');
      a.addEventListener('click',function(){try{localStorage.setItem('alr-lang',x[0])}catch(e){}});
      w.append(a);
    });
    var pill=bar.querySelector('.pill');
    if(pill)bar.insertBefore(w,pill);else bar.append(w);
  }
  if(!EN){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addSwitch);else addSwitch();
    return;
  }
  document.documentElement.lang='en';
  // L'adresse garde la langue (utile pour partager le lien)
  if(asked!=='en'){try{history.replaceState(history.state,'',urlFor('en'))}catch(e){}}

  // ---------- Dictionnaire ----------
  var D={
    // Titres et descriptions des pages
    'Alpine Lake Riders · Pumpfoil au lac de la Terrasse':'Alpine Lake Riders · Pumpfoil at Lac de la Terrasse',
    "Alpine Lake Riders, l'association des riders de pumpfoil des lacs alpins : Isère, Savoie, Haute-Savoie. Sessions, Apéros Pumpfoil et initiations au lac de la Terrasse.":'Alpine Lake Riders, the association for pumpfoil riders on the Alpine lakes: Isère, Savoie, Haute-Savoie. Sessions, Apéros Pumpfoil and beginner sessions at Lac de la Terrasse.',
    "Pump, vole, recommence. L'association de pumpfoil des lacs alpins.":'Pump, fly, repeat. The pumpfoil association of the Alpine lakes.',
    'Météo des spots de pumpfoil · Alpine Lake Riders':'Pumpfoil spot weather · Alpine Lake Riders',
    "Température de l'eau, prévision AROME Météo-France, nuages en direct par satellite des spots de pumpfoil autour du lac de la Terrasse.":'Water temperature, AROME Météo-France forecast and live satellite cloud cover for the pumpfoil spots around Lac de la Terrasse.',

    // Menu
    "L'asso":'The club','Agenda':'Events','Débuter':'Get started','Apéros Pumpfoil':'Apéros Pumpfoil','Le spot':'The spot','Lacs':'Lakes',
    'Rejoindre':'Join','Contact':'Contact','Adhérer':'Join us',
    'Pause':'Pause','Lecture':'Play',
    "Un rider en pumpfoil glisse au ras de l'eau verte du lac de la Terrasse, face à la Dent de Crolles":'A pumpfoil rider glides just above the green water of Lac de la Terrasse, facing the Dent de Crolles',

    // Température de l'eau et météo
    "Température de l'eau · Lac de la Terrasse":'Water temperature · Lac de la Terrasse',
    "Température de l'eau":'Water temperature','Historique':'History',
    'Température et météo des spots':'Water temperature and weather at nearby','de pumpfoil':'pumpfoil','environnants':'spots',
    'Tout voir ↗':'See all ↗','Infos du spot':'Spot news',
    '≈ 0 °C · glace':'≈ 0 °C · ice','Mesures des 12 derniers mois':'Readings over the last 12 months',
    'Lacs environnants':'Nearby lakes',
    "La dernière température de surface mesurée sur les plans d'eau autour du lac de la Terrasse. Relevés automatiques à chaque passage satellite sans nuage ; au lac du Bourget, la sonde du Grand Port d'Aix-les-Bains prend le relais lorsqu'elle transmet.":"The latest surface temperature measured on the lakes around Lac de la Terrasse. Readings are taken automatically at every cloud-free satellite pass; at Lac du Bourget, the probe at the Grand Port of Aix-les-Bains takes over whenever it is transmitting.",
    'Chargement des mesures…':'Loading readings…','Mesures indisponibles pour le moment.':'Readings unavailable for the moment.',
    'Détails et historiques':'Details and history','Réduire':'Show less','Toute la météo et les satellites ↗':'All the weather and satellite images ↗',
    "Satellite : images infrarouges traitées par notre algorithme, température de la pellicule de surface vers 10h30, ±2 °C ; moins précis sur les petits plans d'eau (Chartreuse, Lônes, Passy), où les berges influencent la mesure. Sonde : Grand Port d'Aix-les-Bains, 1,70 m sous le ponton (source lac-du-bourget.com).":"Satellite: infrared satellite images processed by our algorithm, temperature of the surface skin around 10:30am, ±2 °C; less accurate on small lakes (Chartreuse, Lônes, Passy), where the banks affect the reading. Probe: Grand Port of Aix-les-Bains, 1.70 m below the pontoon (source: lac-du-bourget.com).",
    'Sonde':'Probe','Satellite':'Satellite','Pas encore de passage sans nuage.':'No cloud-free pass yet.',

    // L'association
    "L'association":'The association',
    'Pump, vole, recommence.':'Pump, fly, repeat.','Pump, Fly, Glide.':'Pump, Fly, Glide.',
    "L'association des riders de pumpfoil des lacs alpins : Isère, Savoie, Haute-Savoie.":'The association for pumpfoil riders on the Alpine lakes: Isère, Savoie, Haute-Savoie.',
    'riders inscrits':'registered riders','Apéros Pumpfoil organisés':'Apéros Pumpfoil held','ponton flottant':'floating pontoon',
    "Alpine Lake Riders rassemble les pratiquants de pumpfoil des lacs alpins. Née au lac de la Terrasse, l'association encadre la pratique en Isère, en Savoie et en Haute-Savoie, pour que chacun puisse rider en sécurité et dans le respect des sites.":'Alpine Lake Riders brings together pumpfoilers on the Alpine lakes. Born at Lac de la Terrasse, the association supervises the sport in Isère, Savoie and Haute-Savoie, so that everyone can ride safely and with respect for the sites.',
    'Encadrer':'Supervise','Conventionner':'Sign agreements','Partager':'Share',
    'Sessions organisées, accompagnement des débutants, règles de sécurité et de bonne cohabitation avec les baigneurs, les pêcheurs et les autres usagers du lac.':'Organised sessions, support for beginners, safety rules and good relations with swimmers, anglers and other lake users.',
    "L'association signe des conventions avec les communes et les gestionnaires des plans d'eau. Un cadre clair permet d'ouvrir de nouveaux spots et de développer la pratique sans risquer d'interdictions.":'The association signs agreements with local councils and lake managers. A clear framework lets us open new spots and grow the sport without risking bans.',
    'Un sport écologique, sans moteur et sans vent, en plein essor. Une glisse unique sur eau plate, entre le surf et la poudreuse, hiver comme été.':'An eco-friendly sport with no engine and no wind, growing fast. A unique glide on flat water, somewhere between surfing and powder snow, winter and summer alike.',

    // Photos
    'Photos des sessions':'Session photos','Sessions · automne 2026':'Sessions · autumn 2026',
    'Photos précédentes':'Previous photos','Photos suivantes':'Next photos','Photo précédente':'Previous photo','Photo suivante':'Next photo','Fermer':'Close',
    'Photos en plein écran':'Full-screen photos',
    'Vue de drone du ponton et des riders sur le lac':'Drone view of the pontoon and riders on the lake',
    'Riders en combinaison sur le ponton, foils à la main':'Riders in wetsuits on the pontoon, foils in hand',
    'Le ponton en L vu du ciel pendant une session':'The L-shaped pontoon seen from above during a session',
    'Départ en dockstart depuis le ponton':'Dockstart from the pontoon',
    "L'eau verte du lac et le ponton":'The green water of the lake and the pontoon',
    'Riders prêts au départ sur le ponton':'Riders ready to start on the pontoon',
    'Session de pumpfoil au lac':'Pumpfoil session on the lake',
    'Apéro Pumpfoil au lac de la Terrasse':'Apéro Pumpfoil at Lac de la Terrasse',
    'Le lac de la Terrasse':'Lac de la Terrasse',
    'Riders réunis sur le ponton avant la session':'Riders gathered on the pontoon before the session',
    'Le ponton du lac de la Terrasse face à la Chartreuse':'The Lac de la Terrasse pontoon facing the Chartreuse',
    'Photos des Apéros Pumpfoil':'Apéro Pumpfoil photos','Photos du lac de la Terrasse':'Photos of Lac de la Terrasse','carrousel':'carousel',

    // Agenda
    'Agenda des sorties':'Upcoming sessions','Pour répondre':'To reply','Prénom':'First name','Nom':'Last name',
    "Chargement de l'agenda…":'Loading events…','Sorties passées':'Past sessions',
    "Pas de sortie programmée pour l'instant. Les prochaines dates sont annoncées sur le groupe WhatsApp.":'No session planned for now. Upcoming dates are announced in the WhatsApp group.',
    'Sortie':'Session','Sortie Alpine Lake Riders':'Alpine Lake Riders session',
    'Voir le compte rendu et les photos →':'See the report and photos →',
    'Sondage de présence':'Attendance poll',
    'Présent pour rider':'Riding',"Présent à l'initiation":'Beginner session',"Présent à l'apéro":'Apéro (drinks)','Présent pour aider':'Helping out',
    'Mettre à jour ma présence':'Update my attendance','Valider ma présence':'Confirm my attendance',
    'Cliquez sur « Valider » pour enregistrer.':'Click “Confirm” to save.','Choisissez puis validez.':'Choose, then confirm.',
    '1 personne présente :':'1 person attending:','Masquer le détail':'Hide details','Voir les personnes présentes':'See who is coming',
    "Personne n'est encore inscrit.":'Nobody has signed up yet.',
    'Copier le lien':'Copy link','Lien copié.':'Link copied.',
    'Prochaine':'Next','À venir':'Upcoming','Passée':'Past',
    'Sondage indisponible pour le moment.':'Poll unavailable for the moment.',
    "Indiquez votre prénom et votre nom en haut de l'agenda.":'Enter your first and last name at the top of the events list.',
    'Enregistrement…':'Saving…','Réponse non enregistrée, réessayez.':'Response not saved, please try again.',
    'Votre présence a été retirée.':'Your attendance has been removed.',
    'Ponton du lac de la Terrasse':'Lac de la Terrasse pontoon','Ride libre':'Free ride',
    'Ride libre, initiation et apéro. Inscrivez-vous pour la dernière avant la fermeture des pontons.':'Free ride, beginner session and apéro. Sign up for the last one before the pontoons close.',

    // Messages
    'Important':'Important','Info':'Info','Message':'Message',
    'Ponton fermé du 1er novembre au 18 décembre':'Pontoon closed from 1 November to 18 December',
    "L'accès au camping étant fermé, nous n'avons temporairement plus accès au ponton. Durant cette période, il est possible de partir de l'autre côté de la berge, sans aller sur les pontons : utilisez vos échelles. Selon le niveau de l'eau, départ possible depuis les souches en face.":"As the campsite access is closed, we temporarily no longer have access to the pontoon. During this period, you can start from the other side of the bank without going onto the pontoons: use your ladders. Depending on the water level, you can also start from the tree stumps opposite.",

    // Comptes rendus
    'Comptes rendus':'Session reports','Retour sur les dernières sorties':'A look back at recent sessions','Comptes rendus précédents':'Earlier reports',
    "👍 J'aime":'👍 Like','Impossible pour le moment.':'Not possible right now.','Impossible pour le moment, réessayez plus tard.':'Not possible right now, please try again later.',
    'Partager sur WhatsApp':'Share on WhatsApp','Partager sur Facebook':'Share on Facebook','Partager sur Instagram':'Share on Instagram',
    'Choisissez Instagram dans la liste. Le texte et le lien sont copiés : collez-les en légende.':'Choose Instagram from the list. The text and link have been copied: paste them as your caption.',
    'Lien copié : collez-le dans votre story Instagram (sticker « Lien »).':'Link copied: paste it into your Instagram story (“Link” sticker).',

    // Au programme
    'Au programme':"What we do",'Sans vent, sans moteur':'No wind, no engine','Pumpfoil':'Pumpfoil','Initiation':'Beginner sessions','Partage':'Sharing',
    "On partage une passion unique : voler et glisser au-dessus de l'eau. La sensation d'être au milieu d'un champ de poudreuse, de surfer sur une eau plate, sur un lac transparent.":'We share a unique passion: flying and gliding above the water. The feeling of riding through a field of powder snow, of surfing on flat water, on a crystal-clear lake.',
    "Damien vous transmet sa passion et vous fait découvrir le dockstart, un sport ultra complet, unique et très addictif. Alpinefoil met le matériel à disposition pour découvrir l'activité.":'Damien shares his passion and introduces you to the dockstart, an all-round, unique and highly addictive sport. Alpinefoil provides the gear so you can give it a try.',
    "Le pumpfoil, c'est un peu comme un skatepark : on est tous là les uns pour les autres, pour s'entraider, se conseiller, se coacher. Et souvent, tout se termine autour d'un bon apéro, pour clôturer une belle journée de convivialité.":"Pumpfoiling is a bit like a skatepark: we're all there for each other, to help out, give tips and coach one another. And it often ends with a good apéro to round off a great, friendly day.",

    // Débuter
    'Débuter en pumpfoil':'Getting started in pumpfoil','Les bons conseils':'Good advice',
    "Le pumpfoil s'apprend vite quand on part du bon pied. Voici l'essentiel pour vos premières sessions, testé au ponton par les riders de l'asso.":"Pumpfoiling is quick to learn if you start off on the right foot. Here are the essentials for your first sessions, tested at the pontoon by the club's riders.",
    'Le bon matériel':'The right gear','Protégez-vous':'Protect yourself','La bonne position':'The right stance','Le geste du pump':'The pumping motion','Le départ':'The start','Dosez l\'effort':'Pace yourself',
    "Une grande aile avant (1 500 à 2 000 cm²) qui porte à basse vitesse, une planche de pump légère, une combinaison adaptée à la saison. Pas besoin d'acheter tout de suite : l'asso prête du matériel Alpinefoil aux initiations.":"A large front wing (1,500 to 2,000 cm²) that lifts at low speed, a light pump board and a wetsuit suited to the season. No need to buy everything straight away: the club lends Alpinefoil gear at beginner sessions.",
    'Une grande aile avant (1500-2000 cm²) pour la portance à basse vitesse, une planche de pump légère, et une combinaison adaptée à la saison. Pour les initiation Alpinefoil prête le matériel.':'A large front wing (1,500–2,000 cm²) for lift at low speed, a light pump board and a wetsuit suited to the season. Alpinefoil lends the gear for beginner sessions.',
    'Casque obligatoire au début, gilet d\'impact conseillé. Quand vous tombez, tombez à plat, loin de la planche et du foil, et protégez votre tête avec les bras.':'A helmet is a must at the start, and an impact vest is recommended. When you fall, fall flat, away from the board and the foil, and protect your head with your arms.',
    "Casque obligatoire au début, gilet d'impact conseillé, chaussons également.":'A helmet is a must at the start; an impact vest and neoprene boots are recommended too.',
    "Pieds centrés sur l'axe du mât, genoux souples, buste droit, regard loin devant. Le poids légèrement sur le pied avant pour garder le foil sous la surface.":'Feet centred over the mast, knees soft, chest upright, eyes looking far ahead. Weight slightly on the front foot to keep the foil under the surface.',
    "Pieds centrés sur l'axe de la planche, genoux souples, buste droit, regard loin devant. Le poids légèrement sur le pied avant pour garder le foil en glisse.":'Feet centred on the board, knees soft, chest upright, eyes looking far ahead. Weight slightly on the front foot to keep the foil gliding.',
    "Poussez vers le bas avec les jambes, puis relâchez. Petite amplitude, rythme régulier, environ un pompage par seconde. C'est le rythme qui fait voler, pas la force.":"Push down with your legs, then release. Small movements, a steady rhythm, about one pump per second. It's the rhythm that makes you fly, not strength.",
    "Commencez par le départ depuis le ponton bas avec un rider qui vous guide. Une course d'élan, on pose la planche bien à plat, on monte, et on pump tout de suite.":'Start from the low pontoon with a rider guiding you. A short run-up, set the board down nice and flat, step on and start pumping straight away.',
    'Le plus simple est le départ dropstart .':'The easiest way to start is the dropstart.',
    "Le pump est très physique : quelques essais, puis une vraie pause. Mieux vaut dix départs bien faits qu'une heure d'épuisement. Ne ridez jamais seul et gardez vos distances avec le ponton et les autres riders.":'Pumping is very physical: a few attempts, then a proper break. Ten good starts beat an hour of exhaustion. Never ride alone, and keep your distance from the pontoon and other riders.',
    'Le pump est très physique : quelques essais, puis une vraie pause. Ne ridez jamais seul et gardez vos distances avec le ponton et les autres riders.':'Pumping is very physical: a few attempts, then a proper break. Never ride alone, and keep your distance from the pontoon and other riders.',
    'Lire le tuto complet sur le blog Alpinefoil':'Read the full tutorial on the Alpinefoil blog','Venir à une initiation':'Come to a beginner session',

    // Apéro Pumpfoil
    'Le rendez-vous':'The get-together','Apéro Pumpfoil':'Apéro Pumpfoil','Ride':'Ride','Apéro':'Apéro','Dernier':'Last','Prochain':'Next',
    '20h – 22h au snack du lac':'8pm – 10pm at the lake snack bar',
    "18h30 – 21h Chacun apporte ce qu'il faut, on s'installe au snack du lac pendant la fermeture.":"6:30pm – 9pm. Everyone brings something along, and we settle in at the lake snack bar while it's closed for the season.",
    'Rejoindre le groupe WhatsApp':'Join the WhatsApp group',

    // Le spot
    'Lac de la Terrasse':'Lac de la Terrasse',
    'Base de loisirs intercommunale, 38660 La Terrasse. Une eau verte et calme au cœur du Grésivaudan.':'Intercommunal leisure park, 38660 La Terrasse. Calm green water in the heart of the Grésivaudan valley.',

    // Adhésion
    'Adhésion 2027':'Membership 2027','Rejoindre les riders':'Join the riders',
    'Rider':'Rider',"Sessions, apéros, vie de l'asso":'Sessions, apéros, club life','Famille':'Family',"Jusqu'à 4 personnes du foyer":'Up to 4 people in the household',
    'Découverte':'Discovery','Une session accompagnée':'One guided session',
    "Le paiement de l'adhésion s'affichera ici dès que la campagne HelloAsso sera créée.":'Membership payment will appear here as soon as the HelloAsso campaign is set up.',
    'En attendant':'In the meantime',"Inscrivez-vous, on vous recontacte à l'ouverture des adhésions.":"Sign up and we'll get back to you when membership opens.",
    'E-mail':'Email','Téléphone':'Phone','Niveau':'Level','Débutant':'Beginner','Intermédiaire':'Intermediate','Avancé':'Advanced',
    "M'inscrire":'Sign me up','Groupe WhatsApp Alpine Lake PumpFoil Riders':'Alpine Lake PumpFoil Riders WhatsApp group',
    'Prénom, nom et e-mail valide requis.':'First name, last name and a valid email are required.','Envoi…':'Sending…',
    'Inscription indisponible pour le moment.':'Sign-up unavailable for the moment.','Merci, inscription enregistrée.':'Thank you, you are signed up.',

    // Contact
    'Nous contacter':'Contact us','Une question ?':'Any questions?','Une question ?':'Any questions?',
    'Écrivez-nous ou envoyez un message WhatsApp : on vous répond rapidement.':"Write to us or send a WhatsApp message: we'll get back to you quickly.",
    'Écrire sur WhatsApp':'Message us on WhatsApp','Réseaux sociaux':'Social media','Suivez-nous sur les réseaux':'Follow us on social media','Groupe WhatsApp':'WhatsApp group',
    'Formulaire':'Form','Laissez-nous un message.':'Leave us a message.',
    "Téléphone (facultatif, pour qu'on vous rappelle)":'Phone (optional, if you would like us to call you back)','Envoyer':'Send','Site web':'Website',
    'Indiquez votre nom.':'Please enter your name.','Adresse e-mail invalide.':'Invalid email address.','Numéro de téléphone invalide.':'Invalid phone number.',
    'Votre message est un peu court.':'Your message is a bit short.','Merci, message envoyé.':'Thank you, message sent.',
    'Merci, message envoyé. On vous répond vite.':"Thank you, message sent. We'll reply soon.",
    'Trop de messages en ce moment, réessayez dans quelques minutes.':'Too many messages right now, please try again in a few minutes.',

    // Partenaire et pied de page
    'Partenaire':'Partner','Alpinefoil, site officiel':'Alpinefoil, official website',
    'Foils conçus et fabriqués au Touvet, à 5 minutes du lac.':'Foils designed and made in Le Touvet, 5 minutes from the lake.',
    'Alpine Lake Riders, retour en haut':'Alpine Lake Riders, back to top',
    '© 2027 Alpine Lake Riders · Association loi 1901 · La Terrasse, Isère':'© 2027 Alpine Lake Riders · Non-profit association (French law of 1901) · La Terrasse, Isère',
    'Mentions légales · Statuts ·':'Legal notice · Statutes ·',
    'Cookies':'Cookies',
    'Nous aimerions mesurer la fréquentation du site avec Google Analytics. Elles servent uniquement à améliorer le site. Vous acceptez ?':"We'd like to measure visits to the site with Google Analytics. The data is only used to improve the site. Do you accept?",
    'Accepter':'Accept','Refuser':'Decline',

    // Page « Météo des spots de pumpfoil »
    'Météo des spots de pumpfoil':'Pumpfoil spot weather',
    "Pour chaque spot de pumpfoil : la dernière température de l'eau, la prévision du jour (modèle AROME de Météo-France), la meilleure heure pour rider, et les nuages en direct vus par satellite.":"For each pumpfoil spot: the latest water temperature, today's forecast (Météo-France AROME model), the best time to ride, and live cloud cover seen by satellite.",
    'Aller à un spot':'Go to a spot','Chargement des spots…':'Loading spots…','Spots indisponibles pour le moment.':'Spots unavailable for the moment.',
    'Eau':'Water','Pas encore de mesure.':'No reading yet.','Pas de webcam publique connue sur ce spot.':'No known public webcam at this spot.',
    "Température de l'eau : images satellites infrarouges traitées par notre algorithme (pellicule de surface vers 10h30, ±2 °C) et sonde du Grand Port d'Aix-les-Bains (lac-du-bourget.com). Prévision : AROME Météo-France via Open-Meteo, mise à jour toutes les heures. Nuages en direct : satellites Meteosat (EUMETSAT), nouvelle image toutes les 10 à 15 minutes.":'Water temperature: infrared satellite images processed by our algorithm (surface skin around 10:30am, ±2 °C) and the probe at the Grand Port of Aix-les-Bains (lac-du-bourget.com). Forecast: AROME Météo-France via Open-Meteo, updated every hour. Live clouds: Meteosat satellites (EUMETSAT), new image every 10 to 15 minutes.',
    "La meilleure heure privilégie le vent faible (plan d'eau lisse), puis le soleil. Pastille verte : vent jusqu'à 8 km/h ; orange : jusqu'à 14 km/h ; rouge au-delà.":'The best time favours light wind (smooth water), then sunshine. Green dot: wind up to 8 km/h; orange: up to 14 km/h; red above that.'
  };
  // Raccourcis des choix de présence (« Vous êtes inscrit : rider, initiation »)
  var SHORT={'rider':'riding',"l'initiation":'beginner session',"l'apéro":'apéro','initiation':'beginner session','apéro':'apéro','aider':'helping out'};
  var MOIS={janvier:'January','février':'February',mars:'March',avril:'April',mai:'May',juin:'June',juillet:'July','août':'August',septembre:'September',octobre:'October',novembre:'November','décembre':'December'};
  var MC={'janv.':'Jan','févr.':'Feb','mars':'Mar','avr.':'Apr','mai':'May','juin':'Jun','juil.':'Jul','août':'Aug','sept.':'Sep','oct.':'Oct','nov.':'Nov','déc.':'Dec'};
  var JOURS={dimanche:'Sunday',lundi:'Monday',mardi:'Tuesday',mercredi:'Wednesday',jeudi:'Thursday',vendredi:'Friday',samedi:'Saturday'};
  var JC={'dim.':'Sun','lun.':'Mon','mar.':'Tue','mer.':'Wed','jeu.':'Thu','ven.':'Fri','sam.':'Sat'};
  var reM='(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)';
  var reMC='(janv\\.|févr\\.|mars|avr\\.|mai|juin|juil\\.|août|sept\\.|oct\\.|nov\\.|déc\\.)';
  var reJ='(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)';
  var low=function(s){return s.toLowerCase()};
  var or=function(s){var t=tr(s);return t==null?s:t};
  var dec=function(s){return s.replace(/(\d),(\d)/g,'$1.$2')};
  // Règles pour les textes variables (expression -> fonction qui renvoie l'anglais)
  var R=[
    [new RegExp('^'+reJ+' (\\d{1,2}) '+reM+' (\\d{4})(.*)$','i'),function(m){var r=m[5]||'';return JOURS[low(m[1])]+' '+m[2]+' '+MOIS[low(m[3])]+' '+m[4]+(/^ · /.test(r)?' · '+or(r.slice(3)):r)}],
    [new RegExp('^(\\d{1,2}) '+reM+'( \\d{4})?$','i'),function(m){return m[1]+' '+MOIS[low(m[2])]+(m[3]||'')}],
    [new RegExp('^(\\d{1,2}) '+reMC+'( \\d{4})?$','i'),function(m){return m[1]+' '+MC[low(m[2])]+(m[3]||'')}],
    [new RegExp('^(dim\\.|lun\\.|mar\\.|mer\\.|jeu\\.|ven\\.|sam\\.) (\\d{4})$','i'),function(m){return JC[low(m[1])]+' '+m[2]}],
    [new RegExp('^(dim|lun|mar|mer|jeu|ven|sam)\\.? (\\d{1,2}) '+reMC+'$','i'),function(m){return JC[low(m[1])+'.']+' '+m[2]+' '+MC[low(m[3])]}],
    [/^(≈ )?-?\d+,\d °C$/,function(m){return dec(m[0])}],
    [new RegExp('^Mesure satellite du (\\d{1,2}) '+reM+' \\(dernier passage sans nuage\\) · surface vers 10h30 · ±2 °C$'),function(m){return 'Satellite reading of '+m[1]+' '+MOIS[m[2]]+' (last cloud-free pass) · surface around 10:30am · ±2 °C'}],
    [new RegExp('^Mesure directe du (\\d{1,2}) '+reM+' à (\\d{1,2})h(\\d{2})$'),function(m){return 'Direct reading on '+m[1]+' '+MOIS[m[2]]+' at '+hour(m[3],m[4])}],
    [new RegExp('^sonde, (\\d{1,2}) '+reMC+'$'),function(m){return 'probe, '+m[1]+' '+MC[m[2]]}],
    [new RegExp('^Passage sans nuage du (\\d{1,2}) '+reM+'$'),function(m){return 'Cloud-free pass on '+m[1]+' '+MOIS[m[2]]}],
    [new RegExp('^Sonde, (\\d{1,2}) '+reM+' à (\\d{1,2})h(\\d{2})$'),function(m){return 'Probe, '+m[1]+' '+MOIS[m[2]]+' at '+hour(m[3],m[4])}],
    [new RegExp('^Satellite, passage sans nuage du (\\d{1,2}) '+reM+'$'),function(m){return 'Satellite, cloud-free pass on '+m[1]+' '+MOIS[m[2]]}],
    [/^Mesures satellite des 12 derniers mois, (.*)$/,function(m){return 'Satellite readings over the last 12 months, '+m[1]}],
    [/^Voir les (\d+) spots et les historiques$/,function(m){return 'See all '+m[1]+' spots and history'}],
    [/^(Prévision|En direct) : (.*)$/,function(m){return (m[1]==='Prévision'?'Forecast: ':'Live: ')+or(m[2])}],
    [/^(C'est noté, merci ! )?Vous êtes inscrit : (.*)\.$/,function(m){return (m[1]?'Got it, thanks! ':'')+"You're signed up: "+m[2].split(', ').map(function(x){return SHORT[low(x)]||or(x)}).join(', ')+'.'}],
    [/^(\d+) personnes présentes :$/,function(m){return m[1]+' people attending:'}],
    [/^Réponse non enregistrée \((.*)\)\.$/,function(m){return 'Response not saved ('+m[1]+').'}],
    [new RegExp("^Jusqu'au (\\d{1,2}) "+reMC+'$'),function(m){return 'Until '+m[1]+' '+MC[m[2]]}],
    [/^Envoi impossible pour le moment\. Écrivez-nous directement à (.*)\.$/,function(m){return 'Sending failed for now. Please email us directly at '+m[1]+'.'}],
    [/^Envoi impossible pour le moment \((.*)\)\.$/,function(m){return 'Sending failed for now ('+m[1]+').'}],
    [/^Voir la photo (\d+)$/,function(m){return 'View photo '+m[1]}],
    [/^Photos de la sortie : (.*)$/,function(m){return 'Session photos: '+or(m[1])}],
    [/^J'aime( \(\d+\))?$/,function(m){return 'Like'+(m[1]||'')}],
    [/^(.*) € \/ an$/,function(m){return m[1]+' € / year'}],
    [/^(.*\d\s?h.*) au ponton$/,function(m){return times(m[1])+' at the pontoon'}],
    [/^(.*\d\s?h.*) au snack du lac$/,function(m){return times(m[1])+' at the lake snack bar'}],
    [/^(\d+)e édition, (.*)$/,function(m){return 'Edition '+m[1]+', '+or(m[2])}],
    [/^\d{1,2}\s?h\s?(\d{2})?(\s?[–-]\s?\d{1,2}\s?h\s?(\d{2})?)?$/,function(m){return times(m[0])}]
  ];

  var cache=new Map();
  function norm(s){return String(s).replace(/[’]/g,"'").replace(/\s+/g,' ').trim()}
  function tr(s){
    var k=norm(s);if(!k)return null;
    if(cache.has(k))return cache.get(k);
    var out=null;
    if(Object.prototype.hasOwnProperty.call(D,k))out=D[k];
    else if(/^[a-z]/.test(k)&&Object.prototype.hasOwnProperty.call(D,k.charAt(0).toUpperCase()+k.slice(1))){var u=D[k.charAt(0).toUpperCase()+k.slice(1)];out=u.charAt(0).toLowerCase()+u.slice(1)}
    else{
      for(var i=0;i<R.length;i++){var m=k.match(R[i][0]);if(m){out=R[i][1](m);break}}
      // Textes composés « A · B · C » : chaque morceau est traduit séparément
      if(out==null&&k.indexOf(' · ')>0){var ch=false,parts=k.split(' · ').map(function(x){var t=tr(x);if(t!=null&&t!==x){ch=true;return t}return x});if(ch)out=parts.join(' · ')}
    }
    if(cache.size>3000)cache.clear();
    cache.set(k,out);return out;
  }
  window.ALR_I18N.t=function(s){var t=tr(s);return t==null?s:t};

  // ---------- Application à la page ----------
  var SKIP='#admin,#pv-dlg,.cr-recit,[data-noi18n],script,style,textarea,noscript,code';
  var ATTRS=['alt','title','aria-label','placeholder','aria-roledescription'];
  function skipped(el){return !el||el.nodeType!==1||!!(el.closest&&el.closest(SKIP))}
  function doText(n){
    var v=n.nodeValue;if(!v||!/[A-Za-zÀ-ÿ]/.test(v))return;
    var t=tr(v);if(t==null)return;
    if(t==='Last name'&&n.parentNode.closest&&n.parentNode.closest('#cf'))t='Name'; // formulaire de contact : nom complet
    var nv=v.match(/^\s*/)[0]+t+v.match(/\s*$/)[0];if(nv!==v)n.nodeValue=nv;
  }
  function doAttr(el,a){var v=el.getAttribute(a);if(!v)return;var t=tr(v);if(t!=null&&t!==v)el.setAttribute(a,t)}
  function doEl(el){for(var i=0;i<ATTRS.length;i++)if(el.hasAttribute(ATTRS[i]))doAttr(el,ATTRS[i]);
    // Liens internes : on garde la version anglaise
    if(el.tagName==='A'){var h=el.getAttribute('href');if(h&&/^(\/|lacs\.html|\/lacs\.html)(#.*)?$/.test(h)){var p=h.split('#');el.setAttribute('href',p[0]+'?lang=en'+(p[1]?'#'+p[1]:''))}}}
  function walk(root){
    if(root.nodeType===3){if(!skipped(root.parentNode))doText(root);return}
    if(root.nodeType!==1||skipped(root))return;
    doEl(root);
    var w=document.createTreeWalker(root,5,{acceptNode:function(n){return n.nodeType===1&&n.matches(SKIP)?2:1}});
    var n;while((n=w.nextNode())){if(n.nodeType===3)doText(n);else doEl(n)}
  }
  function doHead(){
    var t=tr(document.title);if(t!=null&&t!==document.title)document.title=t;
    ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]','meta[property="og:image:alt"]'].forEach(function(s){var m=document.querySelector(s);if(m)doAttr(m,'content')});
  }
  var obs=new MutationObserver(function(list){
    for(var i=0;i<list.length;i++){var m=list[i],tg=m.target;
      if(tg.nodeName==='TITLE'||(tg.parentNode&&tg.parentNode.nodeName==='TITLE')||tg.nodeName==='META'){doHead();continue}
      if(m.type==='childList'){if(tg.nodeType===1&&skipped(tg))continue;for(var j=0;j<m.addedNodes.length;j++)walk(m.addedNodes[j])}
      else if(m.type==='characterData'){if(!skipped(tg.parentNode))doText(tg)}
      else if(m.type==='attributes'){if(!skipped(tg))doAttr(tg,m.attributeName)}
    }
  });
  obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS.concat(['content'])});
  function ready(){doHead();walk(document.body);addSwitch()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
