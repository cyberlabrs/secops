/* global marked, Terminal, FitAddon */
const $ = (sel, el = document) => el.querySelector(sel);
const view = $("#view");
const side = $("#side");
let COURSE = null;
let labState = null; // aktivna lab sesija

// ---------- jezik ----------
let LANG = (() => { try { const l = localStorage.getItem("lang"); return l === "en" ? "en" : "sr"; } catch { return "sr"; } })();
const L = (sr, en) => (LANG === "en" ? en : sr);
function setLang(l) {
  LANG = l;
  try { localStorage.setItem("lang", l); } catch {}
  document.documentElement.lang = l;
  renderLangSwitch();
  COURSE = null; CID = null;
  api("/api/courses").then((list) => { COURSES = list; route(); });
}
function renderLangSwitch() {
  const el = $("#langSwitch");
  if (!el) return;
  el.innerHTML = ["sr", "en"].map((l) => `<button type="button" class="${l === LANG ? "on" : ""}" data-lang="${l}" title="${l === "sr" ? "Srpski" : "English"}">${l.toUpperCase()}</button>`).join("");
  el.querySelectorAll("[data-lang]").forEach((b) => b.onclick = () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); });
}

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const md = (t) => marked.parse(t || "");
const num = (id) => id.split("-")[0];
const pctOf = (s) => (s && s.total ? Math.round((s.ok / s.total) * 100) : null);

async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.body !== undefined || opts.post ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Lang": LANG },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data });
  return data;
}

let CID = null;   // id aktivnog kursa
let COURSES = []; // pregled svih kurseva
const C = () => `/api/c/${CID}`;

async function loadCourse(cid) {
  CID = cid;
  COURSE = await api(C());
  $("#courseTitle").textContent = COURSE.title;
  $("#logo").textContent = COURSE.badge || "SEC";
  document.title = COURSE.title + L(" · SecOps trening", " · SecOps training");
  renderNav();
}

function renderNav() {
  const nav = $("#topnav");
  if (!COURSE) { nav.innerHTML = `<a href="#/" class="on">${L("Svi kursevi", "All courses")}</a>`; return; }
  const links = [["", L("Pregled", "Overview")], ["plan", L("Plan učenja", "Study plan")], ["ispit", L("Simulacija ispita", "Exam simulation")]];
  if (COURSE.objectives.length) links.push(["ciljevi", L("Ciljevi", "Objectives")]);
  if (COURSE.acronymCount) links.push(["akronimi", L("Akronimi", "Acronyms")]);
  links.push(["izvori", L("Izvori", "Sources")]);
  nav.innerHTML = `<a href="#/">${L("Svi kursevi", "All courses")}</a>` + links.map(([k, l]) => `<a data-k="${k}" href="#/${CID}${k ? "/" + k : ""}">${l}</a>`).join("");
}

// ---------- napredak ----------
function moduleStatus(m, p = COURSE.progress) {
  const lesson = !!p.lessons[m.id];
  const quiz = p.quiz[m.id]?.best ?? null;
  const labsDone = m.labs.filter((l) => p.labs[`${m.id}/${l.id}`]?.done).length;
  const parts = 1 + (m.quizCount ? 1 : 0) + m.labs.length;
  const done = (lesson ? 1 : 0) + (quiz !== null && quiz >= 80 ? 1 : 0) + labsDone;
  return { lesson, quiz, labsDone, pct: Math.round((done / parts) * 100) };
}
function overall() {
  const ms = COURSE.modules.map((m) => moduleStatus(m));
  return ms.length ? Math.round(ms.reduce((a, s) => a + s.pct, 0) / ms.length) : 0;
}
const domains = () => COURSE.exam.domains || [];
function domainStats(n) {
  const objs = COURSE.objectives.filter((o) => o.id.startsWith(n + "."));
  return objs.reduce((a, o) => { const s = COURSE.progress.stats[o.id]; if (s) { a.ok += s.ok; a.total += s.total; } return a; }, { ok: 0, total: 0 });
}
const domainName = (n) => domains().find((d) => d.n === n)?.name || "";
const isScaled = () => !!COURSE.exam.scaleMax;
const fmtScore = (v) => (v === null || v === undefined ? "–" : isScaled() ? String(v) : v + "%");

function renderSide(activeId) {
  if (!COURSE) { side.innerHTML = ""; return; }
  const total = overall();
  const wrong = Object.keys(COURSE.progress.wrong).length;
  const known = Object.keys(COURSE.progress.acronyms).length;
  const modLink = (m) => {
    const s = moduleStatus(m);
    return `<a class="mod-link ${m.id === activeId ? "on" : ""}" href="#/${CID}/m/${m.id}">
      <span class="n">${num(m.id)}</span>${esc(m.title)}
      <div class="marks">
        <span class="mark ${s.lesson ? "ok" : ""}">${L("lekcija", "lesson")}</span>
        ${m.quizCount ? `<span class="mark ${s.quiz >= 80 ? "ok" : ""}">${L("kviz", "quiz")} ${s.quiz ?? "–"}${s.quiz !== null ? "%" : ""}</span>` : ""}
        ${m.labs.length ? `<span class="mark ${s.labsDone === m.labs.length ? "ok" : ""}">lab ${s.labsDone}/${m.labs.length}</span>` : ""}
      </div></a>`;
  };
  // moduli bez domena (npr. probni ispit) idu u posebnu grupu na kraju
  const extra = COURSE.modules.filter((m) => !m.domain);
  const groups = domains().length
    ? domains().map((d) => `<h3>${d.n}.0 ${esc(d.name)} · ${d.weight}%</h3>${COURSE.modules.filter((m) => m.domain === d.n).map(modLink).join("")}`).join("")
      + (extra.length ? `<h3>${L("Ispitna praksa", "Exam practice")}</h3>${extra.map(modLink).join("")}` : "")
    : `<h3>${L("Moduli", "Modules")}</h3>${COURSE.modules.map(modLink).join("")}`;
  side.innerHTML = `
    <label class="switch"><span>${L("Kurs", "Course")}</span><select id="courseSel">${COURSES.map((c) => `<option value="${c.id}" ${c.id === CID ? "selected" : ""}>${esc(c.code)} · ${esc(c.title)}</option>`).join("")}</select></label>
    <div class="overall"><b>${L("Ukupni napredak", "Overall progress")}: ${total}%</b>
      <div class="bar"><i style="width:${total}%"></i></div>
      <span style="color:var(--muted)">${L("Modul je gotov kad pročitaš lekciju, imaš 80%+ na kvizu i završiš labove.", "A module is complete when you have read the lesson, scored 80%+ on the quiz and finished the labs.")}</span>
    </div>
    ${groups}
    <h3 style="margin-top:18px">${L("Priprema za ispit", "Exam preparation")}</h3>
    <a class="mod-link" href="#/${CID}/plan"><span class="n">➜</span>${L("Plan učenja i slabe tačke", "Study plan and weak spots")}</a>
    <a class="mod-link" href="#/${CID}/ispit"><span class="n">∑</span>${L("Simulacija ispita", "Exam simulation")}</a>
    ${COURSE.objectives.length ? `<a class="mod-link" href="#/${CID}/ciljevi"><span class="n">◎</span>${L("Ciljevi ispita", "Exam objectives")}</a>` : ""}
    <a class="mod-link" href="#/${CID}/greske"><span class="n">↺</span>${L("Ponovi greške", "Review mistakes")} (${wrong})</a>
    ${COURSE.acronymCount ? `<a class="mod-link" href="#/${CID}/akronimi"><span class="n">Aa</span>${L("Akronimi", "Acronyms")} (${known}/${COURSE.acronymCount})</a>` : ""}`;
  $("#courseSel").onchange = (e) => { location.hash = `#/${e.target.value}`; };
}

// ---------- ruter ----------
// #/                       svi kursevi
// #/<kurs>[/m|lab|plan|ispit|ciljevi|greske|vjezba|akronimi|izvori/...]
async function route() {
  const all = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [cid, ...parts] = all;
  if (labState && parts[0] !== "lab") await stopLab();
  clearInterval(examTimer);
  view.scrollTop = 0;
  try {
    if (!cid) { COURSE = null; CID = null; renderNav(); return await renderCourses(); }
    if (!COURSES.find((c) => c.id === cid)) { location.hash = "#/"; return; }
    if (cid !== CID || !COURSE) await loadCourse(cid);
    document.querySelectorAll("#topnav a[data-k]").forEach((a) => a.classList.toggle("on", a.dataset.k === (parts[0] || "")));
    if (!parts.length) return renderHome();
    if (parts[0] === "m") return await renderModule(parts[1], parts[2] || "lekcija");
    if (parts[0] === "lab") return await renderLab(parts[1], parts[2]);
    if (parts[0] === "ispit") return renderExam();
    if (parts[0] === "plan") return await renderPlan();
    if (parts[0] === "ciljevi") return renderObjectives();
    if (parts[0] === "greske") return await renderPractice("greske");
    if (parts[0] === "vjezba") return await renderPractice("obj", parts[1]);
    if (parts[0] === "akronimi") return await renderAcronyms();
    if (parts[0] === "izvori") return renderSources();
    renderHome();
  } catch (e) {
    view.innerHTML = `<div class="page"><p class="err">${esc(e.message)}</p></div>`;
  }
}
window.addEventListener("hashchange", route);
// zatvaranje taba gasi lab kontejner
window.addEventListener("pagehide", () => {
  if (labState?.session) navigator.sendBeacon(`/api/lab/session/${labState.session}/stop`);
});

// ---------- svi kursevi ----------
async function renderCourses() {
  COURSES = await api("/api/courses");
  renderSide();
  $("#courseTitle").textContent = L("SecOps trening", "SecOps training");
  $("#logo").textContent = "SEC";
  document.title = L("SecOps trening", "SecOps training");
  view.innerHTML = `<div class="page">
    <h1>${L("SecOps trening", "SecOps training")}</h1>
    <p class="lead">${L("Put od DevOps-a do cloud security inženjera, sertifikat po sertifikat. Svaki kurs ima lekcije, kvizove, simulaciju ispita i labove u pravom Linux terminalu.", "The path from DevOps to cloud security engineer, one certification at a time. Every course has lessons, quizzes, an exam simulation and labs in a real Linux terminal.")}</p>
    <div class="cards">${COURSES.map((c) => `<a class="card course" href="#/${c.id}">
      <span class="n">${esc(c.code)}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.subtitle)}</p>
      <div class="muted" style="font-size:.85rem">${c.modules} ${L("modula", "modules")} · ${c.questions} ${L("pitanja", "questions")} · ${c.labs} ${L("labova", "labs")}${c.acronyms ? ` · ${c.acronyms} ${L("akronima", "acronyms")}` : ""}</div>
      <div class="bar"><i style="width:${c.pct}%"></i></div>
      <div class="row" style="justify-content:space-between;font-size:.85rem"><span>${c.pct}% ${L("završeno", "complete")}</span>
        <span class="muted">${c.lastExam ? `${L("zadnji ispit", "last exam")}: ${c.exam.scaleMax ? c.lastExam.score : c.lastExam.score + "%"}` : L("ispit još nije rađen", "no exam taken yet")}</span></div>
    </a>`).join("")}</div>
    <p class="muted" style="margin-top:22px;font-size:.88rem">${L("Novi kurs se dodaje kao folder u <code>courses/</code>. Napredak se čuva posebno za svaki kurs.", "A new course is added as a folder in <code>courses/</code>. Progress is stored separately for each course.")}</p>
  </div>`;
}

// ---------- početna kursa ----------
function renderHome() {
  renderSide();
  const p = COURSE.progress;
  const last = p.exams.slice(-3);
  const avg = last.length ? Math.round(last.reduce((a, e) => a + e.score, 0) / last.length) : null;
  const labsTotal = COURSE.modules.reduce((a, m) => a + m.labs.length, 0);
  const labsDone = COURSE.modules.reduce((a, m) => a + moduleStatus(m).labsDone, 0);
  const qTotal = COURSE.modules.reduce((a, m) => a + m.quizCount, 0);
  view.innerHTML = `<div class="page">
    <h1>${esc(COURSE.title)}</h1>
    <p class="lead">${esc(COURSE.subtitle)}</p>
    <div class="stats">
      <div class="stat"><b>${overall()}%</b><span>${L("ukupno završeno", "overall complete")}</span></div>
      <div class="stat"><b>${Object.keys(p.lessons).length}/${COURSE.modules.length}</b><span>${L("lekcija pročitano", "lessons read")}</span></div>
      <div class="stat"><b>${labsDone}/${labsTotal}</b><span>${L("labova završeno", "labs completed")}</span></div>
      <div class="stat"><b>${fmtScore(avg)}</b><span>${L("prosjek zadnja 3 ispita", "average of last 3 exams")} (${L("prolaz", "pass")} ${fmtScore(COURSE.exam.pass)})</span></div>
    </div>
    ${planTeaser()}
    ${domains().length ? `<h2 style="margin:0 0 12px">${L("Spremnost po domenima", "Readiness by domain")}</h2>
    <div class="domains">${domains().map((d) => {
      const s = domainStats(d.n); const v = pctOf(s);
      return `<div class="dom"><div class="row" style="justify-content:space-between"><span><b>${d.n}.0</b> ${esc(d.name)}</span><span class="muted">${d.weight}% ${L("ispita", "of exam")} · ${v === null ? L("nema odgovora", "no answers") : `${v}% ${L("tačno", "correct")} (${s.total})`}</span></div>
        <div class="bar"><i style="width:${v ?? 0}%;background:${v === null ? "var(--line)" : v >= 80 ? "var(--ok)" : v >= 65 ? "var(--warn)" : "var(--bad)"}"></i></div></div>`;
    }).join("")}</div>
    <p class="muted" style="font-size:.88rem">${L(`Tačnost se računa iz svih odgovora u kvizovima, vježbama i simulacijama. U banci je ${qTotal} pitanja.`, `Accuracy is calculated from all answers in quizzes, practice and simulations. The bank has ${qTotal} questions.`)}</p>` : ""}
    <h2 style="margin:26px 0 12px">${L("Moduli", "Modules")}</h2>
    <div class="cards">${COURSE.modules.map((m) => {
      const s = moduleStatus(m);
      const meta = [`${L("MODUL", "MODULE")} ${num(m.id)}`, m.domain ? `${L("DOMEN", "DOMAIN")} ${m.domain}` : `~${m.minutes} min`, m.objectives ? `${L("ciljevi", "objectives")} ${m.objectives.join(", ")}` : ""].filter(Boolean).join(" · ");
      return `<a class="card" href="#/${CID}/m/${m.id}"><span class="n">${meta}</span>
        <h3>${esc(m.title)}</h3><p>${esc(m.summary)}</p>
        <div class="bar"><i style="width:${s.pct}%"></i></div></a>`;
    }).join("")}</div>
    <div class="row" style="margin-top:28px">
      <button class="btn ghost small" id="reset">${L("Obriši napredak ovog kursa", "Reset progress for this course")}</button>
    </div>
  </div>`;
  let armed = false;
  $("#reset").onclick = async (e) => {
    if (!armed) { armed = true; e.target.textContent = L("Klikni ponovo za potvrdu", "Click again to confirm"); return; }
    COURSE.progress = await api(C() + "/progress/reset", { post: true });
    renderHome();
  };
}

// ---------- plan učenja (slabe tačke i sljedeći koraci) ----------
// Sve se računa iz napretka: tačnost po cilju (stats) ili modulu (mods), greške, labovi (hints, fails).
// Svaka preporuka ima prioritet; veći prioritet je važniji.
function planData() {
  const p = COURSE.progress;
  const items = [];
  const objName = (o) => (LANG === "en" ? o.en : o.bs || o.en);
  const modFor = (id) => COURSE.modules.find((m) => (m.objectives || []).includes(id));
  const labKey = (m, l) => `${m.id}/${l.id}`;
  const openLabs = (m) => m.labs.filter((l) => !p.labs[labKey(m, l)]?.done)
    .map((l) => ({ href: `#/${CID}/lab/${m.id}/${l.id}`, label: /^lab\b/i.test(l.title) ? l.title : `Lab: ${l.title}` }));
  const lessonAct = (m) => ({ href: `#/${CID}/m/${m.id}`, label: `${p.lessons[m.id] ? L("Ponovo pročitaj lekciju", "Re-read lesson") : L("Pročitaj lekciju", "Read lesson")} ${num(m.id)}` });
  const accTxt = (s) => `${Math.round((s.ok / s.total) * 100)}% (${s.ok}/${s.total})`;
  const hasObj = COURSE.objectives.length > 0;
  const qCount = (id) => COURSE.modules.reduce((a, m) => a + (m.objCounts?.[id] || 0), 0);

  // 1. slabe tačke: cilj (ili modul) sa bar 3 odgovora i tačnošću ispod 80%
  if (hasObj) {
    const avgW = 100 / Math.max(1, COURSE.objectives.length);
    for (const o of COURSE.objectives) {
      const s = p.stats[o.id];
      if (!s || s.total < 3 || s.ok / s.total >= 0.8) continue;
      const acc = s.ok / s.total;
      const d = domains().find((x) => o.id.startsWith(x.n + "."));
      const w = d ? d.weight / COURSE.objectives.filter((x) => x.id.startsWith(d.n + ".")).length : avgW;
      const m = modFor(o.id);
      const actions = [{ href: `#/${CID}/vjezba/${o.id}`, label: L("Vježbaj ovaj cilj", "Practice this objective"), main: true }];
      if (m) actions.push(lessonAct(m), ...openLabs(m).slice(0, 2));
      items.push({ prio: 60 + (0.8 - acc) * 100 * Math.min(2, w / avgW) * Math.min(1, s.total / 5), level: acc < 0.65 ? "bad" : "warn",
        title: `${L("Slaba tačka", "Weak spot")}: ${o.id} ${objName(o)}`,
        why: L(`Tačnost ${accTxt(s)}${d ? `, domen ${d.n} nosi ${d.weight}% ispita` : ""}. Ponovi gradivo, pa vježbaj samo ovaj cilj dok ne pređeš 80%.`,
          `Accuracy ${accTxt(s)}${d ? `, domain ${d.n} is ${d.weight}% of the exam` : ""}. Review the material, then practice just this objective until you pass 80%.`), actions });
    }
  } else {
    for (const m of COURSE.modules) {
      const s = p.mods[m.id];
      if (!s || s.total < 3 || s.ok / s.total >= 0.8) continue;
      const acc = s.ok / s.total;
      items.push({ prio: 60 + (0.8 - acc) * 100 * Math.min(1, s.total / 5), level: acc < 0.65 ? "bad" : "warn",
        title: `${L("Slaba tačka", "Weak spot")}: ${L("modul", "module")} ${num(m.id)} ${m.title}`,
        why: L(`Tačnost u ovom modulu ${accTxt(s)}.`, `Accuracy in this module ${accTxt(s)}.`),
        actions: [{ href: `#/${CID}/m/${m.id}/kviz`, label: L("Ponovi kviz", "Retake quiz"), main: true }, lessonAct(m), ...openLabs(m).slice(0, 2)] });
    }
  }

  // 2. pogrešni odgovori koji čekaju ponavljanje
  const wrong = Object.keys(p.wrong).length;
  if (wrong) items.push({ prio: wrong >= 5 ? 55 + Math.min(15, wrong / 2) : 35, level: wrong >= 10 ? "warn" : "",
    title: L(`Ponovi greške (${wrong})`, `Review mistakes (${wrong})`),
    why: L("Pitanja na koja je posljednji odgovor bio pogrešan. Tačan odgovor ih skida sa liste.", "Questions whose last answer was wrong. A correct answer removes them from the list."),
    actions: [{ href: `#/${CID}/greske`, label: L("Ponovi greške", "Review mistakes"), main: true }] });

  // 3. ciljevi (ili moduli) na koje još nema odgovora, grupisano po domenu
  if (hasObj) {
    const groups = domains().length ? domains().map((d) => ({ d, objs: COURSE.objectives.filter((o) => o.id.startsWith(d.n + ".")) })) : [{ d: null, objs: COURSE.objectives }];
    for (const g of groups) {
      const untouched = g.objs.filter((o) => !p.stats[o.id] && qCount(o.id));
      if (!untouched.length) continue;
      items.push({ prio: 38 + (g.d ? g.d.weight / 5 : 5) * (untouched.length / g.objs.length), level: "",
        title: g.d ? L(`Neprovjereno u domenu ${g.d.n} (${g.d.name})`, `Untested in domain ${g.d.n} (${g.d.name})`) : L("Neprovjereni ciljevi", "Untested objectives"),
        why: L(`Na ${untouched.length} od ${g.objs.length} ciljeva još nema nijednog odgovora, pa ne znaš kakvo je tvoje znanje.`, `${untouched.length} of ${g.objs.length} objectives have no answers yet, so you don't know where you stand.`),
        actions: untouched.slice(0, 4).map((o, i) => ({ href: `#/${CID}/vjezba/${o.id}`, label: `${o.id} ${objName(o).slice(0, 48)}${objName(o).length > 48 ? "…" : ""}`, main: i === 0 })) });
    }
  }

  // 4. labovi: završeni uz savjete ili mnogo neuspjelih provjera vrijedi ponoviti bez pomoći
  for (const m of COURSE.modules) for (const l of m.labs) {
    const st = p.labs[labKey(m, l)];
    if (!st) continue;
    const hints = st.hints || 0, fails = st.fails || 0;
    if (st.done && (hints > 0 || fails >= 3)) items.push({ prio: 30 + Math.min(10, hints * 2 + fails), level: "",
      title: `${L("Ponovi bez savjeta", "Redo without hints")}: ${l.title}`,
      why: L(`Lab je završen, ali uz ${hints} savjeta i ${fails} neuspjelih provjera. Uradi ga ponovo od nule, bez savjeta.`, `The lab is complete, but with ${hints} hints and ${fails} failed checks. Do it again from scratch without hints.`),
      actions: [{ href: `#/${CID}/lab/${m.id}/${l.id}`, label: L("Otvori lab", "Open lab"), main: true }] });
    else if (!st.done) items.push({ prio: 42, level: "",
      title: `${L("Nedovršen lab", "Unfinished lab")}: ${l.title}`,
      why: L(`Riješeno ${st.steps.length} od ${l.steps} koraka.`, `${st.steps.length} of ${l.steps} steps solved.`),
      actions: [{ href: `#/${CID}/lab/${m.id}/${l.id}`, label: L("Nastavi lab", "Continue lab"), main: true }] });
  }

  // 5. sljedeći modul po redu
  const next = COURSE.modules.find((m) => moduleStatus(m).pct < 100);
  if (next) {
    const s = moduleStatus(next);
    const step = !s.lesson ? lessonAct(next) : next.quizCount && (s.quiz === null || s.quiz < 80) ? { href: `#/${CID}/m/${next.id}/kviz`, label: L("Kviz", "Quiz") } : (openLabs(next)[0] || lessonAct(next));
    items.push({ prio: 45, level: "", title: `${L("Nastavi", "Continue")}: ${L("modul", "module")} ${num(next.id)} ${next.title}`,
      why: L(`Modul je ${s.pct}% završen.`, `The module is ${s.pct}% complete.`), actions: [{ ...step, main: true }] });
  }

  // 6. ispit: pad na zadnjem pokušaju ili spremnost za simulaciju
  const last = p.exams[p.exams.length - 1];
  if (last && last.score < COURSE.exam.pass) {
    const weakD = (last.byDomain || []).filter((d) => d.total && d.correct / d.total < 0.8);
    items.push({ prio: 58, level: "bad", title: L(`Zadnja simulacija: ${fmtScore(last.score)} (prolaz ${fmtScore(COURSE.exam.pass)})`, `Last simulation: ${fmtScore(last.score)} (pass ${fmtScore(COURSE.exam.pass)})`),
      why: weakD.length ? L(`Ispod 80%: ${weakD.map((d) => `D${d.n} ${Math.round((d.correct / d.total) * 100)}%`).join(", ")}. Slabe tačke iz tih domena su gore na listi.`, `Below 80%: ${weakD.map((d) => `D${d.n} ${Math.round((d.correct / d.total) * 100)}%`).join(", ")}. Weak spots from those domains are higher up in the list.`) : "",
      actions: [{ href: `#/${CID}/ispit`, label: L("Simulacija ispita", "Exam simulation") }] });
  }
  const r = readiness();
  if (r.coverage >= 0.8 && r.acc !== null && r.acc >= 0.8 && !items.some((x) => x.level === "bad"))
    items.push({ prio: 50, level: "ok", title: L("Spreman si za punu simulaciju ispita", "You're ready for a full exam simulation"),
      why: L(`Pokrivenost ${Math.round(r.coverage * 100)}%, ponderisana tačnost ${Math.round(r.acc * 100)}%. Ciljaj stabilnih 85%+ na simulacijama.`, `Coverage ${Math.round(r.coverage * 100)}%, weighted accuracy ${Math.round(r.acc * 100)}%. Aim for a consistent 85%+ in simulations.`),
      actions: [{ href: `#/${CID}/ispit`, label: L("Pokreni simulaciju", "Start simulation"), main: true }] });

  return items.sort((a, b) => b.prio - a.prio);
}

// pokrivenost (udio ciljeva/modula sa odgovorima) i tačnost ponderisana težinom domena
function readiness() {
  const p = COURSE.progress;
  if (COURSE.objectives.length) {
    const withQ = COURSE.objectives.filter((o) => COURSE.modules.some((m) => m.objCounts?.[o.id]));
    const coverage = withQ.length ? withQ.filter((o) => p.stats[o.id]).length / withQ.length : 0;
    let num_ = 0, den = 0;
    for (const d of domains().length ? domains() : [{ n: null, weight: 1 }]) {
      const s = d.n === null ? COURSE.objectives.reduce((a, o) => { const x = p.stats[o.id]; if (x) { a.ok += x.ok; a.total += x.total; } return a; }, { ok: 0, total: 0 }) : domainStats(d.n);
      if (s.total) { num_ += d.weight * (s.ok / s.total); den += d.weight; }
    }
    return { coverage, acc: den ? num_ / den : null };
  }
  const withQ = COURSE.modules.filter((m) => m.quizCount);
  const tot = withQ.reduce((a, m) => { const x = p.mods[m.id]; if (x) { a.ok += x.ok; a.total += x.total; } return a; }, { ok: 0, total: 0 });
  return { coverage: withQ.length ? withQ.filter((m) => p.mods[m.id]).length / withQ.length : 0, acc: tot.total ? tot.ok / tot.total : null };
}

function planItemHtml(x) {
  return `<div class="plan-item ${x.level}"><div class="pt">${esc(x.title)}</div>${x.why ? `<div class="pw">${esc(x.why)}</div>` : ""}
    <div class="row" style="margin-top:8px">${x.actions.map((a) => `<a class="btn small ${a.main ? "" : "ghost"}" href="${a.href}">${esc(a.label)}</a>`).join("")}</div></div>`;
}

function planTeaser() {
  const items = planData().slice(0, 3);
  if (!items.length) return "";
  return `<h2 style="margin:0 0 12px">${L("Sljedeći koraci", "Next steps")}</h2><div class="plan">${items.map(planItemHtml).join("")}</div>
    <p style="margin:8px 0 26px"><a href="#/${CID}/plan">${L("Cijeli plan učenja →", "Full study plan →")}</a></p>`;
}

async function renderPlan() {
  COURSE.progress = (await api(C())).progress; // napredak se mijenja i iz drugih tabova
  renderSide();
  const p = COURSE.progress;
  const items = planData();
  const r = readiness();
  const labsTotal = COURSE.modules.reduce((a, m) => a + m.labs.length, 0);
  const labsDone = COURSE.modules.reduce((a, m) => a + moduleStatus(m).labsDone, 0);
  const hasObj = COURSE.objectives.length > 0;
  view.innerHTML = `<div class="page"><h1>${L("Plan učenja", "Study plan")}</h1>
    <p class="lead">${L("Preporuke iz tvog napretka, poredane po važnosti: slabe tačke (ispod 80%, bar 3 odgovora), greške, neprovjereno gradivo i labove koje vrijedi ponoviti bez savjeta.", "Recommendations from your progress, ordered by importance: weak spots (below 80%, at least 3 answers), mistakes, untested material and labs worth redoing without hints.")}</p>
    <div class="stats">
      <div class="stat"><b>${Math.round(r.coverage * 100)}%</b><span>${hasObj ? L("ciljeva ima bar jedan odgovor", "objectives have at least one answer") : L("modula ima bar jedan odgovor", "modules have at least one answer")}</span></div>
      <div class="stat"><b>${r.acc === null ? "–" : Math.round(r.acc * 100) + "%"}</b><span>${domains().length ? L("tačnost ponderisana težinom domena", "accuracy weighted by domain") : L("ukupna tačnost", "overall accuracy")}</span></div>
      <div class="stat"><b>${Object.keys(p.wrong).length}</b><span>${L("grešaka za ponavljanje", "mistakes to review")}</span></div>
      <div class="stat"><b>${labsDone}/${labsTotal}</b><span>${L("labova završeno", "labs completed")}</span></div>
    </div>
    ${items.length ? `<div class="plan">${items.map(planItemHtml).join("")}</div>` : `<p>${L("Još nema podataka. Počni od prvog modula: pročitaj lekciju i uradi kviz.", "No data yet. Start with the first module: read the lesson and take the quiz.")}</p>`}
    ${hasObj ? `<p class="muted" style="font-size:.88rem;margin-top:18px">${L("Detalje po svakom cilju vidiš na stranici", "See details for every objective on the")} <a href="#/${CID}/ciljevi">${L("Ciljevi ispita", "Exam objectives page")}</a>.</p>` : ""}
  </div>`;
}

// ---------- pitanja (svi tipovi) ----------
// single/multi: radio/checkbox · order: poredaj strelicama · match: padajući izbor po stavci
// isječak sa brojevima redova; za spot su redovi dugmad koja se označavaju klikom
function snippetHtml(q) {
  if (!q.snippet) return "";
  const lines = q.snippet.split("\n");
  const cls = `snip${q.type === "spot" ? " spot" : ""}`;
  return `<div class="${cls}" data-lang="${esc(q.lang || "")}">${q.lang ? `<span class="snl">${esc(q.lang)}</span>` : ""}${lines.map((l, i) =>
    `<div class="sl" data-l="${i}"${q.type === "spot" ? ` role="button" tabindex="0"` : ""}><span class="ln">${i + 1}</span><code>${esc(l) || " "}</code></div>`).join("")}</div>`;
}

function questionHtml(q, name, label) {
  const t = q.type;
  const hint = t === "multi" ? L(" · više odgovora", " · multiple answers") : t === "order" ? L(" · PBQ: poredaj", " · PBQ: order") : t === "match" ? L(" · PBQ: upari", " · PBQ: match")
    : t === "spot" ? L(` · nađi problem: označi ${q.picks} ${q.picks === 1 ? "red" : "reda"}`, ` · find the problem: mark ${q.picks} line${q.picks === 1 ? "" : "s"}`) : "";
  let body;
  if (t === "spot") {
    body = `<div class="muted" style="font-size:.85rem">${L("Klikni na red da ga označiš ili poništiš.", "Click a line to mark or unmark it.")}</div>`;
  } else if (t === "order") {
    body = `<ol class="order" data-order="${q.options.map((_, i) => i).join(",")}">${q.options.map((o, i) => `<li data-i="${i}"><span>${esc(o)}</span>
      <span class="ob"><button type="button" class="btn ghost small" data-mv="-1" title="${L("Gore", "Up")}">↑</button><button type="button" class="btn ghost small" data-mv="1" title="${L("Dolje", "Down")}">↓</button></span></li>`).join("")}</ol>`;
  } else if (t === "match") {
    body = `<div class="match">${q.options.map((o, i) => `<div class="mrow" data-i="${i}"><span>${esc(o)}</span>
      <select><option value="">${L("— izaberi —", "— choose —")}</option>${q.targets.map((tg, j) => `<option value="${j}">${esc(tg)}</option>`).join("")}</select></div>`).join("")}</div>`;
  } else {
    const type = t === "multi" ? "checkbox" : "radio";
    body = q.options.map((o, i) => `<label class="opt" data-i="${i}"><input type="${type}" name="${name}" value="${i}"><span>${esc(o)}</span></label>`).join("");
  }
  return `<div class="qn">${label}${hint}${q.obj ? ` · <span class="obj">${L("cilj", "objective")} ${esc(q.obj)}</span>` : ""}</div>
    <div class="qt">${esc(q.q)}</div>${snippetHtml(q)}<div class="opts">${body}</div>`;
}

function wireQuestion(box) {
  box.querySelectorAll(".snip.spot .sl").forEach((row) => {
    const toggle = () => { if (!box.dataset.locked) { row.classList.toggle("sel"); box.dispatchEvent(new Event("change", { bubbles: true })); } };
    row.onclick = toggle;
    row.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } };
  });
  box.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => {
    const li = b.closest("li"); const ol = li.parentElement;
    if (b.dataset.mv === "-1" && li.previousElementSibling) ol.insertBefore(li, li.previousElementSibling);
    if (b.dataset.mv === "1" && li.nextElementSibling) ol.insertBefore(li.nextElementSibling, li);
  });
}

// vraća odgovor, ili undefined ako pitanje nije (potpuno) odgovoreno
function getChoice(box, q) {
  if (q.type === "spot") {
    const v = [...box.querySelectorAll(".snip.spot .sl.sel")].map((r) => Number(r.dataset.l));
    return v.length ? v : undefined;
  }
  if (q.type === "order") return [...box.querySelectorAll(".order li")].map((li) => Number(li.dataset.i));
  if (q.type === "match") {
    const v = [...box.querySelectorAll(".mrow select")].map((s) => (s.value === "" ? null : Number(s.value)));
    return v.some((x) => x === null) ? undefined : v;
  }
  const vals = [...box.querySelectorAll("input:checked")].map((x) => Number(x.value));
  if (!vals.length) return undefined;
  return q.type === "multi" ? vals : vals[0];
}

function showResult(box, q, answer, correct, explain) {
  box.querySelectorAll("input,select,button[data-mv]").forEach((x) => x.disabled = true);
  box.dataset.locked = 1;
  let extra = "";
  if (q.type === "spot") {
    box.querySelectorAll(".snip.spot .sl").forEach((row) => {
      const i = Number(row.dataset.l); const sel = row.classList.contains("sel");
      if (answer.includes(i)) row.classList.add(sel ? "right" : "missed");
      else if (sel) row.classList.add("wrong");
    });
    extra = `<div style="margin-top:6px"><b>${L("Problematični redovi", "Problem lines")}:</b> ${answer.map((i) => i + 1).join(", ")}</div>`;
  } else if (q.type === "order") {
    const items = [...box.querySelectorAll(".order li")];
    items.forEach((li, pos) => li.classList.add(Number(li.dataset.i) === answer[pos] ? "right" : "wrong"));
    extra = `<div style="margin-top:6px"><b>${L("Ispravan redoslijed", "Correct order")}:</b><ol>${answer.map((i) => `<li>${esc(q.options[i])}</li>`).join("")}</ol></div>`;
  } else if (q.type === "match") {
    box.querySelectorAll(".mrow").forEach((row) => {
      const i = Number(row.dataset.i); const sel = row.querySelector("select");
      const ok = Number(sel.value) === answer[i] && sel.value !== "";
      row.classList.add(ok ? "right" : "wrong");
      if (!ok) row.insertAdjacentHTML("beforeend", `<span class="fix">→ ${esc(q.targets[answer[i]])}</span>`);
    });
  } else {
    box.querySelectorAll(".opt").forEach((o) => {
      const idx = Number(o.dataset.i);
      if (answer.includes(idx)) o.classList.add("right");
      else if (o.querySelector("input").checked) o.classList.add("wrong");
    });
  }
  box.querySelector(".fb").innerHTML = `<div class="explain"><span class="verdict ${correct ? "ok" : "bad"}">${correct ? L("Tačno.", "Correct.") : L("Netačno.", "Incorrect.")}</span> ${esc(explain)}${extra}</div>`;
}

// Vježba nad listom pitanja: svako pitanje se provjerava odmah
function runPractice(el, items, onDone) {
  let correct = 0, answered = 0;
  el.innerHTML = items.map((x, i) => `<div class="q" data-q="${i}">${questionHtml(x.q, "q" + i, `${L("Pitanje", "Question")} ${i + 1} ${L("od", "of")} ${items.length}${x.label ? " · " + esc(x.label) : ""}`)}
      <div class="row" style="margin-top:8px"><button class="btn small" data-check="${i}">${L("Provjeri", "Check")}</button></div>
      <div class="fb"></div></div>`).join("") + `<div class="q" id="practiceEnd" hidden></div>`;
  el.querySelectorAll(".q[data-q]").forEach(wireQuestion);
  el.querySelectorAll("[data-check]").forEach((b) => b.onclick = async () => {
    const i = Number(b.dataset.check);
    const x = items[i];
    const box = el.querySelector(`[data-q="${i}"]`);
    const choice = getChoice(box, x.q);
    if (choice === undefined) { box.querySelector(".fb").innerHTML = `<div class="msg bad">${L("Odgovori na pitanje (kod uparivanja izaberi sve stavke).", "Answer the question (for matching, choose every item).")}</div>`; return; }
    const r = await api(`${C()}/quiz/${x.module}/check`, { body: { index: x.index, choice } });
    b.disabled = true;
    COURSE.progress = r.progress;
    showResult(box, x.q, r.answer, r.correct, r.explain);
    answered++; if (r.correct) correct++;
    if (answered === items.length) onDone(correct, items.length, $("#practiceEnd"));
  });
}

// ---------- modul ----------
async function renderModule(id, tab) {
  const m = await api(`${C()}/modules/${id}`);
  const meta = COURSE.modules.find((x) => x.id === id);
  renderSide(id);
  const tabs = [["lekcija", L("Lekcija", "Lesson")], ["kviz", `${L("Kviz", "Quiz")} (${m.quiz.length})`], ["labovi", `${L("Labovi", "Labs")} (${m.labs.length})`]]
    .filter(([k]) => k !== "kviz" || m.quiz.length).filter(([k]) => k !== "labovi" || m.labs.length);
  view.innerHTML = `<div class="page">
    <div class="row"><span class="pill">${L("MODUL", "MODULE")} ${num(id)}</span>${m.domain ? `<span class="pill">${L("DOMEN", "DOMAIN")} ${m.domain}: ${esc(domainName(m.domain))}</span>` : ""}${m.objectives ? `<span class="pill">${L("ciljevi", "objectives")} ${m.objectives.join(", ")}</span>` : ""}</div>
    <h1 style="margin-top:8px">${esc(m.title)}</h1>
    <p class="lead">${esc(m.summary)}</p>
    <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/${CID}/m/${id}/${k}" class="${k === tab ? "on" : ""}">${l}</a>`).join("")}</nav>
    <div id="tab"></div></div>`;
  const el = $("#tab");
  if (tab === "kviz") {
    const items = m.quiz.map((q, i) => ({ module: id, index: i, q }));
    return runPractice(el, items, async (correct, total, end) => {
      COURSE.progress = await api(`${C()}/quiz/${id}/finish`, { body: { correct, total } });
      renderSide(id);
      const pct = Math.round((correct / total) * 100);
      end.hidden = false;
      end.innerHTML = `<h3 style="margin-top:0">${L("Rezultat", "Result")}: ${correct}/${total} (${pct}%)</h3>
        <p>${pct >= 80 ? L("Odlično, prag od 80% je pređen.", "Great, you passed the 80% threshold.") : L("Prag je 80%. Pogrešna pitanja su dodana u „Ponovi greške“.", "The threshold is 80%. Missed questions were added to “Review mistakes”.")}</p>
        <div class="row"><button class="btn ghost" onclick="route()">${L("Ponovi kviz", "Retake quiz")}</button>
        ${m.labs.length ? `<a class="btn" href="#/${CID}/m/${id}/labovi">${L("Na labove", "Go to labs")}</a>` : ""}<a class="btn ghost" href="#/${CID}/greske">${L("Ponovi greške", "Review mistakes")}</a></div>`;
      end.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (tab === "labovi") return renderLabList(el, m, meta);
  el.innerHTML = `<article class="md">${md(m.lesson)}</article>
    <div class="done-read row" style="justify-content:space-between">
      <span>${COURSE.progress.lessons[id] ? L("Lekcija je označena kao pročitana.", "The lesson is marked as read.") : L("Kad završiš čitanje, označi lekciju i pređi na kviz.", "When you finish reading, mark the lesson and move on to the quiz.")}</span>
      <button class="btn" id="readBtn">${COURSE.progress.lessons[id] ? L("Idi na kviz", "Go to quiz") : L("Pročitao sam, idi na kviz", "I've read it, go to quiz")}</button>
    </div>`;
  $("#readBtn").onclick = async () => {
    COURSE.progress = await api(`${C()}/lesson/${id}/read`, { post: true });
    location.hash = m.quiz.length ? `#/${CID}/m/${id}/kviz` : m.labs.length ? `#/${CID}/m/${id}/labovi` : `#/${CID}`;
  };
}

function renderLabList(el, m, meta) {
  el.innerHTML = `<p class="lead">${L("Svaki lab se pokreće u izolovanom Docker kontejneru bez mreže. Možeš slobodno griješiti: reset vraća sve na početak.", "Each lab runs in an isolated Docker container with no network. Feel free to make mistakes: reset puts everything back to the start.")}</p>
    <div class="lablist">${m.labs.map((l, i) => {
      const st = COURSE.progress.labs[`${m.id}/${l.id}`];
      const total = meta.labs[i].steps;
      return `<div class="labrow"><div><b>${esc(l.title)}</b><div style="color:var(--muted);font-size:.88rem">${total} ${L("koraka", "steps")}</div></div>
        <div class="row"><span class="pill ${st?.done ? "ok" : ""}">${st?.done ? L("završeno", "completed") : st ? `${st.steps.length} ${L("riješeno", "solved")}` : L("nije počet", "not started")}</span>
        <a class="btn small" href="#/${CID}/lab/${m.id}/${l.id}">${L("Otvori lab", "Open lab")}</a></div></div>`;
    }).join("")}</div>`;
}

// ---------- vježba po cilju i ponavljanje grešaka ----------
async function renderPractice(mode, obj) {
  renderSide();
  const items = await api(mode === "obj" ? `${C()}/review?obj=${encodeURIComponent(obj)}` : C() + "/review");
  const o = COURSE.objectives.find((x) => x.id === obj);
  const title = mode === "obj" ? `${L("Vježba: cilj", "Practice: objective")} ${obj} ${o ? "· " + o.en : ""}` : L("Ponovi greške", "Review mistakes");
  view.innerHTML = `<div class="page"><h1>${esc(title)}</h1>
    <p class="lead">${mode === "obj" ? (o && LANG !== "en" ? esc(o.bs) + ". " : "") + L("Sva pitanja iz banke za ovaj cilj.", "All questions in the bank for this objective.") : L("Pitanja na koja si posljednji put odgovorio pogrešno. Tačan odgovor ih uklanja sa liste.", "Questions you got wrong the last time. A correct answer removes them from the list.")}</p>
    <div id="pr"></div></div>`;
  if (!items.length) { $("#pr").innerHTML = `<p>${mode === "obj" ? L("Za ovaj cilj još nema pitanja.", "There are no questions for this objective yet.") : L("Nema grešaka za ponavljanje. Odlično!", "No mistakes to review. Great!")}</p>`; return; }
  const list = (mode === "greske" ? items.sort(() => Math.random() - 0.5) : items)
    .map((x) => ({ module: x.module, index: x.index, q: x, label: x.moduleTitle }));
  runPractice($("#pr"), list, (correct, total, end) => {
    renderSide();
    end.hidden = false;
    end.innerHTML = `<h3 style="margin-top:0">${L("Rezultat", "Result")}: ${correct}/${total}</h3><div class="row"><button class="btn ghost" onclick="route()">${L("Ponovo", "Again")}</button><a class="btn" href="#/${CID}/ciljevi">${L("Ciljevi ispita", "Exam objectives")}</a></div>`;
  });
}

function renderObjectives() {
  renderSide();
  const modFor = (id) => COURSE.modules.find((m) => (m.objectives || []).includes(id));
  view.innerHTML = `<div class="page"><h1>${L("Ciljevi ispita", "Exam objectives")} ${esc(COURSE.code)}</h1>
    <p class="lead">${L(`Svih ${COURSE.objectives.length} ciljeva iz zvaničnog dokumenta, sa brojem pitanja u banci i tvojom tačnošću. Crveno i žuto su tvoje slabe tačke.`, `All ${COURSE.objectives.length} objectives from the official document, with the number of questions in the bank and your accuracy. Red and yellow are your weak spots.`)}</p>
    ${COURSE.exam.domains.map((d) => `<h2 style="margin:24px 0 8px">${d.n}.0 ${esc(d.name)} <span class="muted" style="font-size:.9rem">(${d.weight}%)</span></h2>
      <div class="objlist">${COURSE.objectives.filter((o) => o.id.startsWith(d.n + ".")).map((o) => {
        const s = COURSE.progress.stats[o.id]; const v = pctOf(s); const m = modFor(o.id);
        const n = COURSE.modules.reduce((a, mm) => a + (mm.objCounts?.[o.id] || 0), 0);
        const cls = v === null ? "" : v >= 80 ? "ok" : v >= 65 ? "warn" : "bad";
        return `<div class="objrow"><div><b>${o.id}</b> ${esc(o.en)}<div class="muted" style="font-size:.85rem">${LANG === "en" ? "" : esc(o.bs)}${m ? `${LANG === "en" ? "" : " · "}<a href="#/${CID}/m/${m.id}">${L("modul", "module")} ${num(m.id)}</a>` : ""}</div></div>
          <div class="row"><span class="pill ${cls}">${v === null ? L("bez odgovora", "no answers") : `${v}% (${s.ok}/${s.total})`}</span><span class="muted" style="font-size:.85rem">${n} ${L("pit.", "q.")}</span>
          ${n ? `<a class="btn small ghost" href="#/${CID}/vjezba/${o.id}">${L("Vježbaj", "Practice")}</a>` : ""}</div></div>`;
      }).join("")}</div>`).join("")}</div>`;
}

// ---------- akronimi ----------
async function renderAcronyms() {
  renderSide();
  const all = await api(C() + "/acronyms");
  let onlyUnknown = true;
  let deck = [], pos = 0;
  const build = () => {
    deck = all.filter((x) => !onlyUnknown || !COURSE.progress.acronyms[x.a]).sort(() => Math.random() - 0.5);
    pos = 0;
  };
  build();
  const draw = () => {
    const known = Object.keys(COURSE.progress.acronyms).length;
    const card = deck[pos];
    const desc = (x) => (LANG === "en" ? x.desc || "" : x.bs || "");
    view.innerHTML = `<div class="page"><h1>${L("Akronimi", "Acronyms")}</h1>
      <p class="lead">${L(`Ispit podrazumijeva da znaš svih ${all.length} akronima sa zvanične liste. Pogledaj akronim, sjeti se značenja, pa otkrij karticu. Znaš: ${known}/${all.length}.`, `The exam assumes you know all ${all.length} acronyms on the official list. Look at the acronym, recall its meaning, then reveal the card. Known: ${known}/${all.length}.`)}</p>
      <div class="row" style="margin-bottom:14px"><label class="row"><input type="checkbox" id="unk" ${onlyUnknown ? "checked" : ""}> ${L("samo one koje još ne znam", "only the ones I don't know yet")}</label></div>
      ${card ? `<div class="flash" id="card"><div class="fa">${esc(card.a)}</div><div class="fb2" hidden><div class="fen">${esc(card.en)}</div><div class="muted">${esc(desc(card))}</div></div>
        <div class="muted" style="font-size:.85rem;margin-top:16px">${pos + 1} / ${deck.length} · ${L("klikni ili pritisni razmak za okretanje", "click or press space to flip")}</div></div>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn ghost" id="no">${L("Ne znam", "Don't know")} (J)</button><button class="btn" id="yes">${L("Znam", "Know it")} (K)</button></div>`
      : `<p>${L("Sve kartice u ovom špilu su gotove.", "All cards in this deck are done.")} ${onlyUnknown ? L("Znaš sve akronime!", "You know all the acronyms!") : ""}</p><button class="btn" id="again">${L("Ponovo", "Again")}</button>`}
      <details style="margin-top:28px"><summary>${L("Cijela lista", "Full list")}</summary><table class="md" style="display:table;margin-top:10px">${all.map((x) => `<tr><td><b>${esc(x.a)}</b></td><td>${esc(x.en)}</td><td class="muted">${esc(desc(x))}</td></tr>`).join("")}</table></details></div>`;
    $("#unk").onchange = (e) => { onlyUnknown = e.target.checked; build(); draw(); };
    if (!card) { $("#again").onclick = () => { build(); draw(); }; return; }
    const flip = () => { $("#card .fb2").hidden = false; };
    $("#card").onclick = flip;
    const mark = async (known) => {
      COURSE.progress = await api(C() + "/acronyms/mark", { body: { a: card.a, known } });
      renderSide(); pos++; draw();
    };
    $("#yes").onclick = () => mark(true);
    $("#no").onclick = () => mark(false);
    document.onkeydown = (e) => {
      if (!location.hash.startsWith(`#/${CID}/akronimi`)) { document.onkeydown = null; return; }
      if (e.key === " ") { e.preventDefault(); flip(); }
      if (e.key === "k") mark(true);
      if (e.key === "j") mark(false);
    };
  };
  draw();
}

// ---------- lab ----------
async function stopLab() {
  const s = labState;
  labState = null;
  if (!s) return;
  try { s.ws?.close(); } catch {}
  try { s.term?.dispose(); } catch {}
  window.removeEventListener("resize", s.onResize);
  if (s.session) await api(`/api/lab/session/${s.session}/stop`, { post: true }).catch(() => {});
}

async function renderLab(mid, lid) {
  await stopLab();
  const m = await api(`${C()}/modules/${mid}`);
  const lab = m.labs.find((l) => l.id === lid);
  if (!lab) throw new Error(L("Lab ne postoji", "Lab not found"));
  renderSide(mid);
  const done = new Set(COURSE.progress.labs[`${mid}/${lid}`]?.steps || []);
  view.innerHTML = `<div class="lab">
    <div class="lab-left">
      <a href="#/${CID}/m/${mid}/labovi" style="font-size:.9rem">← ${esc(m.title)}</a>
      <h1 style="font-size:1.4rem;margin:10px 0">${esc(lab.title)}</h1>
      <div class="md">${md(lab.intro)}</div>
      ${lab.steps.map((s, i) => `<details class="step ${done.has(i) ? "passed" : ""}" data-step="${i}" ${i === 0 || (done.has(i - 1) && !done.has(i)) ? "open" : ""}>
        <summary><span class="sn">${i + 1}</span><b>${esc(s.title)}</b></summary>
        <div class="sbody"><div class="md">${md(s.text)}</div>
          <div class="row" style="margin-top:10px">
            ${s.checkable ? `<button class="btn small" data-verify="${i}">${L("Provjeri", "Check")}</button>` : ""}
            ${s.hasHint ? `<button class="btn ghost small" data-hint="${i}">${L("Savjet", "Hint")}</button>` : ""}
          </div>
          <div class="msg"></div><div class="hintbox"></div></div></details>`).join("")}
    </div>
    <div class="lab-right">
      <div class="termbar"><span id="tstat">${L("Terminal nije pokrenut", "Terminal not started")}</span>${lab.minutes ? `<span class="timer" id="ltimer">${lab.minutes}:00</span>` : ""}
        <span class="row"><button class="btn small" id="tstart">${L("Pokreni lab", "Start lab")}</button><button class="btn ghost small" id="treset" hidden>Reset</button></span></div>
      <div class="term-empty" id="tempty"><div>${COURSE.labNodes ? L(`Klikni „Pokreni lab“ da dobiješ svjež Kubernetes klaster (${COURSE.labNodes.map(esc).join(" + ")}).<br>Podizanje traje 1–4 minute.`, `Click “Start lab” to get a fresh Kubernetes cluster (${COURSE.labNodes.map(esc).join(" + ")}).<br>Startup takes 1–4 minutes.`) : L("Klikni „Pokreni lab“ da dobiješ svjež Linux kontejner.<br>Prvo pokretanje traje nekoliko sekundi.", "Click “Start lab” to get a fresh Linux container.<br>The first start takes a few seconds.")}</div></div>
      <div class="term" id="term" hidden></div>
    </div></div>`;

  // dugme ▶ na blokovima koda šalje komandu u terminal
  view.querySelectorAll(".lab-left pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (!code || /language-(text|txt|output)/.test(code.className)) return;
    const b = document.createElement("button");
    b.className = "run"; b.textContent = L("▶ pokreni", "▶ run"); b.title = L("Pošalji u terminal", "Send to terminal");
    b.onclick = () => {
      if (!labState?.ws || labState.ws.readyState !== 1) { $("#tstat").textContent = L("Prvo pokreni lab", "Start the lab first"); return; }
      labState.ws.send(code.textContent.replace(/\n+$/, "") + "\r");
      labState.term.focus();
    };
    pre.appendChild(b);
  });

  const start = async () => {
    await stopLab();
    $("#tstart").disabled = true;
    const cluster = COURSE.labNodes?.length;
    const t0 = Date.now();
    const tick = () => { $("#tstat").textContent = (cluster ? L(`Podižem klaster (${COURSE.labNodes.join(" + ")})… `, `Starting cluster (${COURSE.labNodes.join(" + ")})… `) : L("Pokrećem kontejner i pripremam lab… ", "Starting container and preparing the lab… ")) + Math.round((Date.now() - t0) / 1000) + " s"; };
    tick(); const timer = setInterval(tick, 1000);
    $("#tempty").hidden = false; $("#term").hidden = true;
    if (cluster) $("#tempty").innerHTML = `<div>${L(`Podižem kubeadm klaster: ${COURSE.labNodes.map(esc).join(", ")}.<br>Obično traje oko minut; labovi sa dodatnim komponentama (Traefik, probni ispit) i do 4 minute.`, `Starting a kubeadm cluster: ${COURSE.labNodes.map(esc).join(", ")}.<br>This usually takes about a minute; labs with extra components (Traefik, mock exam) can take up to 4 minutes.`)}</div>`;
    try {
      const { session, user } = await api(`${C()}/lab/${mid}/${lid}/start`, { post: true });
      clearInterval(timer);
      attachTerminal(session, user);
      if (lab.minutes) startLabTimer(lab.minutes);
      $("#tstart").hidden = true; $("#treset").hidden = false;
    } catch (e) {
      clearInterval(timer);
      $("#tstat").textContent = L("Greška", "Error");
      $("#tempty").innerHTML = `<div class="err">${esc(e.message)}${e.data?.out ? "\n\n" + esc(e.data.out) : ""}</div>`;
    } finally { $("#tstart").disabled = false; }
  };
  $("#tstart").onclick = start;
  $("#treset").onclick = start;

  view.querySelectorAll("[data-verify]").forEach((b) => b.onclick = async () => {
    const i = Number(b.dataset.verify);
    const box = view.querySelector(`[data-step="${i}"]`);
    const msg = box.querySelector(".msg");
    if (!labState?.session) { msg.className = "msg bad"; msg.textContent = L("Prvo pokreni lab.", "Start the lab first."); return; }
    b.disabled = true; msg.className = "msg"; msg.textContent = L("Provjeravam…", "Checking…");
    try {
      const r = await api(`/api/lab/session/${labState.session}/verify/${i}`, { post: true });
      if (r.pass) {
        msg.className = "msg ok"; msg.textContent = L("✔ Korak riješen.", "✔ Step solved.");
        box.classList.add("passed");
        COURSE.progress = r.progress; renderSide(mid);
        const next = view.querySelector(`[data-step="${i + 1}"]`);
        if (next) { box.open = false; next.open = true; }
        else if (r.progress.labs[`${mid}/${lid}`]?.done) msg.textContent = L("✔ Svi koraci su riješeni. Lab je završen!", "✔ All steps solved. Lab complete!");
      } else {
        msg.className = "msg bad";
        msg.innerHTML = `${L("✘ Još nije.", "✘ Not yet.")} ${r.out ? `<div class="out">${esc(r.out)}</div>` : ""}`;
      }
    } catch (e) { msg.className = "msg bad"; msg.textContent = e.message; }
    b.disabled = false;
  });
  view.querySelectorAll("[data-hint]").forEach((b) => b.onclick = async () => {
    const i = Number(b.dataset.hint);
    const box = view.querySelector(`[data-step="${i}"] .hintbox`);
    if (!labState?.session) { box.innerHTML = `<div class="msg bad">${L("Savjet je dostupan kad je lab pokrenut.", "Hints are available once the lab is running.")}</div>`; return; }
    const r = await api(`/api/lab/session/${labState.session}/hint/${i}`);
    box.innerHTML = `<div class="explain md">${md(r.hint)}</div>`;
  });
}

// odbrojavanje za probni ispit; ističe samo vizuelno, lab ostaje otvoren
function startLabTimer(minutes) {
  const end = Date.now() + minutes * 60000;
  const el = $("#ltimer");
  clearInterval(window.labTimer);
  window.labTimer = setInterval(() => {
    if (!document.body.contains(el)) return clearInterval(window.labTimer);
    const left = Math.max(0, end - Date.now());
    el.textContent = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
    if (!left) { el.textContent = L("Vrijeme je isteklo", "Time is up"); clearInterval(window.labTimer); }
  }, 1000);
}

function attachTerminal(session, user = "root@lab") {
  $("#tempty").hidden = true;
  const host = $("#term");
  host.hidden = false; host.innerHTML = "";
  const term = new Terminal({
    cursorBlink: true, fontSize: 14, fontFamily: 'Menlo, "SF Mono", Consolas, monospace',
    theme: { background: "#000000", foreground: "#e3eaee", cursor: "#3fb8d6" }, scrollback: 5000,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(host);
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/term?session=${session}`);
  ws.binaryType = "arraybuffer";
  const sendSize = () => { try { fit.fit(); if (ws.readyState === 1) ws.send(`\u0000resize:${term.cols}x${term.rows}`); } catch {} };
  ws.onopen = () => { $("#tstat").textContent = L("Povezano · ", "Connected · ") + user; sendSize(); term.focus(); };
  ws.onmessage = (e) => term.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data));
  ws.onclose = () => { if (labState?.ws === ws) $("#tstat").textContent = L("Veza zatvorena", "Connection closed"); };
  term.onData((d) => { if (ws.readyState === 1) ws.send(d); });
  const onResize = () => sendSize();
  window.addEventListener("resize", onResize);
  labState = { session, ws, term, onResize };
  setTimeout(sendSize, 50);
}

// ---------- simulacija ispita ----------
let examTimer = null;
function renderExam() {
  renderSide();
  const p = COURSE.progress;
  const e = COURSE.exam;
  view.innerHTML = `<div class="page">
    <h1>${L("Simulacija ispita", "Exam simulation")}</h1>
    <p class="lead">${L(`${e.size} nasumičnih pitanja za ${e.minutes} minuta${domains().length ? ", raspoređenih po težinama domena, PBQ pitanja na početku" : " iz svih modula"}. Možeš označiti pitanje za kasniji pregled. Objašnjenja vidiš tek nakon predaje. Prolaz je ${isScaled() ? `${e.pass} na skali ${e.scaleMin}–${e.scaleMax}` : `${e.pass}%`}.`, `${e.size} random questions in ${e.minutes} minutes${domains().length ? ", distributed by domain weight, with PBQs first" : " from all modules"}. You can flag a question for later review. Explanations are shown only after you submit. The passing score is ${isScaled() ? `${e.pass} on a ${e.scaleMin}–${e.scaleMax} scale` : `${e.pass}%`}.`)}</p>
    ${e.note ? `<div class="callout">${esc(e.note)}</div>` : ""}
    <div class="row">
      <button class="btn" data-size="${e.size}">${L("Puni ispit", "Full exam")}: ${e.size} ${L("pitanja", "questions")} · ${e.minutes} min</button>
      ${e.size > 30 ? `<button class="btn ghost" data-size="30">${L("Kratki", "Short")}: 30 ${L("pitanja", "questions")} · ${Math.round((e.minutes * 30) / e.size)} min</button>` : ""}
    </div>
    ${isScaled() ? `<p class="muted" style="font-size:.85rem;margin-top:10px">${L("Skalirani rezultat je linearna procjena iz procenta tačnih odgovora. Proizvođač ispita ne objavljuje formulu, pa ciljaj stabilnih 85%+ prije pravog ispita.", "The scaled score is a linear estimate from the percentage of correct answers. The exam vendor does not publish the formula, so aim for a consistent 85%+ before the real exam.")}</p>` : ""}
    ${p.exams.length ? `<h3 style="margin-top:24px">${L("Prethodni pokušaji", "Previous attempts")}</h3><table class="md" style="display:table"><tr><th>${L("Datum", "Date")}</th><th>${L("Rezultat", "Score")}</th><th>${L("Tačno", "Correct")}</th><th>${L("Po domenima", "By domain")}</th><th>${L("Vrijeme", "Time")}</th></tr>
      ${p.exams.slice().reverse().slice(0, 10).map((x) => `<tr><td>${new Date(x.at).toLocaleString(L("sr-Latn-RS", "en-GB"))}</td>
        <td><b class="verdict ${x.score >= e.pass ? "ok" : "bad"}">${fmtScore(x.score)}</b></td><td>${x.correct}/${x.total} (${x.pct}%)</td>
        <td style="font-size:.82rem">${(x.byDomain || []).map((d) => `D${d.n}: ${d.total ? Math.round((d.correct / d.total) * 100) : "–"}%`).join(" · ")}</td><td>${x.minutes} min</td></tr>`).join("")}</table>` : ""}
  </div>`;
  view.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => startExam(Number(b.dataset.size)));
}

async function startExam(size) {
  const ex = await api(C() + "/exam/start", { body: { size } });
  const end = Date.now() + ex.minutes * 60000;
  const flagged = new Set();
  view.innerHTML = `<div class="page">
    <div class="examnav row" style="justify-content:space-between"><b>${L("Simulacija", "Simulation")} · ${ex.questions.length} ${L("pitanja", "questions")}</b>
      <span class="row"><span class="muted" id="answered"></span><span class="timer" id="timer"></span><button class="btn" id="submit">${L("Predaj", "Submit")}</button></span>
      <div class="qgrid" id="qgrid">${ex.questions.map((_, i) => `<a href="javascript:void 0" data-go="${i}">${i + 1}</a>`).join("")}</div></div>
    ${ex.questions.map((q, i) => `<div class="q" data-q="${i}" id="eq${i}">
      ${questionHtml(q, "e" + i, `${L("Pitanje", "Question")} ${i + 1}/${ex.questions.length} · ${q.domain ? L("domen ", "domain ") + q.domain : esc(q.module)}`)}
      <div class="row" style="margin-top:8px"><button class="btn ghost small" data-flag="${i}">${L("Označi za pregled", "Flag for review")}</button></div>
      <div class="fb"></div></div>`).join("")}
    <button class="btn" id="submit2">${L("Predaj ispit", "Submit exam")}</button></div>`;
  view.querySelectorAll(".q[data-q]").forEach(wireQuestion);
  const refresh = () => {
    let n = 0;
    ex.questions.forEach((q, i) => {
      const done = getChoice(view.querySelector(`[data-q="${i}"]`), q) !== undefined && !(q.type === "order" && !view.querySelector(`[data-q="${i}"]`).dataset.touched);
      if (done) n++;
      const a = view.querySelector(`[data-go="${i}"]`);
      a.className = (done ? "done " : "") + (flagged.has(i) ? "flag" : "");
    });
    $("#answered").textContent = `${n}/${ex.questions.length} ${L("odgovoreno", "answered")}`;
  };
  view.addEventListener("change", refresh);
  view.addEventListener("click", (e) => {
    const mv = e.target.closest("[data-mv]"); if (mv) { mv.closest(".q").dataset.touched = 1; refresh(); }
    const fl = e.target.closest("[data-flag]");
    if (fl) { const i = Number(fl.dataset.flag); flagged.has(i) ? flagged.delete(i) : flagged.add(i); fl.textContent = flagged.has(i) ? L("Označeno ★", "Flagged ★") : L("Označi za pregled", "Flag for review"); refresh(); }
    const go = e.target.closest("[data-go]");
    if (go) document.getElementById("eq" + go.dataset.go).scrollIntoView({ behavior: "smooth", block: "start" });
  });
  refresh();
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    $("#timer").textContent = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
    if (!left) submit();
  };
  let sent = false;
  const submit = async () => {
    if (sent) return; sent = true;
    clearInterval(examTimer);
    const answers = ex.questions.map((q, i) => getChoice(view.querySelector(`[data-q="${i}"]`), q) ?? null);
    const r = await api(`${C()}/exam/${ex.id}/submit`, { body: { answers } });
    COURSE.progress = (await api(C())).progress;
    renderSide();
    r.results.forEach((res, i) => {
      const box = view.querySelector(`[data-q="${i}"]`);
      showResult(box, ex.questions[i], res.answer, res.correct, res.explain);
      view.querySelector(`[data-go="${i}"]`).className = res.correct ? "ok" : "bad";
    });
    view.querySelectorAll("[data-flag]").forEach((b) => b.remove());
    const nav = view.querySelector(".examnav");
    nav.querySelector(".row").innerHTML = `<b class="verdict ${r.pass ? "ok" : "bad"}">${isScaled() ? r.score + " / " + COURSE.exam.scaleMax : r.score + "%"} · ${r.pass ? L("PROLAZ", "PASS") : L("PAD", "FAIL")}</b><span>${r.correct}/${r.total} (${r.pct}%) · ${r.minutes} min</span>`;
    nav.insertAdjacentHTML("afterbegin", `<div class="dres">${r.byDomain.map((d) => {
      const v = d.total ? Math.round((d.correct / d.total) * 100) : null;
      return `<div><span>${d.n}.0 ${esc(d.name)}</span><span class="verdict ${v >= 80 ? "ok" : "bad"}">${v ?? "–"}% (${d.correct}/${d.total})</span></div>`;
    }).join("")}</div>`);
    $("#submit2").remove();
    view.scrollTop = 0;
  };
  $("#submit").onclick = submit; $("#submit2").onclick = submit;
  tick(); examTimer = setInterval(tick, 1000);
}

// ---------- izvori ----------
function renderSources() {
  renderSide();
  // izvori mogu biti {checked, items:[{name,url,note}]} ili niz [{title,url}]
  const src = COURSE.sources || [];
  const items = Array.isArray(src) ? src : src.items || [];
  const checked = Array.isArray(src) ? "" : src.checked || "";
  view.innerHTML = `<div class="page"><h1>${L("Izvori", "Sources")}</h1>
    <p class="lead">${L("Sadržaj je sastavljen iz izvora ispod.", "The content is based on the sources below.")}${checked ? ` ${L("Provjereno", "Checked")}: ${esc(checked)}.` : ""} ${L("Ovo nije zvanični materijal proizvođača ispita.", "This is not official material from the exam vendor.")}</p>
    <div class="md"><ul>${items.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name || s.title)}</a>${s.note ? ` · ${esc(s.note)}` : ""}</li>`).join("")}</ul></div></div>`;
}

document.documentElement.lang = LANG;
renderLangSwitch();
api("/api/courses").then((list) => { COURSES = list; return route(); }).catch((e) => {
  view.innerHTML = `<div class="page"><p class="err">${L("Server nije dostupan", "Server not reachable")}: ${esc(e.message)}</p></div>`;
});
