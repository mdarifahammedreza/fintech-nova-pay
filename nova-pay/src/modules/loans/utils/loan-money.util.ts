const SCALE = 4;
const SCALE_FACTOR = 10_000n;

/** Parse `d{1,15}(.d{1,4})?` to fixed-4 minor units as bigint. */
export function parseAmountToBigInt4(amount: string): bigint {
  const trimmed = amount.trim();
  const [wholeRaw, fracRaw = ''] = trimmed.split('.');
  const whole = wholeRaw === '' ? '0' : wholeRaw;
  if (!/^\d+$/.test(whole)) {
    throw new Error('Invalid amount');
  }
  const frac = (fracRaw + '0000').slice(0, SCALE);
  if (fracRaw.length > SCALE || !/^\d*$/.test(fracRaw)) {
    throw new Error('Invalid amount fractional part');
  }
  return BigInt(whole) * SCALE_FACTOR + BigInt(frac || '0');
}

export function formatBigIntAmount4(value: bigint): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const whole = v / SCALE_FACTOR;
  const frac = (v % SCALE_FACTOR).toString().padStart(SCALE, '0');
  const s = `${whole}.${frac}`;
  return neg ? `-${s}` : s;
}

export function amountGte4(a: string, b: string): boolean {
  return parseAmountToBigInt4(a) >= parseAmountToBigInt4(b);
}

export function subtractAmount4(from: string, delta: string): string {
  const out = parseAmountToBigInt4(from) - parseAmountToBigInt4(delta);
  if (out < 0n) {
    throw new Error('Negative outstanding');
  }
  return formatBigIntAmount4(out);
}
