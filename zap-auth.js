/* zappying shared Google sign-in + cloud save (Firebase Auth + Firestore, project space-xxx).
   Every game on this site can include it: <script src="/zap-auth.js"></script>
   Then: zapAuth.syncKeys(['my-best-key']) keeps those localStorage keys in the player's cloud save
   (numbers keep the higher value, text keeps the device value unless it is empty). */
(() => {
  const CFG = {apiKey:'AIzaSyAOEpHjYw322A0Vfrjmp2KNw9WAYUGURtg', authDomain:'space-xxx.firebaseapp.com', projectId:'space-xxx'};
  const V = '10.12.2', subs = new Set();
  const NICK = 'spacexxx-nick', CLAIM = 'zap-nick-claimed', CLOUD_FIRST = new Set([NICK, CLAIM]);
  let user = null, db = null, synced = [NICK, CLAIM], pushT = null, readyRes, readyRej, pullP = Promise.resolve();
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
      if (u && synced.length) pullP = pull();
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
          if (l == null || l === '' || (CLOUD_FIRST.has(k) && c !== '')) v = c;
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
    syncKeys(keys){ synced = [...new Set([...synced, ...keys])]; if (user) pullP = pull(); clearInterval(pushT); pushT = setInterval(push, 30000); },
    push,
    _pulled: () => pullP
  };
})();

/* zappying shared nickname: one name for every game, unique across the site, no slurs.
   Auto-binds <input id="nick"> in games (read-only, tap to change) and <div id="zapNickLine"> on the hub. */
(() => {
  const NICK = 'spacexxx-nick', CLAIM = 'zap-nick-claimed';
  const API = 'https://firestore.googleapis.com/v1/projects/space-xxx/databases/(default)/documents/nicks';
  const KEY = 'AIzaSyAOEpHjYw322A0Vfrjmp2KNw9WAYUGURtg';
  const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch(e){ return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch(e){} } };
  const clean = v => String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  const key = v => clean(v).toLowerCase().replace(/[\s._\-]/g, '');
  const LEET = {'0':'o','1':'i','!':'i','|':'i','3':'e','4':'a','@':'a','5':'s','$':'s','7':'t','8':'b','9':'g','+':'t'};
  const norm = v => clean(v).toLowerCase().replace(/[0-9!|@$+]/g, c => LEET[c] || c).replace(/[^\p{L}]/gu, '');
  const col = v => v.replace(/(.)\1+/gu, '$1');
  const BAD_SUB = ['fuck','fuk','fck','shit','bitch','biatch','cunt','nigger','nigga','faggot','fagot','whore','slut','pussy','asshole','arsehole','dildo','blowjob','handjob','jerkoff','motherf','killyourself','molest','pedophile','rapist','wanker','bastard','penis','vagina','porn','hitler','nazi','sexy',
    '씨발','시발','씨빨','씨바','시바','십알','씹','좆','좃','졷','존나','졸라','병신','븅신','빙신','등신','개새','새끼','쌔끼','미친','미쳤','니미','느금','엠창','애미','애비','지랄','썅','섹스','보지','자지','창녀','걸레','한남','김치녀','일베','운지','틀딱','꺼져','닥쳐','호로','쌍놈','쌍년','년아','ㅅㅂ','ㅆㅂ','ㅂㅅ','ㅄ','ㅈㄴ','ㅈㄹ','ㅗ','ㅁㅊ','ㄴㄱㅁ','ㅅㄲ'];
  const BAD_WORD = ['cum','anal','sex','sexy','dick','cock','rape','fag','tits','boob','boobs','kys','pedo','retard','nude','horny','milf','ass','hoe','thot','isis','kkk'];
  const RESERVED = ['admin','administrator','zappy','zappying','official','moderator','mod','gm','staff','system','support','anonymous','null','undefined','root','owner','dev','developer'];
  function check(v){
    const n = clean(v);
    if (n.length < 2) return 'At least 2 characters';
    if (n.length > 12) return 'Up to 12 characters';
    if (!/^[\p{L}\p{N} ._\-]+$/u.test(n)) return 'Letters, numbers, space, . _ - only';
    if (!/[\p{L}\p{N}]/u.test(n)) return 'Use at least one letter or number';
    const raw = n.toLowerCase().replace(/[\s._\-]/g, ''), k = key(n), f = norm(n), fc = col(f).replace(/nigeria/g, '');
    if (RESERVED.includes(k) || RESERVED.includes(f)) return 'That name is reserved';
    if (BAD_SUB.some(w => raw.includes(w) || f.includes(w) || fc.includes(col(w)))) return 'Please pick a friendlier name';
    const words = n.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').split(/[\s._\-]+/).map(norm).filter(Boolean);
    if (BAD_WORD.some(w => f === w || f === w + 's' || words.includes(w) || words.includes(w + 's'))) return 'Please pick a friendlier name';
    return '';
  }
  async function claim(n){
    const id = key(n);
    try {
      const r = await fetch(`${API}?documentId=${encodeURIComponent(id)}&key=${KEY}`, {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({fields:{name:{stringValue:n}, ts:{timestampValue:new Date().toISOString()}}})});
      if (r.ok) return 'ok';
      if (r.status === 409) return 'taken';
      return 'error';
    } catch(e){ return 'error'; }
  }
  const ADJ = ['Swift','Lucky','Brave','Sunny','Fizzy','Jolly','Zippy','Snappy','Bouncy','Cosmic','Turbo','Pixel','Mighty','Sneaky','Happy','Spicy'];
  const ANI = ['Otter','Panda','Fox','Koala','Tiger','Bunny','Gecko','Moose','Owl','Yak','Lynx','Puffin','Hippo','Shark','Duck','Mole'];
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const randomName = () => { let n; do { n = rnd(ADJ) + rnd(ANI) + Math.floor(10 + Math.random() * 90); } while (n.length > 12); return n; };
  const subs = new Set();
  const get = () => clean(ls.get(NICK));
  function apply(n){ ls.set(NICK, n); ls.set(CLAIM, key(n)); subs.forEach(f => { try { f(n); } catch(e){} }); try { window.zapAuth && zapAuth.push(); } catch(e){} }
  async function set(v){
    const n = clean(v), err = check(n);
    if (err) return err;
    if (key(n) === ls.get(CLAIM)){ apply(n); return ''; }   // same name (maybe new casing): already ours
    const r = await claim(n);
    if (r === 'taken') return 'That name is taken, try another';
    if (r === 'error') return 'Couldn’t check the name. Check your connection';
    apply(n); return '';
  }
  let ensured = null;
  function ensure(){
    if (ensured) return ensured;
    ensured = (async () => {
      try { if (window.zapAuth){ const u = await Promise.race([zapAuth.ready.catch(() => null), new Promise(r => setTimeout(r, 2500))]); if (u) await Promise.race([zapAuth._pulled(), new Promise(r => setTimeout(r, 2500))]); } } catch(e){}
      const cur = get();
      if (cur && key(cur) === ls.get(CLAIM)){ apply(cur); return cur; }
      if (cur && !check(cur)){ const r = await claim(cur); if (r === 'ok'){ apply(cur); return cur; } }
      for (let i = 0; i < 6; i++){ const n = randomName(), r = await claim(n); if (r === 'ok'){ apply(n); return n; } if (r === 'error'){ ls.set(NICK, n); subs.forEach(f => f(n)); return n; } }
      return get();
    })();
    return ensured;
  }

  // ---- editor (shared modal) ----
  let box = null;
  function editor(){
    if (box) return box;
    const st = document.createElement('style');
    st.textContent = `.zn-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,12,30,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.zn-ov[hidden]{display:none!important}
.zn-card{width:min(340px,100%);background:#fffaf0;color:#1b1b2f;border:3px solid #1b1b2f;border-radius:18px;box-shadow:0 5px 0 #1b1b2f;padding:18px;box-sizing:border-box;text-align:left}
.zn-card h3{margin:0 0 4px;font-size:20px}.zn-card p{margin:0 0 12px;font-size:13px;color:#5b5670}
.zn-card input{width:100%;box-sizing:border-box;font:inherit;font-size:18px;padding:10px 12px;border:2px solid #1b1b2f;border-radius:12px;background:#fff;color:#1b1b2f}
.zn-err{min-height:18px;margin:6px 0 10px;font-size:13px;color:#d9480f}
.zn-row{display:flex;gap:8px;justify-content:flex-end}
.zn-row button{font:inherit;font-weight:700;font-size:15px;padding:9px 16px;border-radius:12px;border:2px solid #1b1b2f;cursor:pointer;background:#fff;color:#1b1b2f}
.zn-row .zn-ok{background:#ffd43b}.zn-row button:disabled{opacity:.5;cursor:default}
input.zn-bound{cursor:pointer}`;
    document.head.appendChild(st);
    box = document.createElement('div'); box.className = 'zn-ov'; box.hidden = true;
    box.innerHTML = '<div class="zn-card" role="dialog" aria-modal="true" aria-labelledby="znT"><h3 id="znT">Your nickname</h3><p>Shown on leaderboards in every zappying game. 2–12 characters, must be unique.</p><input id="znIn" maxlength="12" autocomplete="off" enterkeyhint="done"><div class="zn-err" id="znErr" role="alert"></div><div class="zn-row"><button type="button" id="znX">Cancel</button><button type="button" class="zn-ok" id="znOk">Save</button></div></div>';
    document.body.appendChild(box);
    const inp = box.querySelector('#znIn'), err = box.querySelector('#znErr'), ok = box.querySelector('#znOk');
    const close = () => { box.hidden = true; };
    box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
    box.querySelector('#znX').onclick = close;
    inp.addEventListener('input', () => { err.textContent = check(inp.value) && inp.value.trim().length >= 2 ? check(inp.value) : ''; });
    ['keydown','keyup','keypress'].forEach(t => inp.addEventListener(t, e => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Enter'){ e.preventDefault(); ok.click(); } if (t === 'keydown' && e.key === 'Escape') close(); }));
    ok.onclick = async () => { ok.disabled = true; err.textContent = 'Checking…'; const e = await set(inp.value); ok.disabled = false; if (e){ err.textContent = e; inp.focus(); } else { err.textContent = ''; close(); } };
    box._open = () => { inp.value = get(); err.textContent = ''; box.hidden = false; setTimeout(() => { inp.focus(); inp.select(); }, 30); };
    return box;
  }
  const open = () => editor()._open();

  function bindInput(el){
    if (!el || el._zn) return; el._zn = 1;
    el.readOnly = true; el.classList.add('zn-bound'); el.title = 'Tap to change your nickname';
    const sync = n => { if (n && el.value !== n){ el.value = n; el.dispatchEvent(new Event('input', {bubbles:true})); } };
    sync(get()); subs.add(sync);
    el.addEventListener('click', e => { e.stopPropagation(); open(); });
    el.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== 'Tab'){ e.preventDefault(); open(); } });
  }
  function bindLine(el){
    if (!el || el._zn) return; el._zn = 1;
    el.innerHTML = 'Playing as <b></b> <button type="button" aria-label="Change nickname">✏️ Change</button>';
    const b = el.querySelector('b'); const draw = n => { b.textContent = n || '…'; }; draw(get()); subs.add(draw);
    el.querySelector('button').onclick = open;
  }
  try { window.zapAuth && zapAuth.onChange(u => { if (u) setTimeout(() => zapAuth._pulled().then(() => { const n = get(); if (n){ if (!ls.get(CLAIM)) ls.set(CLAIM, key(n)); subs.forEach(f => { try { f(n); } catch(e){} }); } }), 0); }); } catch(e){}
  function boot(){ bindInput(document.getElementById('nick')); bindLine(document.getElementById('zapNickLine')); ensure(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.zapNick = { get, set, check, open, ensure, onChange: f => { subs.add(f); return () => subs.delete(f); } };
})();
