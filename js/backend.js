// Pont entre le site et Supabase : expose la même interface que la maquette
// (db, user, assets) pour que le code de la page reste identique.
(function(){
  const cfg=window.ALR_CONFIG||{};
  if(!cfg.url||!cfg.anonKey||!window.supabase)return; // sans base : le site s'affiche avec ses textes par défaut
  const sb=window.supabase.createClient(cfg.url,cfg.anonKey);
  // Lien « mot de passe oublié » : l'événement peut arriver avant que la page écoute
  let recovering=false,recoveryCb=null;
  sb.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY'){recovering=true;if(recoveryCb)setTimeout(recoveryCb,0)}});
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
    // Envoi groupé (import de membres)
    async bulkSet(c,items){
      for(let i=0;i<items.length;i+=200){
        const rows=items.slice(i,i+200).map(x=>({collection:c,id:x.id,data:x.data,updated_at:new Date().toISOString()}));
        const {error}=await sb.from('docs').upsert(rows);if(error)throw fail(error);
      }
      touch(c)},
    async contact(d){
      let {error}=await sb.rpc('envoyer_contact',{p_nom:d.nom,p_email:d.email,p_tel:d.tel||'',p_message:d.message,p_piege:d.piege||''});
      // ancienne version de la fonction (sans téléphone) : le numéro est ajouté au message
      if(error&&/PGRST202|function|schema cache/i.test((error.code||'')+' '+(error.message||''))){
        ({error}=await sb.rpc('envoyer_contact',{p_nom:d.nom,p_email:d.email,p_message:d.message+(d.tel?'\n\nTéléphone : '+d.tel:''),p_piege:d.piege||''}))}
      if(error)throw fail(error);return true},
    async stats(j){const {data,error}=await sb.rpc('stats_visites',{p_jours:j});if(error)throw fail(error);return data},
    async countMembers(){const {data,error}=await sb.rpc('nb_membres');if(error)throw fail(error);return data},
    async clearCollection(c){const {error}=await sb.from('docs').delete().eq('collection',c);if(error)throw fail(error);touch(c)},
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
    async email(){const s=await session();return s&&!s.user.is_anonymous?s.user.email:''},
    // Gestion des administrateurs
    async listAdmins(){const {data,error}=await sb.rpc('list_admins');if(error)throw fail(error);return (data||[]).map(r=>r.email)},
    async addAdmin(email,password){
      if(password){ // crée le compte s'il n'existe pas (client séparé pour ne pas déconnecter l'admin actuel)
        const tmp=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'alr-tmp'}});
        const {error}=await tmp.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
        if(error&&!/registered|exists/i.test(error.message||''))throw fail(error);
      }
      const {data,error}=await sb.rpc('add_admin',{p_email:email});if(error)throw fail(error);return !!data},
    async removeAdmin(email){const {data,error}=await sb.rpc('remove_admin',{p_email:email});if(error)throw fail(error);return data},
    async changePassword(password){const {error}=await sb.auth.updateUser({password});if(error)throw fail(error)},
    async resetPassword(email){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw fail(error)},
    onRecovery(cb){recoveryCb=cb;if(recovering)setTimeout(cb,0)}
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
