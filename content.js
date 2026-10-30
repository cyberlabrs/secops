// Učitava sadržaj kursa iz foldera content/.
// Svaki modul je folder NN-ime/ sa fajlovima:
//   module.json  { title, summary, minutes }
//   lesson.md    lekcija u markdownu
//   quiz.json    [{ q, options: [...], answer: idx | [idx...], explain }]
//   labs/*.md    labovi (format opisan u parseLab)
import fs from "node:fs";
import path from "node:path";

const COMMENT_BLOCK = /<!--\s*(setup|verify|hint|solution|timer)\s*\n([\s\S]*?)-->/g;

// Format laba:
//   # Naslov
//   uvodni tekst
//   <!-- setup
//   bash skripta koja priprema kontejner
//   -->
//   ## Korak: naslov koraka
//   tekst koraka
//   <!-- verify
//   bash skripta; exit 0 znači da je korak riješen
//   -->
//   <!-- hint
//   savjet koji se prikazuje na zahtjev
//   -->
//   <!-- solution
//   rješenje koraka; koristi ga samo `npm run check` za automatski test laba
//   -->
//   <!-- timer
//   120
//   -->  (opcionalno, u uvodu: odbrojavanje u minutama, npr. za probni ispit)
export function parseLab(src, id) {
  const lines = src.replace(/\r\n/g, "\n");
  const titleMatch = lines.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : id;
  const parts = lines.split(/^##\s+/m);
  const head = parts.shift().replace(/^#\s+.+$/m, "");
  const pick = (text, kind) => {
    const out = [];
    text.replace(COMMENT_BLOCK, (_, k, body) => { if (k === kind) out.push(body.trim()); return ""; });
    return out.join("\n");
  };
  const strip = (text) => text.replace(COMMENT_BLOCK, "").trim();
  const steps = parts.map((p, i) => {
    const nl = p.indexOf("\n");
    const stepTitle = (nl === -1 ? p : p.slice(0, nl)).trim();
    const body = nl === -1 ? "" : p.slice(nl + 1);
    return { index: i, title: stepTitle, text: strip(body), verify: pick(body, "verify"), hint: pick(body, "hint"), solution: pick(body, "solution") };
  });
  return { id, title, intro: strip(head), setup: pick(head, "setup"), minutes: Number(pick(head, "timer")) || null, steps };
}

// Jezici: sr (izvorni, srpski) i en. Engleski sadržaj je u paralelnim fajlovima (lesson.en.md, quiz.en.json,
// labs/<lab>.en.md, acronyms.en.json) i u poljima *_en u course.json i module.json. Ako prevoda nema,
// koristi se srpski original.
export const LANGS = ["sr", "en"];

function localizeCourse(course, lang) {
  if (lang !== "en") return course;
  const c = structuredClone(course);
  for (const k of ["title", "subtitle"]) if (c[`${k}_en`]) c[k] = c[`${k}_en`];
  if (c.exam) {
    if (c.exam.note_en) c.exam.note = c.exam.note_en;
    (c.exam.domains || []).forEach((d) => { if (d.name_en) d.name = d.name_en; });
  }
  (c.objectives || []).forEach((o) => { if (o.en) o.bs = o.en; });
  const src = Array.isArray(c.sources) ? c.sources : c.sources?.items || [];
  src.forEach((s) => { if (s.title_en) s.title = s.title_en; if (s.name_en) s.name = s.name_en; if (s.note_en) s.note = s.note_en; });
  if (c.sources && !Array.isArray(c.sources) && c.sources.checked_en) c.sources.checked = c.sources.checked_en;
  return c;
}

export function loadCourse(root, lang = "sr") {
  const dir = path.join(root, "content");
  const course = localizeCourse(JSON.parse(fs.readFileSync(path.join(dir, "course.json"), "utf8")), lang);
  const modules = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(dir, name, "module.json")))
    .sort()
    .map((name) => {
      const mdir = path.join(dir, name);
      const read = (f, fallback) => (fs.existsSync(path.join(mdir, f)) ? fs.readFileSync(path.join(mdir, f), "utf8") : fallback);
      // lokalizovani fajl ako postoji (npr. lesson.en.md), inače original
      const readL = (f, fallback) => {
        if (lang === "en") { const lf = f.replace(/\.(md|json)$/, ".en.$1"); if (fs.existsSync(path.join(mdir, lf))) return read(lf); }
        return read(f, fallback);
      };
      try {
        const meta = JSON.parse(read("module.json"));
        if (lang === "en") { if (meta.title_en) meta.title = meta.title_en; if (meta.summary_en) meta.summary = meta.summary_en; }
        const lesson = readL("lesson.md", "");
        const quiz = JSON.parse(readL("quiz.json", "[]"));
        const labDir = path.join(mdir, "labs");
        const labs = fs.existsSync(labDir)
          ? fs.readdirSync(labDir).filter((f) => f.endsWith(".md") && !f.endsWith(".en.md")).sort()
              .map((f) => {
                const enf = f.replace(/\.md$/, ".en.md");
                const src = lang === "en" && fs.existsSync(path.join(labDir, enf)) ? enf : f;
                return parseLab(fs.readFileSync(path.join(labDir, src), "utf8"), f.replace(/\.md$/, ""));
              })
          : [];
        return { id: name, ...meta, lesson, quiz, labs };
      } catch (e) {
        // modul u izradi ili neispravan JSON: ne ruši cijeli kurs
        return { id: name, title: name, summary: "", lesson: "", quiz: [], labs: [], error: e.message };
      }
    });
  const acrEn = path.join(dir, "acronyms.en.json");
  const acrFile = lang === "en" && fs.existsSync(acrEn) ? acrEn : path.join(dir, "acronyms.json");
  const acronyms = fs.existsSync(acrFile) ? JSON.parse(fs.readFileSync(acrFile, "utf8")) : [];
  return { ...course, modules, acronyms };
}

// Tipovi pitanja:
//   single  answer: idx
//   multi   answer: [idx...]            (redoslijed nebitan)
//   order   answer: [idx...]            (redoslijed bitan)
//   match   answer: [targetIdx po opciji]
//   spot    answer: [idx reda...]       ("nađi problem": klik na redove u q.snippet; redoslijed nebitan)
// Svako pitanje može imati snippet (isječak loga, konfiguracije ili koda) i lang (yaml, json, log, kql, bash…).
export function qType(q) {
  if (q.type) return q.type;
  return Array.isArray(q.answer) ? "multi" : "single";
}

export function isCorrect(question, choice) {
  const t = qType(question);
  if (choice === null || choice === undefined) return false;
  if (t === "order" || t === "match") {
    const want = question.answer;
    return Array.isArray(choice) && choice.length === want.length && want.every((v, i) => Number(choice[i]) === v);
  }
  // single, multi i spot: skup izabranih indeksa mora biti isti
  const want = Array.isArray(question.answer) ? [...question.answer].sort((a, b) => a - b) : [question.answer];
  const got = (Array.isArray(choice) ? [...choice] : [choice]).map(Number).sort((a, b) => a - b);
  return want.length === got.length && want.every((v, i) => v === got[i]);
}

// Svi kursevi iz courses/<id>/content; redoslijed po polju "order" u course.json.
export function loadCourses(root, lang = "sr") {
  const dir = path.join(root, "courses");
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "content", "course.json")))
    .map((d) => ({ id: d.name, dir: path.join(dir, d.name), ...loadCourse(path.join(dir, d.name), lang) }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
