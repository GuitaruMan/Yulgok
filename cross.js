/* 가로세로 퍼즐(크로스워드) — 영어 단어 퍼즐과 수 퍼즐이 함께 쓴다.
   CrossPuzzle.layout(단어들, 최대 가로, 최대 세로) — 단어를 서로 교차시켜 배치 (못 넣은 단어는 뺀다)
   CrossPuzzle.stair(글자열들)                     — 앞 글자열의 끝 글자와 다음 글자열의 첫 글자가 겹치는 계단 모양 배치
   CrossPuzzle.mount(host, 배치, 옵션)             — 화면에 그리고 풀게 한다
     옵션: keys(누를 글자들) · chip(entry) 힌트 내용 · onSelect · onTap · onOk · onMiss · onDone
   색은 페이지의 CSS 변수(--c, --cl, --cd, --ok, --okl, --no, --nol, --gr)를 따른다. */
(function () {
  "use strict";
  const CSS = `
.cxw{display:flex;flex-direction:column;align-items:center;gap:14px}
.cxg{display:grid;gap:0;width:max-content;max-width:100%}
.cxc{width:var(--cx,52px);height:var(--cx,52px);position:relative;background:#fff;box-shadow:inset 0 0 0 1.5px #55678a,0 0 0 1.5px #55678a;
  font:600 calc(var(--cx,52px)*.55)/1 'Fredoka','Jua',sans-serif;color:inherit;padding:0;border-radius:0}
.cxc sup{position:absolute;left:3px;top:3px;font:600 .62rem 'Fredoka',sans-serif;color:var(--cd)}
.cxc.hl{background:var(--cl)}
.cxc.at{background:#FFE9A8}
.cxc.ok{background:var(--okl);color:#14703d}
.cxc.ok.at{box-shadow:inset 0 0 0 4px var(--c)}
.cxc.no{background:var(--nol);color:#a52328;animation:shake .35s}
.cxl{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.cxk{display:inline-flex;align-items:center;gap:6px;background:#fff;border:3px solid var(--gr);border-radius:14px;padding:4px 12px;font:600 1.25rem 'Fredoka','Jua',sans-serif;box-shadow:0 4px 0 var(--gr)}
.cxk small{font:700 .8rem 'Fredoka','Jua',sans-serif;color:var(--cd);white-space:nowrap}
.cxk.on{border-color:var(--c);background:var(--cl);box-shadow:0 4px 0 var(--c)}
.cxk.done{border-color:var(--ok);background:var(--okl);box-shadow:none;opacity:.65}
.cxkeys{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:560px}
.cxkeys button{min-width:54px;height:58px;border-radius:14px;background:#fff;border:3px solid var(--c);box-shadow:0 5px 0 var(--cd);font:600 1.8rem 'Fredoka',sans-serif;padding:0 10px}
.cxkeys button:active{transform:translateY(3px);box-shadow:0 2px 0 var(--cd)}
.cxkeys .del{border-color:var(--gr);box-shadow:0 5px 0 var(--gr);font-size:1.4rem}`;
  let styled = false;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.append(text); return e; };

  function fits(grid, dirs, word, y, x, d) {
    const dy = d === "V" ? 1 : 0, dx = d === "H" ? 1 : 0, key = (a, b) => a + "," + b;
    if (grid[key(y - dy, x - dx)] || grid[key(y + dy * word.length, x + dx * word.length)]) return -1;
    let cross = 0;
    for (let i = 0; i < word.length; i++) {
      const cy = y + dy * i, cx = x + dx * i, k = key(cy, cx);
      if (grid[k]) { if (grid[k] !== word[i] || dirs[k].includes(d)) return -1; cross++; }
      else if (grid[key(cy + dx, cx + dy)] || grid[key(cy - dx, cx - dy)]) return -1;      // 옆줄에 붙으면 안 됨
    }
    return cross;
  }
  function put(grid, dirs, word, y, x, d) {
    for (let i = 0; i < word.length; i++) { const k = (y + (d === "V" ? i : 0)) + "," + (x + (d === "H" ? i : 0)); grid[k] = word[i]; (dirs[k] = dirs[k] || []).push(d); }
  }
  function attempt(words, maxW, maxH) {
    const order = words.map(w => [w, -w.length + Math.random() * 2]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
    const grid = {}, dirs = {}, placed = [];
    const first = Math.random() < .5 ? "H" : "V";
    put(grid, dirs, order[0], 0, 0, first); placed.push({ word: order[0], y: 0, x: 0, d: first });
    let rest = order.slice(1);
    for (let pass = 0; pass < 3; pass++) {
      const left = [];
      for (const w of rest) {
        let best = null;
        for (const k in grid) {
          const [cy, cx] = k.split(",").map(Number);
          for (let i = 0; i < w.length; i++) {
            if (w[i] !== grid[k]) continue;
            for (const d of "HV") {
              if (dirs[k].includes(d)) continue;
              const y = d === "H" ? cy : cy - i, x = d === "H" ? cx - i : cx, n = fits(grid, dirs, w, y, x, d);
              if (n < 1) continue;
              const ys = placed.flatMap(p => [p.y, p.y + (p.d === "V" ? p.word.length - 1 : 0)]).concat(y, y + (d === "V" ? w.length - 1 : 0));
              const xs = placed.flatMap(p => [p.x, p.x + (p.d === "H" ? p.word.length - 1 : 0)]).concat(x, x + (d === "H" ? w.length - 1 : 0));
              if (Math.max(...xs) - Math.min(...xs) + 1 > maxW || Math.max(...ys) - Math.min(...ys) + 1 > maxH) continue;
              const sc = n + Math.random() * .5;
              if (!best || sc > best.sc) best = { sc, y, x, d };
            }
          }
        }
        if (best) { put(grid, dirs, w, best.y, best.x, best.d); placed.push({ word: w, y: best.y, x: best.x, d: best.d }); }
        else left.push(w);
      }
      rest = left;
    }
    return placed;
  }
  function finish(entries) {                  // 왼쪽 위로 당기고 번호를 매긴다
    const y0 = Math.min(...entries.map(e => e.y)), x0 = Math.min(...entries.map(e => e.x));
    entries.forEach(e => { e.y -= y0; e.x -= x0; });
    const w = Math.max(...entries.map(e => e.x + (e.d === "H" ? e.word.length : 1))), h = Math.max(...entries.map(e => e.y + (e.d === "V" ? e.word.length : 1)));
    const starts = [...new Set(entries.map(e => e.y * 100 + e.x))].sort((a, b) => a - b);
    entries.forEach(e => { e.num = starts.indexOf(e.y * 100 + e.x) + 1; });
    entries.sort((a, b) => a.num - b.num || (a.d < b.d ? -1 : 1));
    return { w, h, entries };
  }
  function layout(words, maxW, maxH, tries) {
    let best = null;
    for (let t = 0; t < (tries || 150); t++) {
      const p = attempt(words, maxW, maxH);
      if (!best || p.length > best.length) best = p;
      if (best.length === words.length) break;
    }
    return finish(best);
  }
  function stair(words) {
    return finish(words.map((word, i) => ({ word, d: i % 2 ? "V" : "H", y: Math.floor(i / 2), x: Math.ceil(i / 2) })));
  }

  function mount(host, L, opt) {
    if (!styled) { document.head.append(el("style", null, CSS)); styled = true; }
    const cells = {}, arrow = { H: "➡", V: "⬇" };
    L.entries.forEach(e => {
      e.done = false;
      e.cells = [...e.word].map((ch, i) => {
        const y = e.y + (e.d === "V" ? i : 0), x = e.x + (e.d === "H" ? i : 0), k = y + "," + x;
        const c = cells[k] || (cells[k] = { ch, val: "", lock: false, ents: [] });
        c.ents.push(e);
        if (!i) c.num = e.num;
        return c;
      });
    });
    const grid = el("div", "cxg"), list = el("div", "cxl"), keys = el("div", "cxkeys");
    grid.style.gridTemplateColumns = `repeat(${L.w},var(--cx,52px))`;
    if (opt.size) grid.style.setProperty("--cx", opt.size + "px");
    let cur = null, pos = 0;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const c = cells[y + "," + x];
      if (!c) { grid.append(el("div")); continue; }
      c.el = el("button", "cxc"); c.el.type = "button";
      c.txt = el("span");
      if (c.num) c.el.append(el("sup", null, c.num));
      c.el.append(c.txt);
      c.el.onclick = () => {
        const open = c.ents.filter(e => !e.done);
        if (!open.length) return;
        const same = cur && cur.cells[pos] === c;
        const e = open.includes(cur) ? (same && open.length > 1 ? open.find(o => o !== cur) : cur) : open[0];
        select(e, c);
      };
      grid.append(c.el);
    }
    L.entries.forEach(e => {
      e.chip = el("button", "cxk"); e.chip.type = "button";
      e.chip.append(el("small", null, arrow[e.d] + " " + e.num), opt.chip(e));
      e.chip.onclick = () => { if (!e.done) select(e); };
      list.append(e.chip);
    });
    opt.keys.concat("⌫").forEach(k => {
      const b = el("button", k === "⌫" ? "del" : "", k); b.type = "button";
      b.onclick = () => press(k);
      keys.append(b);
    });
    function paint() {
      for (const k in cells) {
        const c = cells[k];
        c.el.classList.toggle("ok", c.lock);
        c.el.classList.toggle("hl", !!cur && !c.lock && cur.cells.includes(c));
        c.el.classList.toggle("at", !!cur && cur.cells[pos] === c);
      }
      L.entries.forEach(e => { e.chip.classList.toggle("on", e === cur); e.chip.classList.toggle("done", e.done); });
    }
    function select(e, c) {
      const changed = e !== cur;
      cur = e; pos = c ? e.cells.indexOf(c) : 0;          // 항상 첫 칸부터 차례로 쓴다
      paint();
      if (changed && opt.onSelect) opt.onSelect(e);
    }
    function judge(e) {
      if (e.done || e.cells.some(c => !c.val)) return;
      if (e.cells.every(c => c.val === c.ch)) { e.done = true; e.cells.forEach(c => { c.lock = true; }); if (opt.onOk) opt.onOk(e); return; }
      if (opt.onMiss) opt.onMiss(e);
      e.cells.forEach(c => { if (c.lock) return; c.el.classList.add("no"); c.bad = true; });
      setTimeout(() => {
        e.cells.forEach(c => { if (!c.bad) return; c.bad = false; c.el.classList.remove("no"); if (!c.lock) { c.val = ""; c.txt.textContent = ""; } });
        if (cur === e) pos = 0;
        paint();
      }, 600);
    }
    function press(k) {
      if (!cur) return;
      let c = cur.cells[pos];
      if (k === "⌫") {
        if (c.lock || !c.val) { for (let p = pos - 1; p >= 0; p--) if (!cur.cells[p].lock) { pos = p; c = cur.cells[p]; break; } }
        if (!c.lock) { c.val = ""; c.txt.textContent = ""; }
        paint(); return;
      }
      if (c.lock) {                                     // 이미 맞힌 칸: 같은 글자를 누르면 다음 칸으로 넘어간다
        if (k !== c.ch) { if (opt.onMiss) opt.onMiss(cur); c.el.classList.add("no"); setTimeout(() => c.el.classList.remove("no"), 600); return; }
      } else { c.val = k; c.txt.textContent = k; }
      if (opt.onTap) opt.onTap();
      c.ents.slice().forEach(judge);
      if (L.entries.every(e => e.done)) { cur = null; paint(); if (opt.onDone) opt.onDone(); return; }
      if (cur.done) { select(L.entries.find(e => !e.done)); return; }
      if (pos < cur.cells.length - 1) pos++;
      paint();
    }
    const wrap = el("div", "cxw");
    wrap.append(list, grid, keys);
    host.append(wrap);
    select(L.entries[0]);
  }
  window.CrossPuzzle = { layout, stair, mount };
})();
