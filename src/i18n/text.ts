// Điền `{tên}` trong câu chữ. Thuần.

/** `fill('{n} cung', { n: 78 })` → "78 cung". Thiếu biến thì để nguyên `{tên}` — lỗi lộ ra mắt, không im lặng. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? String(vars[k]) : whole))
}
