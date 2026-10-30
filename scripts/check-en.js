// Provjera engleskog prevoda u odnosu na srpski original.
//   node scripts/check-en.js                 svi kursevi (pokrivenost + greške)
//   node scripts/check-en.js 05-cks          jedan kurs
//   node scripts/check-en.js 05-cks --strict greška i za svaki fajl koji još nije preveden
//
// Pravila:
//   course.json: title_en, subtitle_en, exam.note_en (ako postoji note), name_en za domene čije ime nije na engleskom
//   module.json: title_en, summary_en
//   lesson.en.md: postoji i nije prazan
//   quiz.en.json: isti broj pitanja; isti type, answer, obj, broj opcija i targets kao original
//   labs/<lab>.en.md: isti broj koraka; setup i solution blokovi identični originalu;
//                     verify blok ima isti broj redova i isti kod (razlikuju se samo redovi sa echo porukama)
//   acronyms.en.json: isti akronimi, polja en i desc
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLab } from "../content.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.find((a) => !a.startsWith("--"));
const dirs = fs.readdirSync(path.join(ROOT, "courses")).filter((d) => fs.existsSync(path.join(ROOT, "courses", d, "content", "course.json"))).sort()
  .filter((d) => !only || d === only);

let errors = 0;
const fail = (m) => { errors++; console.log("  ✘ " + m); };
const BS_CHARS = /[čćšđžČĆŠĐŽ]/g;
// tekst sa mnogo naših slova vjerovatno nije preveden (imena i primjeri u kodu dozvoljavaju poneko)
const looksBosnian = (t) => ((String(t).match(BS_CHARS) || []).length / Math.max(1, String(t).length)) > 0.004;
const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const codeLines = (s) => s.split("\n").filter((l) => !/\becho\b|printf\b.*\\n|sys\.exit\(|raise \w+Error\(|print\(/.test(l));

const summary = [];
for (const d of dirs) {
  const cdir = path.join(ROOT, "courses", d, "content");
  const course = readJSON(path.join(cdir, "course.json"));
  console.log(`\n=== ${d}`);
  if (!course.title_en || !course.subtitle_en) (strict ? fail : (m) => console.log("  · " + m))("course.json: nema title_en/subtitle_en");
  if (course.exam?.note && !course.exam.note_en) (strict ? fail : (m) => console.log("  · " + m))("course.json: nema exam.note_en");
  for (const dm of course.exam?.domains || []) if (looksBosnian(dm.name) && !dm.name_en) fail(`course.json: domena ${dm.n} nema name_en`);
  let files = 0, done = 0;
  const mods = fs.readdirSync(cdir, { withFileTypes: true }).filter((x) => x.isDirectory() && fs.existsSync(path.join(cdir, x.name, "module.json"))).map((x) => x.name).sort();
  for (const m of mods) {
    const mdir = path.join(cdir, m);
    const meta = readJSON(path.join(mdir, "module.json"));
    files++; if (meta.title_en && meta.summary_en) done++; else if (strict) fail(`${m}: module.json nema title_en/summary_en`);
    if (fs.existsSync(path.join(mdir, "lesson.md"))) {
      files++;
      const f = path.join(mdir, "lesson.en.md");
      if (fs.existsSync(f)) {
        done++;
        const t = fs.readFileSync(f, "utf8");
        if (t.trim().length < 200) fail(`${m}: lesson.en.md je prazan ili prekratak`);
        else if (looksBosnian(t.replace(/```[\s\S]*?```/g, ""))) fail(`${m}: lesson.en.md izgleda neprevedeno (mnogo slova č/ć/š/đ/ž van koda)`);
      } else if (strict) fail(`${m}: nema lesson.en.md`);
    }
    if (fs.existsSync(path.join(mdir, "quiz.json"))) {
      files++;
      const f = path.join(mdir, "quiz.en.json");
      if (fs.existsSync(f)) {
        done++;
        let bs, en;
        try { bs = readJSON(path.join(mdir, "quiz.json")); en = readJSON(f); } catch (e) { fail(`${m}: quiz.en.json nije validan JSON: ${e.message}`); continue; }
        if (bs.length !== en.length) fail(`${m}: quiz.en.json ima ${en.length} pitanja, original ${bs.length}`);
        bs.forEach((q, i) => {
          const e = en[i]; if (!e) return;
          const n = `${m} pitanje ${i + 1}`;
          if ((q.type || null) !== (e.type || null)) fail(`${n}: type se razlikuje`);
          if (JSON.stringify(q.answer) !== JSON.stringify(e.answer)) fail(`${n}: answer se razlikuje`);
          if ((q.obj || null) !== (e.obj || null)) fail(`${n}: obj se razlikuje`);
          if (q.options && (!Array.isArray(e.options) || e.options.length !== q.options.length)) fail(`${n}: broj opcija se razlikuje`);
          if ((q.snippet || "").split("\n").length !== (e.snippet || "").split("\n").length) fail(`${n}: snippet ima drugi broj redova`);
          if (q.targets && (!Array.isArray(e.targets) || e.targets.length !== q.targets.length)) fail(`${n}: broj targets se razlikuje`);
          if (!e.q || !e.explain) fail(`${n}: prazno q ili explain`);
          else if (looksBosnian(e.q + " " + e.explain + " " + (e.options || []).join(" "))) fail(`${n}: izgleda neprevedeno`);
          if (q.lang !== e.lang) fail(`${n}: lang se razlikuje`);
        });
      } else if (strict) fail(`${m}: nema quiz.en.json`);
    }
    const ldir = path.join(mdir, "labs");
    if (fs.existsSync(ldir)) for (const lf of fs.readdirSync(ldir).filter((x) => x.endsWith(".md") && !x.endsWith(".en.md")).sort()) {
      files++;
      const ef = path.join(ldir, lf.replace(/\.md$/, ".en.md"));
      if (!fs.existsSync(ef)) { if (strict) fail(`${m}/${lf}: nema prevoda`); continue; }
      done++;
      const a = parseLab(fs.readFileSync(path.join(ldir, lf), "utf8"), lf);
      const b = parseLab(fs.readFileSync(ef, "utf8"), lf);
      const n = `${m}/${lf.replace(/\.md$/, ".en.md")}`;
      if (a.steps.length !== b.steps.length) { fail(`${n}: ${b.steps.length} koraka, original ${a.steps.length}`); continue; }
      if (a.setup !== b.setup) fail(`${n}: setup blok se razlikuje od originala`);
      if (a.minutes !== b.minutes) fail(`${n}: timer se razlikuje`);
      [b.intro, ...b.steps.map((s) => s.text)].forEach((t, i) => { if (/<!--|-->/.test(t)) fail(`${n}: nezatvoren ili prerano zatvoren komentar (dio ${i})`); });
      a.steps.forEach((s, i) => {
        const t = b.steps[i];
        if (s.solution !== t.solution) fail(`${n} korak ${i + 1}: solution se razlikuje od originala`);
        if (!!s.verify !== !!t.verify || !!s.hint !== !!t.hint) fail(`${n} korak ${i + 1}: verify/hint blokovi se ne poklapaju`);
        if (s.verify && t.verify) {
          if (s.verify.split("\n").length !== t.verify.split("\n").length) fail(`${n} korak ${i + 1}: verify ima drugi broj redova`);
          else if (JSON.stringify(codeLines(s.verify)) !== JSON.stringify(codeLines(t.verify))) fail(`${n} korak ${i + 1}: verify kod se razlikuje (mijenjati se smiju samo poruke)`);
        }
      });
      if (looksBosnian(b.title + " " + b.intro.replace(/```[\s\S]*?```/g, "") + " " + b.steps.map((s) => s.title + " " + s.text.replace(/```[\s\S]*?```/g, "")).join(" "))) fail(`${n}: tekst izgleda neprevedeno`);
    }
  }
  if (fs.existsSync(path.join(cdir, "acronyms.json"))) {
    files++;
    const f = path.join(cdir, "acronyms.en.json");
    if (fs.existsSync(f)) {
      done++;
      const a = readJSON(path.join(cdir, "acronyms.json")).map((x) => x.a);
      const b = readJSON(f);
      if (JSON.stringify(a) !== JSON.stringify(b.map((x) => x.a))) fail("acronyms.en.json: lista akronima se razlikuje");
      if (b.some((x) => !x.en || !x.desc)) fail("acronyms.en.json: svaki akronim treba en i desc");
    } else if (strict) fail("nema acronyms.en.json");
  }
  console.log(`  prevedeno ${done}/${files} fajlova`);
  summary.push([d, done, files]);
}
console.log("\nPokrivenost prevoda:");
for (const [d, a, b] of summary) console.log(`  ${d.padEnd(28)} ${String(a).padStart(4)}/${b}  ${b ? Math.round((a / b) * 100) : 0}%`);
console.log(errors ? `\n${errors} grešaka` : "\nSve provjere su prošle.");
process.exit(errors ? 1 : 0);
