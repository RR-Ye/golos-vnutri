// Динамическое выравнивание по времени (DTW) с полосой Сакоэ–Чиба.
import type { Features } from "./mfcc.ts";

function frameDist(a: Features, i: number, b: Features, j: number): number {
  const d = a.dims;
  let s = 0;
  for (let k = 0; k < d; k++) {
    const x = a.data[i * d + k]! - b.data[j * d + k]!;
    s += x * x;
  }
  return Math.sqrt(s);
}

/**
 * Расстояние DTW, нормированное на длину пути. Полоса — доля длины, но не уже разницы длин.
 * Возвращает Infinity, если одно из высказываний пустое.
 */
export function dtwDistance(a: Features, b: Features, band = 0.25): number {
  const n = a.nFrames;
  const m = b.nFrames;
  if (!n || !m) return Infinity;
  const w = Math.max(Math.ceil(band * Math.max(n, m)), Math.abs(n - m) + 1);
  let prev = new Float64Array(m + 1).fill(Infinity);
  let prevLen = new Float64Array(m + 1);
  let cur = new Float64Array(m + 1);
  let curLen = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const center = Math.round((i * m) / n);
    const lo = Math.max(1, center - w);
    const hi = Math.min(m, center + w);
    for (let j = lo; j <= hi; j++) {
      const c = frameDist(a, i - 1, b, j - 1);
      // шаги: диагональ (вес 2), по горизонтали и вертикали (вес 1)
      const diag = prev[j - 1]! + 2 * c;
      const up = prev[j]! + c;
      const left = cur[j - 1]! + c;
      if (diag <= up && diag <= left) {
        cur[j] = diag;
        curLen[j] = prevLen[j - 1]! + 2;
      } else if (up <= left) {
        cur[j] = up;
        curLen[j] = prevLen[j]! + 1;
      } else {
        cur[j] = left;
        curLen[j] = curLen[j - 1]! + 1;
      }
    }
    [prev, cur] = [cur, prev];
    [prevLen, curLen] = [curLen, prevLen];
  }
  return prev[m]! / Math.max(1, prevLen[m]!);
}
