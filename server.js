import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { loadCourses, isCorrect, qType, LANGS } from "./content.js";
import { createLabEnv, execRun, cleanupLabels } from "./labenv.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const LABEL = "kurs.app";
const LABEL_VALUE = "secops-trening";
const DATA_DIR = path.join(ROOT, "data");

// sadržaj po jeziku (sr je original, en prevod sa povratkom na sr gdje prevoda nema)
const loadAll = () => Object.fromEntries(LANGS.map((l) => [l, loadCourses(ROOT, l)]));
let byLang = loadAll();
const reload = () => { if (process.env.NODE_ENV !== "production") byLang = loadAll(); };
const langOf = (req) => { const l = String(req.query.lang || req.get("x-lang") || "sr").toLowerCase(); return LANGS.includes(l) ? l : "sr"; };
const getCourse = (id, lang = "sr") => byLang[lang].find((c) => c.id === id);
// poruke servera na oba jezika
const M = {
  noCourse: ["Nema kursa", "Course not found"], noModule: ["Nema modula", "Module not found"], noQuestion: ["Nema pitanja", "Question not found"],
  noExam: ["Ispit ne postoji ili je već predat", "Exam not found or already submitted"], noLab: ["Nema laba", "Lab not found"],
  setupFailed: ["Priprema laba nije uspjela", "Lab setup failed"], otherLab: ["Pokrenut je drugi lab.", "Another lab was started."],
  noImage: ["Slika laba {img} ne postoji. Pokreni: npm run build-labs", "Lab image {img} does not exist. Run: npm run build-labs"],
  noDocker: ["Docker nije pokrenut. Pokreni Docker (Colima/Docker Desktop).", "Docker is not running. Start Docker (Colima/Docker Desktop)."],
  sessionGone: ["Sesija je istekla. Pokreni lab ponovo.", "The session has expired. Start the lab again."],
  noVerify: ["Ovaj korak nema provjeru", "This step has no check"], noHint: ["Nema savjeta za ovaj korak.", "No hint for this step."],
};
const t = (lang, key, vars = {}) => M[key][lang === "en" ? 1 : 0].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// ---------- napredak (jedan fajl po kursu) ----------
function emptyProgress() {
  // stats: tačnost po cilju ispita; mods: tačnost po modulu; wrong: pogrešno odgovorena pitanja ("modul:indeks") za ponavljanje
  // labs["modul/lab"]: { steps, done, hints, fails } (hints i fails koristi plan učenja)
  return { lessons: {}, quiz: {}, labs: {}, exams: [], stats: {}, mods: {}, wrong: {}, acronyms: {} };
}
const progressFile = (cid) => path.join(DATA_DIR, `progress-${cid}.json`);
function readProgress(cid) {
  try { return { ...emptyProgress(), ...JSON.parse(fs.readFileSync(progressFile(cid), "utf8")) }; }
  catch { return emptyProgress(); }
}
function writeProgress(cid, p) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(progressFile(cid), JSON.stringify(p, null, 2));
}
function updateProgress(cid, fn) { const p = readProgress(cid); fn(p); writeProgress(cid, p); return p; }

function moduleDone(m, p) {
  const parts = 1 + (m.quiz.length ? 1 : 0) + m.labs.length;
  const done = (p.lessons[m.id] ? 1 : 0) + ((p.quiz[m.id]?.best ?? 0) >= 80 ? 1 : 0)
    + m.labs.filter((l) => p.labs[`${m.id}/${l.id}`]?.done).length;
  return done / parts;
}

// ---------- docker ----------
const sessions = new Map(); // sessionId -> { env, courseId, moduleId, labId }
let pendingEnv = null; // okruženje koje se upravo priprema

async function cleanupOld() {
  try {
    const n = await cleanupLabels(`${LABEL}=${LABEL_VALUE}`);
    if (n) console.log(`Uklonjeno ${n} starih lab kontejnera.`);
  } catch (e) {
    console.warn("Docker nije dostupan:", e.message);
  }
}

async function stopSession(id) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  await s.env.remove();
}

// ---------- HTTP ----------
const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(ROOT, "public")));
app.use("/vendor/xterm", express.static(path.join(ROOT, "node_modules/@xterm/xterm")));
app.use("/vendor/addon-fit", express.static(path.join(ROOT, "node_modules/@xterm/addon-fit")));
app.use("/vendor/marked", express.static(path.join(ROOT, "node_modules/marked")));

// spot: klijent dobija broj redova koje treba označiti (picks), ali ne i koje
const publicQuestion = (q) => ({
  q: q.q, options: q.options, type: qType(q), targets: q.targets, obj: q.obj, snippet: q.snippet, lang: q.lang,
  picks: qType(q) === "spot" ? answerOf(q).length : undefined,
});
const answerOf = (q) => (Array.isArray(q.answer) ? q.answer : [q.answer]);

function record(p, m, i, q, correct) {
  if (q.obj) {
    const st = p.stats[q.obj] || { ok: 0, total: 0 };
    st.total++; if (correct) st.ok++;
    p.stats[q.obj] = st;
  }
  const ms = p.mods[m] || { ok: 0, total: 0 };
  ms.total++; if (correct) ms.ok++;
  p.mods[m] = ms;
  const key = `${m}:${i}`;
  if (correct) delete p.wrong[key]; else p.wrong[key] = Date.now();
}

// Pregled svih kurseva za početnu stranicu
app.get("/api/courses", (req, res) => {
  reload();
  res.json(byLang[langOf(req)].map((c) => {
    const p = readProgress(c.id);
    const pct = c.modules.length ? Math.round((c.modules.reduce((a, m) => a + moduleDone(m, p), 0) / c.modules.length) * 100) : 0;
    const last = p.exams.slice(-3);
    return {
      id: c.id, title: c.title, subtitle: c.subtitle, code: c.code, badge: c.badge,
      modules: c.modules.length, questions: c.modules.reduce((a, m) => a + m.quiz.length, 0),
      labs: c.modules.reduce((a, m) => a + m.labs.length, 0), acronyms: (c.acronyms || []).length,
      pct, lastExam: last.length ? last[last.length - 1] : null, exam: c.exam,
    };
  }));
});

// Sve ostale rute rade nad jednim kursom
const api = express.Router({ mergeParams: true });
app.use("/api/c/:cid", (req, res, next) => {
  reload();
  req.lang = langOf(req);
  req.course = getCourse(req.params.cid, req.lang);
  if (!req.course) return res.status(404).json({ error: t(req.lang, "noCourse") });
  next();
}, api);

const findModule = (c, id) => c.modules.find((m) => m.id === id);
const findLab = (c, mid, lid) => findModule(c, mid)?.labs.find((l) => l.id === lid);

api.get("/", (req, res) => {
  const c = req.course;
  res.json({
    id: c.id, title: c.title, subtitle: c.subtitle, code: c.code, badge: c.badge, sources: c.sources, exam: c.exam,
    labNodes: c.lab?.nodes || null,
    objectives: c.objectives || [],
    acronymCount: (c.acronyms || []).length,
    modules: c.modules.map((m) => ({
      id: m.id, title: m.title, summary: m.summary, minutes: m.minutes, domain: m.domain, objectives: m.objectives,
      quizCount: m.quiz.length,
      objCounts: m.quiz.reduce((a, q) => (q.obj && (a[q.obj] = (a[q.obj] || 0) + 1), a), {}),
      labs: m.labs.map((l) => ({ id: l.id, title: l.title, steps: l.steps.length })),
    })),
    progress: readProgress(c.id),
  });
});

api.get("/acronyms", (req, res) => res.json(req.course.acronyms || []));
api.post("/acronyms/mark", (req, res) => {
  res.json(updateProgress(req.course.id, (p) => { if (req.body.known) p.acronyms[req.body.a] = 1; else delete p.acronyms[req.body.a]; }));
});

api.get("/modules/:id", (req, res) => {
  const m = findModule(req.course, req.params.id);
  if (!m) return res.status(404).json({ error: t(req.lang, "noModule") });
  res.json({
    id: m.id, title: m.title, summary: m.summary, lesson: m.lesson, domain: m.domain, objectives: m.objectives,
    quiz: m.quiz.map(publicQuestion),
    labs: m.labs.map((l) => ({
      id: l.id, title: l.title, intro: l.intro, minutes: l.minutes,
      steps: l.steps.map((s) => ({ title: s.title, text: s.text, hasHint: !!s.hint, checkable: !!s.verify })),
    })),
  });
});

api.post("/lesson/:id/read", (req, res) => {
  res.json(updateProgress(req.course.id, (p) => { p.lessons[req.params.id] = true; }));
});

api.post("/quiz/:id/check", (req, res) => {
  const m = findModule(req.course, req.params.id);
  const q = m?.quiz[req.body.index];
  if (!q) return res.status(404).json({ error: t(req.lang, "noQuestion") });
  const correct = isCorrect(q, req.body.choice);
  const progress = updateProgress(req.course.id, (p) => record(p, m.id, req.body.index, q, correct));
  res.json({ correct, answer: answerOf(q), explain: q.explain, progress });
});

api.post("/quiz/:id/finish", (req, res) => {
  const m = findModule(req.course, req.params.id);
  if (!m) return res.status(404).json({ error: t(req.lang, "noModule") });
  const score = Math.round((Number(req.body.correct) / Number(req.body.total || m.quiz.length)) * 100);
  res.json(updateProgress(req.course.id, (p) => {
    const prev = p.quiz[m.id] || { best: 0 };
    p.quiz[m.id] = { best: Math.max(prev.best, score), last: score, at: new Date().toISOString() };
  }));
});

// Ponavljanje: pitanja na koja je odgovor bio pogrešan, ili sva pitanja jednog cilja
api.get("/review", (req, res) => {
  const c = req.course;
  const p = readProgress(c.id);
  let items;
  if (req.query.obj) {
    items = c.modules.flatMap((m) => m.quiz.map((q, i) => ({ m, i, q }))).filter((x) => x.q.obj === req.query.obj);
  } else {
    items = Object.keys(p.wrong).map((k) => { const [mid, i] = k.split(":"); const m = findModule(c, mid); return m?.quiz[i] && { m, i: Number(i), q: m.quiz[i] }; }).filter(Boolean);
  }
  res.json(items.map((x) => ({ module: x.m.id, moduleTitle: x.m.title, index: x.i, ...publicQuestion(x.q) })));
});

// Simulacija ispita: ako kurs ima domene, broj pitanja po domenu prema težinama i ravnomjerno po ciljevima; PBQ prvo.
const exams = new Map();
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function pickExam(c, size) {
  const all = c.modules.flatMap((m) => m.quiz.map((q, i) => ({ m: m.id, d: m.domain, i, q })));
  const domains = c.exam.domains || [];
  if (!domains.length) return shuffle(all).slice(0, size);
  // raspodjela po težinama (metoda najvećeg ostatka)
  const raw = domains.map((d) => ({ n: d.n, exact: (size * d.weight) / 100 }));
  raw.forEach((r) => { r.count = Math.floor(r.exact); });
  let left = size - raw.reduce((a, r) => a + r.count, 0);
  [...raw].sort((a, b) => (b.exact - b.count) - (a.exact - a.count)).forEach((r) => { if (left > 0) { r.count++; left--; } });
  const picked = [];
  // unutar domena biraj kružno po ciljevima, da cilj sa mnogo pitanja ne preuzme cijeli domen
  for (const r of raw) {
    const byObj = {};
    for (const x of shuffle(all.filter((x) => x.d === r.n))) (byObj[x.q.obj] ||= []).push(x);
    const queues = shuffle(Object.values(byObj));
    const out = [];
    while (out.length < r.count && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < r.count) out.push(q.shift());
    picked.push(...out);
  }
  if (picked.length < size) { // ako nekom domenu fali pitanja, dopuni iz ostalih
    const used = new Set(picked);
    picked.push(...shuffle(all.filter((x) => !used.has(x))).slice(0, size - picked.length));
  }
  return picked;
}

api.post("/exam/start", (req, res) => {
  const c = req.course;
  const cfg = c.exam;
  const size = Math.min(Number(req.body?.size) || cfg.size, cfg.size);
  const minutes = Math.round(cfg.minutes * (size / cfg.size));
  let picked = pickExam(c, size);
  const isPbq = (x) => ["order", "match", "spot"].includes(qType(x.q));
  picked = [...shuffle(picked.filter(isPbq)), ...shuffle(picked.filter((x) => !isPbq(x)))];
  const id = crypto.randomUUID();
  exams.set(id, { courseId: c.id, picked, started: Date.now(), minutes });
  res.json({
    id, minutes,
    questions: picked.map((x) => ({ module: findModule(c, x.m).title, domain: x.d, ...publicQuestion(x.q) })),
  });
});

// Skalirani rezultat (npr. 100–900 CompTIA, 100–1000 AWS) je linearna procjena: proizvođači ne objavljuju formulu.
// Bez scaleMax rezultat je procenat.
const examScore = (cfg, pct) => (cfg.scaleMax ? Math.round(cfg.scaleMin + ((cfg.scaleMax - cfg.scaleMin) * pct) / 100) : Math.round(pct));

api.post("/exam/:id/submit", (req, res) => {
  const c = req.course;
  const ex = exams.get(req.params.id);
  if (!ex || ex.courseId !== c.id) return res.status(404).json({ error: t(req.lang, "noExam") });
  exams.delete(req.params.id);
  const answers = req.body.answers || [];
  const results = ex.picked.map((x, i) => {
    const a = answers[i];
    const given = a === undefined || a === null || (Array.isArray(a) && a.length === 0) ? null : a;
    return { module: x.m, domain: x.d, obj: x.q.obj, correct: given !== null && isCorrect(x.q, given), answer: answerOf(x.q), explain: x.q.explain };
  });
  const correct = results.filter((r) => r.correct).length;
  const pct = Math.round((correct / results.length) * 100);
  const score = examScore(c.exam, (correct / results.length) * 100);
  const byDomain = (c.exam.domains || []).map((d) => {
    const rs = results.filter((r) => r.domain === d.n);
    return { n: d.n, name: d.name, correct: rs.filter((r) => r.correct).length, total: rs.length };
  });
  const minutes = Math.round((Date.now() - ex.started) / 60000);
  updateProgress(c.id, (p) => {
    ex.picked.forEach((x, i) => record(p, x.m, x.i, x.q, results[i].correct));
    p.exams.push({ at: new Date().toISOString(), pct, score, correct, total: results.length, minutes, byDomain });
  });
  res.json({ pct, score, pass: score >= c.exam.pass, correct, total: results.length, minutes, byDomain, results });
});

api.post("/progress/reset", (req, res) => {
  writeProgress(req.course.id, emptyProgress());
  res.json(readProgress(req.course.id));
});

// ---------- labovi ----------
api.post("/lab/:mid/:lid/start", async (req, res) => {
  const c = req.course;
  const lab = findLab(c, req.params.mid, req.params.lid);
  if (!lab) return res.status(404).json({ error: t(req.lang, "noLab") });
  // jedna aktivna sesija u isto vrijeme: lab je lokalan i za jednog korisnika
  await Promise.all([...sessions.keys()].map(stopSession));
  // klaster se podiže i do minut; ako je u međuvremenu pokrenut drugi lab, prethodni se odbacuje
  if (pendingEnv) { const p = pendingEnv; pendingEnv = null; await p.remove(); }
  let env;
  try {
    env = pendingEnv = await createLabEnv(c.lab, { [LABEL]: LABEL_VALUE, "kurs.course": c.id });
    if (lab.setup) {
      const r = await execRun(env.primary, lab.setup, (c.lab.setupTimeout || 120) * 1000);
      if (r.code !== 0) {
        if (pendingEnv === env) pendingEnv = null;
        await env.remove();
        return res.status(500).json({ error: t(req.lang, "setupFailed"), out: r.out.slice(-4000) });
      }
    }
    if (pendingEnv !== env) return res.status(409).json({ error: t(req.lang, "otherLab") });
    pendingEnv = null;
    const id = crypto.randomUUID();
    sessions.set(id, { env, courseId: c.id, moduleId: req.params.mid, labId: lab.id, lang: req.lang });
    res.json({ session: id, user: env.user });
  } catch (e) {
    if (env) { if (pendingEnv === env) pendingEnv = null; await env.remove(); }
    const msg = String(e.message || e);
    const hint = /No such image/i.test(msg) ? t(req.lang, "noImage", { img: c.lab.image })
      : /connect|ENOENT|socket/i.test(msg) ? t(req.lang, "noDocker") : "";
    res.status(500).json({ error: hint || msg });
  }
});

// Sesije se adresiraju samo ID-jem; kurs je zapisan u sesiji
app.post("/api/lab/session/:sid/verify/:step", async (req, res) => {
  const s = sessions.get(req.params.sid);
  if (!s) return res.status(404).json({ error: t(langOf(req), "sessionGone") });
  const lab = findLab(getCourse(s.courseId, s.lang), s.moduleId, s.labId);
  const step = lab.steps[Number(req.params.step)];
  if (!step?.verify) return res.status(400).json({ error: t(s.lang, "noVerify") });
  const r = await execRun(s.env.primary, step.verify, 60000);
  const pass = r.code === 0;
  const progress = updateProgress(s.courseId, (p) => {
    const key = `${s.moduleId}/${s.labId}`;
    const entry = p.labs[key] || { steps: [] };
    if (pass) {
      if (!entry.steps.includes(step.index)) entry.steps.push(step.index);
      const needed = lab.steps.filter((x) => x.verify).map((x) => x.index);
      entry.done = needed.every((i) => entry.steps.includes(i));
    } else entry.fails = (entry.fails || 0) + 1;
    p.labs[key] = entry;
  });
  res.json({ pass, out: r.out.trim().slice(-3000), progress });
});

app.get("/api/lab/session/:sid/hint/:step", (req, res) => {
  const s = sessions.get(req.params.sid);
  const lab = s && findLab(getCourse(s.courseId, s.lang), s.moduleId, s.labId);
  const step = lab?.steps[Number(req.params.step)];
  if (step?.hint) updateProgress(s.courseId, (p) => {
    const key = `${s.moduleId}/${s.labId}`;
    const entry = p.labs[key] || { steps: [] };
    entry.hints = (entry.hints || 0) + 1;
    p.labs[key] = entry;
  });
  res.json({ hint: step?.hint || t(s?.lang || langOf(req), "noHint") });
});

app.post("/api/lab/session/:sid/stop", async (req, res) => {
  await stopSession(req.params.sid);
  res.json({ ok: true });
});

// ---------- terminal preko WebSocketa ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws/term" });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const s = sessions.get(url.searchParams.get("session"));
  if (!s) { ws.send("\r\n[sesija ne postoji]\r\n"); return ws.close(); }
  try {
    const exec = await s.env.primary.exec({
      Cmd: ["bash", "-l"], AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: true,
      Env: ["TERM=xterm-256color", "HOME=/root", "LANG=C.UTF-8", "KUBECONFIG=/root/.kube/config"], WorkingDir: "/root",
    });
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });
    stream.on("data", (d) => { if (ws.readyState === 1) ws.send(d); });
    stream.on("end", () => ws.close());
    ws.on("message", (msg) => {
      const text = msg.toString();
      if (text.startsWith("\u0000resize:")) {
        const [cols, rows] = text.slice(8).split("x").map(Number);
        if (cols > 0 && rows > 0) exec.resize({ w: cols, h: rows }).catch(() => {});
        return;
      }
      stream.write(text);
    });
    ws.on("close", () => stream.end());
  } catch (e) {
    ws.send(`\r\n[greška: ${e.message}]\r\n`);
    ws.close();
  }
});

async function shutdown() {
  await Promise.all([...sessions.keys()].map(stopSession));
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await cleanupOld();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  SecOps trening: ${byLang.sr.map((c) => c.title).join(", ")}\n  Otvori: http://localhost:${PORT}\n`);
});
