// Provjera sadržaja svih kurseva (ili jednog).
//   node scripts/check-content.js                         struktura pitanja i labova svih kurseva
//   node scripts/check-content.js 02-security-plus        samo jedan kurs
//   node scripts/check-content.js --labs                  uz to pokreni svaki lab u Dockeru:
//                                                         provjera mora pasti prije rješenja i proći poslije
//   node scripts/check-content.js 02-security-plus --labs 08-operacije-kontrole-i-monitoring/01-firewall-nftables
//   node scripts/check-content.js 02-security-plus --file courses/02-security-plus/content/.../labs/x.md
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCourses, qType, parseLab } from "../content.js";
import { createLabEnv, cleanupLabels } from "../labenv.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fileArg = args.indexOf("--file");
const runLabs = args.includes("--labs") || fileArg >= 0;
const positional = args.filter((a, i) => !a.startsWith("--") && (fileArg < 0 || i !== fileArg + 1));
const all = loadCourses(ROOT);
const courseFilter = positional.find((a) => all.some((c) => c.id === a));
const labFilter = positional.find((a) => a !== courseFilter);
const courses = all.filter((c) => !courseFilter || c.id === courseFilter);

let errors = 0;
const fail = (msg) => { errors++; console.log("  ✘ " + msg); };

for (const c of courses) {
  console.log(`\n=== ${c.id}: ${c.title}`);
  if (!c.lab?.image) fail("course.json nema lab.image");
  if (!c.exam?.size || !c.exam?.minutes) fail("course.json nema exam.size/exam.minutes");
  const strict = (c.objectives || []).length > 0; // kursevi sa ciljevima ispita traže obj na svakom pitanju
  for (const m of c.modules) {
    console.log(`${m.id}: ${m.quiz.length} pitanja, ${m.labs.length} labova`);
    if (m.error) { fail(`neispravan modul: ${m.error}`); continue; }
    if (!m.lesson) fail("nema lesson.md");
    if (!m.title || !m.summary) fail("module.json nema title/summary");
    // "practice" moduli (probni ispit) nemaju domen ni kviz
    if (strict && !m.practice && (!m.domain || !Array.isArray(m.objectives) || !m.objectives.length)) fail("module.json nema domain/objectives");
    m.quiz.forEach((q, i) => {
      const t = qType(q);
      const n = `pitanje ${i + 1}`;
      if (q.snippet !== undefined && (typeof q.snippet !== "string" || !q.snippet.trim())) fail(`${n}: snippet mora biti neprazan string`);
      if (t === "spot") {
        const lines = typeof q.snippet === "string" ? q.snippet.split("\n").length : 0;
        if (!q.q || lines < 3) { fail(`${n}: spot treba q i snippet od bar 3 reda`); return; }
        if (!q.explain) fail(`${n}: nema objašnjenja`);
        const ok = Array.isArray(q.answer) && q.answer.length >= 1 && new Set(q.answer).size === q.answer.length && q.answer.every((a) => Number.isInteger(a) && a >= 0 && a < lines);
        if (!ok) fail(`${n}: spot answer mora biti niz različitih indeksa redova snippeta (0..${lines - 1})`);
        if (strict) {
          if (!q.obj || !/^[1-9]\.[0-9]+$/.test(q.obj)) fail(`${n}: nema ispravno polje obj`);
          else if (!m.objectives.includes(q.obj)) fail(`${n}: obj ${q.obj} nije među ciljevima modula`);
        }
        return;
      }
      if (!q.q || !Array.isArray(q.options) || q.options.length < 2) { fail(`${n}: neispravna struktura`); return; }
      if (!q.explain) fail(`${n}: nema objašnjenja`);
      if (strict) {
        if (!q.obj || !/^[1-9]\.[0-9]+$/.test(q.obj)) fail(`${n}: nema ispravno polje obj`);
        else if (!m.objectives.includes(q.obj)) fail(`${n}: obj ${q.obj} nije među ciljevima modula`);
      }
      const idx = (a, max) => Number.isInteger(a) && a >= 0 && a < max;
      if (t === "single") { if (!idx(q.answer, q.options.length)) fail(`${n}: odgovor van opsega`); }
      else if (t === "multi") { if (!Array.isArray(q.answer) || q.answer.length < 2 || !q.answer.every((a) => idx(a, q.options.length))) fail(`${n}: multi odgovor neispravan`); }
      else if (t === "order") {
        const ok = Array.isArray(q.answer) && q.answer.length === q.options.length && new Set(q.answer).size === q.answer.length && q.answer.every((a) => idx(a, q.options.length));
        if (!ok) fail(`${n}: order odgovor mora biti permutacija indeksa opcija`);
        else if (q.answer.every((a, j) => a === j)) fail(`${n}: order opcije su već poredane ispravno`);
      } else if (t === "match") {
        if (!Array.isArray(q.targets) || q.targets.length < 2) fail(`${n}: match nema targets`);
        else if (!Array.isArray(q.answer) || q.answer.length !== q.options.length || !q.answer.every((a) => idx(a, q.targets.length))) fail(`${n}: match odgovor neispravan`);
      } else fail(`${n}: nepoznat tip ${t}`);
    });
    for (const lab of m.labs) {
      if (!lab.steps.length) fail(`${lab.id}: nema koraka`);
      // "-->" unutar skripte prerano zatvara komentar, pa ostatak skripte procuri u tekst
      [lab.intro, ...lab.steps.map((s) => s.text)].forEach((t, i) => { if (/<!--|-->/.test(t)) fail(`${lab.id}: nezatvoren ili prerano zatvoren komentar (dio ${i})`); });
      lab.steps.forEach((s) => { if (s.verify && !s.solution) fail(`${lab.id} korak ${s.index + 1}: verify bez solution`); });
    }
  }
}

function sh(container, script, timeout = 600000) {
  const r = spawnSync("docker", ["exec", "-w", "/root", "-e", "HOME=/root", "-e", "KUBECONFIG=/root/.kube/config", container, "bash", "-c", script], { encoding: "utf8", timeout });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

if (runLabs) {
  await cleanupLabels("kurs.app=secops-check");
  for (const c of courses) {
    const targets = fileArg >= 0
      ? [{ id: "file", labs: [parseLab(fs.readFileSync(args[fileArg + 1], "utf8"), path.basename(args[fileArg + 1], ".md"))] }]
      : c.modules;
    for (const m of targets) {
      for (const lab of m.labs) {
        const key = `${m.id}/${lab.id}`;
        if (labFilter && key !== labFilter && m.id !== labFilter) continue;
        console.log(`\n▶ ${c.id} · ${key}`);
        const env = await createLabEnv(c.lab, { "kurs.app": "secops-check" });
        const name = env.primary.id;
        try {
          if (lab.setup) {
            const r = sh(name, lab.setup, (c.lab.setupTimeout || 240) * 1000);
            if (r.code !== 0) { fail(`setup pao:\n${r.out}`); continue; }
          }
          for (const s of lab.steps) {
            if (!s.verify) { if (s.solution) sh(name, s.solution); continue; }
            const before = sh(name, s.verify);
            if (before.code === 0) fail(`korak ${s.index + 1} (${s.title}): provjera prolazi i BEZ rješenja`);
            const sol = sh(name, s.solution);
            if (sol.code !== 0) fail(`korak ${s.index + 1}: rješenje palo:\n${sol.out}`);
            const after = sh(name, s.verify);
            if (after.code !== 0) fail(`korak ${s.index + 1} (${s.title}): provjera pada POSLIJE rješenja:\n${after.out}`);
            else console.log(`  ✔ korak ${s.index + 1}: ${s.title}`);
          }
        } finally {
          await env.remove();
        }
      }
    }
  }
}

console.log(errors ? `\n${errors} grešaka` : "\nSve provjere su prošle.");
process.exit(errors ? 1 : 0);
