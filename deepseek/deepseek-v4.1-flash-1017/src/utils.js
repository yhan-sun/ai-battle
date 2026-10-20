/** 通用数学与格式化工具。 */

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 帧率无关的指数阻尼。lambda 越大越快接近目标。 */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function invLerp(a, b, value) {
  if (a === b) return 0;
  return clamp((value - a) / (b - a), 0, 1);
}

export function easeOutCubic(t) {
  const p = 1 - clamp(t, 0, 1);
  return 1 - p * p * p;
}

export function easeInOutQuad(t) {
  const p = clamp(t, 0, 1);
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function chance(probability) {
  return Math.random() < probability;
}

export function formatNumber(value) {
  const safe = Number.isFinite(value) ? Math.floor(value) : 0;
  return safe.toLocaleString('en-US');
}

export function formatDistance(meters) {
  const safe = Number.isFinite(meters) ? Math.floor(meters) : 0;
  return `${safe.toLocaleString('en-US')} m`;
}

export function formatSeconds(seconds) {
  return Math.max(0, seconds).toFixed(1);
}

/** 把 0..1 的进度映射到技能环上的 CSS 百分比。 */
export function toPercent(value, max = 1) {
  return `${clamp(value / max, 0, 1) * 100}%`;
}
