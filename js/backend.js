// Pont entre le site et Supabase : expose la même interface que la maquette
// (db, user, assets) pour que le code de la page reste identique.
(function(){
  const cfg=window.ALR_CONFIG||{};
  if(!cfg.url||!cfg.anonKey||!window.supabase)return; // sans base : le site s'affiche avec ses textes par défaut
  const sb=window.supabase.createClient(cfg.url,cfg.anonKey);
  const fail=(e)=>{const err=new Error(e&&e.message||'erreur');err.code=(e&&(e.code||e.status))||'erreur';return err};
  const split=p=>{const i=p.indexOf('/');return [p.slice(0,i),p.slice(i+1)]};
  const snapDoc=(id,data)=>({id,exists:!!data,data:()=>data||undefined});
  const snapCol=rows=>({empty:!rows.length,docs:rows.map(r=>snapDoc(r.id,r.data))});
  async function fetchCol(c){const {data,error}=await sb.from('docs').select('id,data').eq('collection',c);if(error)throw fail(error);return data}
  async function fetchDoc(c,id){const {data,error}=await sb.from('docs').select('id,data').eq('collection',c).eq('id',id).maybeSingle();if(error)throw fail(error);return data&&data.data}
  const watchers={};
  function watch(c,fn){
    if(!watchers[c]){watchers[c]=[];
      sb.channel('docs-'+c).on('postgres_changes',{event:'*',schema:'public',table:'docs',filter:'collection=eq.'+c},()=>watchers[c].forEach(f=>f())).subscribe();}
    watchers[c].push(fn);
  }
  // Recharge au retour sur l'onglet (le temps réel peut s'interrompre en veille)
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)Object.values(watchers).flat().forEach(f=>f())});
  // Après une écriture, on rafraîchit aussi localement (le temps réel ne signale pas toujours les suppressions)
  const touch=c=>setTimeout(()=>(watchers[c]||[]).forEach(f=>f()),50);
  const db={
    doc(path){const [c,id]=split(path);return{
      async get(){return snapDoc(id,await fetchDoc(c,id))},
      async set(data){const {error}=await sb.from('docs').upsert({collection:c,id,data,updated_at:new Date().toISOString()});if(error)throw fail(error);touch(c)},
      async update(patch){const cur=await fetchDoc(c,id)||{};await this.set(Object.assign({},cur,patch))},
      async delete(){const {error}=await sb.from('docs').delete().eq('collection',c).eq('id',id);if(error)throw fail(error);touch(c)},
      onSnapshot(ok,ko){const run=()=>fetchDoc(c,id).then(d=>ok(snapDoc(id,d)),e=>ko&&ko(e));run();watch(c,run);return()=>{}}
    }},
    collection(c){return{
      async get(){return snapCol(await fetchCol(c))},
      onSnapshot(ok,ko){const run=()=>fetchCol(c).then(r=>ok(snapCol(r)),e=>ko&&ko(e));run();watch(c,run);return()=>{}}
    }}
  };
  async function session(){const {data}=await sb.auth.getSession();return data.session}
  let adminCache=null;
  const user={
    async currentId(){const s=await session();return s?s.user.id:null},
    // Crée une identité anonyme au premier vote ou à la première inscription
    async id(){const s=await session();if(s)return s.user.id;const {data,error}=await sb.auth.signInAnonymously();if(error)throw fail(error);return data.user.id},
    async canEdit(){const s=await session();if(!s||s.user.is_anonymous)return false;if(adminCache!==null)return adminCache;
      const {data}=await sb.rpc('is_admin');adminCache=!!data;return adminCache},
    async login(email,password){adminCache=null;const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw fail(error)},
    async logout(){adminCache=null;await sb.auth.signOut()},
    async email(){const s=await session();return s&&!s.user.is_anonymous?s.user.email:''}
  };
  const assets={
    async upload(blob,opt){const ext=(opt&&opt.type||blob.type)==='image/webp'?'webp':'jpg';
      const path=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
      const {error}=await sb.storage.from('photos').upload(path,blob,{contentType:(opt&&opt.type)||blob.type,cacheControl:'31536000'});
      if(error)throw fail(error);
      return {id:path,url:sb.storage.from('photos').getPublicUrl(path).data.publicUrl,sizeBytes:blob.size,contentType:blob.type}},
    async delete(id){const {error}=await sb.storage.from('photos').remove([id]);if(error)throw fail(error);return{deleted:true}}
  };
  window.claude={use:async n=>{
    if(n==='db')return db;if(n==='user')return user;
    if(n==='assets')return (await user.canEdit())?assets:null;
    return null}};
})();
