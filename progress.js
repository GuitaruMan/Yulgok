/* 아이 학습 페이지 별 기록 저장 — 기기(localStorage) + 서버(Cloudflare kids-progress)
   설계: GuitaruMan/PersonalPages 저장소의 kids-progress-worker/DESIGN.md (이 파일은 그 home/progress.js의 사본)
   사용: const P = KidsProgress("서버 이름표", "기기 저장 키", S, 서버에서 기록이 바뀌었을 때 할 일, 요약 만드는 함수);
         P.save()  — 별·기록이 바뀔 때마다 호출
         P.reset() — 서버 기록까지 지우기 (Promise)
         요약 함수는 "딴 별/전체 별" 글자를 돌려준다. notes._sum 에 함께 저장되어 목록 페이지가 타일 아래에 보여 준다.
         KidsProgress.read("서버 이름표") — 기록 읽기만 (목록 페이지용, Promise) */
(function () {
  "use strict";
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const API = LOCAL ? "http://127.0.0.1:8787" : "https://kids-progress.guitaruman-stock.workers.dev";
  const SYNCED = ["epoch", "stars", "best", "notes", "nt"];
  const RETRY = [5, 15, 30, 60];

  function pill() {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:95;font:700 13px/1 'Nunito','Noto Sans KR',sans-serif;padding:8px 13px;" +
      "border-radius:99px;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.15);transition:opacity .4s;opacity:0;pointer-events:none";
    document.body.append(el);
    let timer = 0;
    return (text, color, stay) => {
      el.textContent = text; el.style.color = color; el.style.opacity = "1";
      clearTimeout(timer);
      if (!stay) timer = setTimeout(() => (el.style.opacity = "0"), 1800);
    };
  }

  window.KidsProgress = function (key, localKey, S, onRemote, summary) {
    S.stars = S.stars || {}; S.best = S.best || {}; S.notes = S.notes || {}; S.nt = S.nt || {};
    let localOk = true;
    try { Object.assign(S, JSON.parse(localStorage.getItem(localKey) || "{}")); } catch (e) { localOk = false; }
    S.nt = S.nt || {};
    if (typeof S.epoch !== "string") S.epoch = "0";
    let lastNotes = Object.assign({}, S.notes);
    let dirty = false, busy = false, again = false, fails = 0, retryTimer = 0, debounce = 0;
    const show = pill();

    function stamp() {                         // 요약이 달라졌으면 고쳐 적고 true
      if (!summary) return false;
      let v;
      try { v = summary(); } catch (e) { return false; }
      if (S.notes._sum === v) return false;
      S.notes._sum = v; return true;
    }
    function writeLocal() {
      try { localStorage.setItem(localKey, JSON.stringify(S)); } catch (e) { localOk = false; }
    }
    // 서버 결과를 받아들인다. 초기화(epoch 변경)면 통째로 바꾸고, 아니면 서버와 같은 규칙으로 합친다
    // (요청이 오가는 사이 새로 얻은 별이 덮어써지지 않도록).
    function adopt(srv) {
      const before = JSON.stringify(SYNCED.map(k => S[k]));
      if (srv.epoch !== S.epoch) SYNCED.forEach(k => { S[k] = srv[k] || (k === "epoch" ? "0" : {}); });
      else {
        for (const k in srv.stars) if (srv.stars[k] > (S.stars[k] || 0)) S.stars[k] = srv.stars[k];
        for (const k in srv.best) if (!S.best[k] || srv.best[k] < S.best[k]) S.best[k] = srv.best[k];
        for (const k in srv.notes) if (!(k in S.notes) || (srv.nt[k] || 0) > (S.nt[k] || 0)) { S.notes[k] = srv.notes[k]; S.nt[k] = srv.nt[k] || 0; }
      }
      lastNotes = Object.assign({}, S.notes);
      return before !== JSON.stringify(SYNCED.map(k => S[k]));
    }
    async function sync(first) {
      if (busy) { again = true; return; }
      busy = true; clearTimeout(retryTimer);
      const body = {};
      SYNCED.forEach(k => (body[k] = S[k]));
      try {
        const r = await fetch(API + "/sync/" + key, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const changed = adopt(await r.json());
        dirty = false; fails = 0; writeLocal();
        if (!first) show("☁️ 저장했어요", "#14703d");
        if (changed && onRemote) onRemote();
        if (stamp()) save();
      } catch (e) {
        fails++;
        show("⚠️ 인터넷 연결을 확인해요 · 별은 이 기기에 보관 중", "#a52328", true);
        retryTimer = setTimeout(() => sync(), RETRY[Math.min(fails - 1, RETRY.length - 1)] * 1000);
      } finally {
        busy = false;
        if (again) { again = false; sync(); }
      }
    }
    function save() {
      stamp();
      for (const k in S.notes) if (S.notes[k] !== lastNotes[k]) S.nt[k] = Date.now();
      lastNotes = Object.assign({}, S.notes);
      dirty = true; writeLocal();
      if (!localOk) show("⏳ 저장 중", "#55617f", true);
      clearTimeout(debounce);
      debounce = setTimeout(() => sync(), 800);
    }
    async function reset() {
      const r = await fetch(API + "/reset/" + key, { method: "POST" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      adopt(await r.json());
      dirty = false; writeLocal();
      if (stamp()) save();
    }
    window.addEventListener("online", () => { if (dirty || fails) sync(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(true); });
    sync(true);
    return { save, reset };
  };
  window.KidsProgress.read = key => fetch(API + "/p/" + key).then(r => (r.ok ? r.json() : null));
})();
