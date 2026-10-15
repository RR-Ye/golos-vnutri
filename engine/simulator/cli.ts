// npm run sim — метрики симулятора на демо-данных.
import { demoEntities, demoNotes, demoRoutine, demoWords } from "../demo/index.ts";
import type { Candidate } from "../inference/types.ts";
import { MATCHED, MISMATCH, SPEC, runBatch, runLearning, type SimSummary } from "./index.ts";

const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.slice(7) ?? 1000);
const seed = Number(process.argv.find((a) => a.startsWith("--seed="))?.slice(7) ?? 42);
const base = { entities: demoEntities(), words: demoWords(), notes: demoNotes(new Date(2026, 9, 15, 0, 0).getTime()), routine: demoRoutine() };

function show(title: string, s: SimSummary) {
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
  console.log(`\n${title} (${s.runs} прогонов)`);
  console.log(`  правильная фраза:        ${pct(s.correctRate)}`);
  console.log(`  шагов в среднем:         ${s.meanSteps.toFixed(2)} (у правильных ${s.meanStepsCorrect.toFixed(2)})`);
  console.log(`  90-й перцентиль / макс.: ${s.p90Steps} / ${s.maxSteps}`);
  console.log(`  вопросов в среднем:      ${s.meanQuestions.toFixed(2)}`);
  console.log(`  дошло до картинок:       ${pct(s.gridRate)}`);
  console.log(`  начинала заново:         ${pct(s.restartRate)}`);
  console.log(`  самые длинные: ${s.worst.map((w) => `${w.target} (${w.steps})`).join("; ")}`);
}

const spec = runBatch(base, { runs, seed: seed + 3, profile: SPEC, flatten: 0 });
show("Режим ТЗ: шумные ответы (10 %) и повторы слов, нажатия точные", spec);
const matched = runBatch(base, { runs, seed, profile: MATCHED, flatten: 0 });
show("Согласованный режим: плюс промахи мимо плиток (6–8 %)", matched);
const mismatch = runBatch(base, { runs, seed: seed + 1, profile: MISMATCH, flatten: 0.3 });
show("Режим с расхождением: больше ошибок, чем ждёт движок, мысли не по априору", mismatch);

// Привычки привязаны ко времени суток: утром лекарство, днём звонок дочери, вечером поясница, ночью «поверните».
const habits: { hour: number; candidate: Candidate }[] = [
  { hour: 8, candidate: { frame: "med.give", slots: { med: "md.morning" } } },
  { hour: 13, candidate: { frame: "people.call", slots: { person: "p.aliya" } } },
  { hour: 19, candidate: { frame: "health.pain", slots: { body: "body.lowback", severity: "sev.2" } } },
  { hour: 23, candidate: { frame: "need.turn", slots: {} } },
  { hour: 23, candidate: { frame: "need.toilet", slots: {} } },
];
const learning = runLearning(base, { weeks: 6, perDay: 8, seed: seed + 2, profile: MATCHED, habits });
console.log("\nОбучение на истории (привычные просьбы по времени суток — 70 % разговоров, 8 разговоров в день)");
for (const w of learning) {
  console.log(`  неделя ${w.week}: шагов ${w.meanSteps.toFixed(2)}, привычные ${w.typicalSteps.toFixed(2)}, правильно ${(w.correctRate * 100).toFixed(0)} %`);
}

const verdict = (s: SimSummary) => (s.meanSteps <= 5 && s.correctRate >= 0.9 ? "достигнута" : "НЕ достигнута");
console.log("\nЦель ТЗ: ≤ 5 шагов в среднем и ≥ 90 % правильных фраз");
console.log(`  режим ТЗ:            ${verdict(spec)}`);
console.log(`  согласованный:       ${verdict(matched)}`);
console.log(`  с расхождением:      ${verdict(mismatch)}`);
process.exitCode = spec.meanSteps <= 5 && spec.correctRate >= 0.9 ? 0 : 1;
