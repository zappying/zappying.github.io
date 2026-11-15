/* zappying shared Google sign-in + cloud save (Firebase Auth + Firestore, project space-xxx).
   Every game on this site can include it: <script src="/zap-auth.js"></script>
   Then: zapAuth.syncKeys(['my-best-key']) keeps those localStorage keys in the player's cloud save
   (numbers keep the higher value, text keeps the device value unless it is empty). */
(() => {
  const CFG = {apiKey:'AIzaSyAOEpHjYw322A0Vfrjmp2KNw9WAYUGURtg', authDomain:'space-xxx.firebaseapp.com', projectId:'space-xxx'};
  const V = '10.12.2', subs = new Set();
  let user = null, db = null, synced = [], pushT = null, readyRes, readyRej;
  const ready = new Promise((a, b) => { readyRes = a; readyRej = b; });
  const load = src => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  const ls = { get: k => { try { return localStorage.getItem(k); } catch(e){ return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch(e){} } };

  async function boot(){
    if (!(window.firebase && firebase.auth && firebase.firestore)){
      for (const m of ['app', 'auth', 'firestore']) await load(`https://cdn.jsdelivr.net/npm/firebase@${V}/firebase-${m}-compat.js`);
    }
    if (!firebase.apps.length) firebase.initializeApp(CFG);
    db = firebase.firestore();
    let first = true;
    firebase.auth().onAuthStateChanged(u => {
      user = u;
      if (first){ first = false; readyRes(u); }
      subs.forEach(f => { try { f(u); } catch(e){} });
      if (u && synced.length) pull();
    });
    firebase.auth().getRedirectResult().catch(() => {});
  }
  boot().catch(e => readyRej(e));

  const doc = () => db.collection('saves').doc(user.uid);
  async function pull(){
    if (!user) return;
    try {
      const snap = await doc().get(), cloud = (snap.exists && snap.data().kv) || {}, out = {};
      for (const k of synced){
        const l = ls.get(k), c = cloud[k];
        let v = l;
        if (c != null){
          const ln = Number(l), cn = Number(c);
          if (l == null || l === '') v = c;
          else if (!isNaN(ln) && !isNaN(cn) && String(l).trim() !== '' ) v = String(Math.max(ln, cn));
        }
        if (v != null){ out[k] = String(v); if (v !== l) ls.set(k, String(v)); }
      }
      await doc().set({kv: out, ku: firebase.firestore.FieldValue.serverTimestamp()}, {merge: true});
    } catch(e){}
  }
  async function push(){
    if (!user || !synced.length) return;
    const kv = {}; for (const k of synced){ const v = ls.get(k); if (v != null) kv[k] = String(v); }
    try { await doc().set({kv, ku: firebase.firestore.FieldValue.serverTimestamp()}, {merge: true}); } catch(e){}
  }
  addEventListener('pagehide', () => { if (user) push(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && user) push(); });

  window.zapAuth = {
    ready,
    user: () => user,
    onChange: f => { subs.add(f); return () => subs.delete(f); },
    async signIn(){
      await ready.catch(() => {});
      const p = new firebase.auth.GoogleAuthProvider();
      try { await firebase.auth().signInWithPopup(p); }
      catch(e){ if (e && e.code === 'auth/popup-closed-by-user') return; try { await firebase.auth().signInWithRedirect(p); } catch(e2){} }
    },
    signOut: async () => { await push(); return firebase.auth().signOut(); },
    syncKeys(keys){ synced = [...new Set([...synced, ...keys])]; if (user) pull(); clearInterval(pushT); pushT = setInterval(push, 30000); },
    push
  };
})();
