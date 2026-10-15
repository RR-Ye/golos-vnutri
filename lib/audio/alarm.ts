"use client";

// Сигнал «Помогите»: три пары коротких тонов, сгенерированных на устройстве.
let ctx: AudioContext | null = null;

export async function playAlarm(times = 3): Promise<void> {
  ctx ??= new AudioContext();
  await ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  for (let i = 0; i < times; i++) {
    for (const [j, freq] of [880, 660].entries()) {
      const start = t0 + i * 0.9 + j * 0.3;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.27);
    }
  }
  await new Promise((r) => setTimeout(r, times * 900));
}
