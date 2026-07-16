export const BREAKS = [
  { start: 11 * 60, end: 11 * 60 + 30 }, // 11:00 - 11:30 AM
  { start: 13 * 60, end: 14 * 60 }, // 1:00  - 2:00  PM
  { start: 16 * 60 + 30, end: 17 * 60 }, // 4:30  - 5:00  PM
];

export const WORK_START = 9 * 60; // 9:00 AM

export const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
};

export const skipBreaks = (pos: number): number => {
  let adjusted = pos;
  let changed = true;
  while (changed) {
    changed = false;
    for (const brk of BREAKS) {
      if (adjusted >= brk.start && adjusted < brk.end) {
        adjusted = brk.end;
        changed = true;
      }
    }
  }
  return adjusted;
};

export const splitIntoSegments = (
  cursorMinutes: number,
  durationMinutes: number,
): { start: number; end: number }[] => {
  const segments: { start: number; end: number }[] = [];
  let current = skipBreaks(cursorMinutes);
  let remaining = durationMinutes;

  while (remaining > 0) {
    const nextBreak = BREAKS.find(
      (b) => b.start > current && b.start <= current + remaining,
    );

    if (nextBreak) {
      segments.push({ start: current, end: nextBreak.start });
      remaining -= nextBreak.start - current;
      current = skipBreaks(nextBreak.end);
    } else {
      segments.push({ start: current, end: current + remaining });
      remaining = 0;
    }
  }

  return segments;
};

export const isValidDuration = (duration: string): boolean => {
  const num = parseFloat(duration);
  return !isNaN(num) && num >= 0.1;
};
