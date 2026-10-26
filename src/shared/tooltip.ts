// Tooltip chung của mọi trang (chủ sản phẩm 26/10): rê chuột lên một nút, một
// điểm trên bản đồ… là hiện một dòng giải thích ngắn. Chữ nằm ở thuộc tính
// `data-tip` của chính phần tử (hoặc tổ tiên gần nhất có nó) — thêm nút mới chỉ
// cần thêm `data-tip`, không phải nối gì ở đây.
//
// Chỉ hiện với CHUỘT: màn cảm ứng không có "rê", một cú chạm mà bật tooltip là
// che đúng thứ vừa chạm. Bàn phím: hiện khi Tab tới (`:focus-visible`).
//
// Bản đồ vẽ trên canvas, không có phần tử để gắn `data-tip`: trang tự dò thứ
// nằm dưới con trỏ rồi gọi `showTipAt` / `hideTip` — cùng một ô, cùng nhịp.

/** Rê chuột lướt qua thì không bật — chỉ khi dừng lại trên nút. */
const SHOW_DELAY_MS = 300
/** Vừa tắt chưa tới chừng này mà sang nút khác: hiện ngay, trượt sang chỗ mới. */
const CHAIN_MS = 160
/** Khoảng từ nút tới ô chữ, và lề tối thiểu tới mép màn hình. */
const GAP_PX = 8
const EDGE_PX = 8

interface Anchor {
  top: number
  bottom: number
  left: number
  right: number
}

let tip: HTMLDivElement | null = null
/** Phần tử đang được giải thích (null: một điểm trên canvas, hoặc không có gì). */
let target: Element | null = null
/** Vừa bấm vào nút này: không bật lại cho tới khi con trỏ rời nó. */
let suppressed: Element | null = null
let described = false
let timer = 0
let shown = false
let hiddenAt = -Infinity
let lastPointer = ''

function ensureTip(): HTMLDivElement {
  if (tip) return tip
  tip = document.createElement('div')
  tip.id = 'wt-tip'
  tip.className = 'wt-tip'
  tip.setAttribute('role', 'tooltip')
  // Popover (lớp trên cùng): hộp thoại `showModal()` (đăng nhập, tìm đỉnh…)
  // nằm trên mọi z-index, ô chữ thường sẽ chui xuống dưới nó.
  if ('popover' in tip) tip.popover = 'manual'
  document.body.appendChild(tip)
  return tip
}

/** Hộp thoại modal mà ô chữ đã được đưa lên trên (lớp trên cùng xếp theo thứ tự mở). */
let stackedOver: Element | null = null

function raise(el: HTMLDivElement, forEl: Element | null): void {
  if (typeof el.showPopover !== 'function') return
  const modal = forEl?.closest('dialog') ?? null
  const above = modal != null && modal.matches(':modal') && modal !== stackedOver
  if (el.matches(':popover-open') && !above) return
  if (el.matches(':popover-open')) el.hidePopover()
  el.showPopover()
  if (above && modal) {
    stackedOver = modal
    // Mở lại hộp thoại là nó lại nằm trên ô chữ — lần sau phải đưa lên lại.
    modal.addEventListener('close', () => { if (stackedOver === modal) stackedOver = null }, { once: true })
  }
}

function place(el: HTMLDivElement, a: Anchor): void {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  // Trên nút là chỗ mặc định; sát mép trên thì lật xuống dưới.
  let top = a.top - GAP_PX - h
  const below = top < EDGE_PX
  if (below) top = Math.min(a.bottom + GAP_PX, vh - EDGE_PX - h)
  const left = Math.min(Math.max((a.left + a.right) / 2 - w / 2, EDGE_PX), Math.max(EDGE_PX, vw - EDGE_PX - w))
  // Đặt bằng `translate`, không bằng left/top: ô chữ luôn đứng ở (0, 0) nên bề
  // rộng đo ra là bề rộng thật của chữ — đặt `left` sát mép phải là trình duyệt
  // ép ô hẹp lại, chữ gãy thành ba bốn dòng.
  el.style.translate = `${Math.round(left)}px ${Math.round(top)}px`
  el.classList.toggle('is-below', below)
}

function release(): void {
  if (described && target) target.removeAttribute('aria-describedby')
  described = false
}

function reveal(text: string, anchor: Anchor, forEl: Element | null): void {
  const el = ensureTip()
  raise(el, forEl)
  // Đang hiện ở nút bên cạnh (rê thẳng từ nút này sang nút kia): trượt sang,
  // không nhảy cóc. Đã đi qua chỗ trống thì ô chữ vừa tắt — hiện lại tại chỗ
  // mới, khỏi trượt dài ngang màn hình.
  el.classList.toggle('is-moving', shown)
  if (forEl !== target) release()
  target = forEl
  el.textContent = text
  place(el, anchor)
  if (forEl && !forEl.hasAttribute('aria-describedby')) {
    forEl.setAttribute('aria-describedby', el.id)
    described = true
  }
  el.classList.add('is-on')
  shown = true
}

function schedule(run: () => void): void {
  window.clearTimeout(timer)
  if (shown || performance.now() - hiddenAt < CHAIN_MS) run()
  else timer = window.setTimeout(run, SHOW_DELAY_MS)
}

/** Tắt ô chữ (mờ dần — CSS lo phần chuyển động). */
export function hideTip(): void {
  window.clearTimeout(timer)
  release()
  target = null
  if (!shown) return
  shown = false
  hiddenAt = performance.now()
  tip?.classList.remove('is-on')
}

/**
 * Giải thích một thứ KHÔNG phải phần tử DOM (vẽ trên canvas bản đồ) nằm ở toạ
 * độ màn hình (clientX/clientY). Bỏ qua — và trả `false` — nếu lần chạm gần
 * nhất không phải chuột: chạm vào bản đồ trên điện thoại cũng sinh ra một
 * "mousemove" giả.
 */
export function showTipAt(clientX: number, clientY: number, text: string): boolean {
  if (lastPointer !== 'mouse') return false
  // Chừa chỗ cho cái chấm dưới con trỏ: ô chữ đứng hẳn phía trên nó.
  const anchor = { top: clientY - 10, bottom: clientY + 12, left: clientX, right: clientX }
  if (!(shown && target === null && tip?.textContent === text)) schedule(() => reveal(text, anchor, null))
  return true
}

/**
 * Tắt ô chữ do `showTipAt` bật. Để yên nếu nó đang (hay sắp) giải thích một
 * phần tử: con trỏ rời canvas sang một điểm DOM trên bản đồ thì sự kiện "rời
 * bản đồ" tới SAU khi ô chữ của điểm đó đã bật.
 */
export function hideTipAt(): void {
  if (target === null) hideTip()
}

function tipOf(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? (node.closest('[data-tip]') as HTMLElement | null) : null
}

function textOf(el: HTMLElement): string {
  return el.dataset.tip?.trim() ?? ''
}

let installed = false

/** Gắn MỘT lần ở `main.tsx` — phủ mọi trang. */
export function installTooltips(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const opts = { capture: true, passive: true } as const
  document.addEventListener('pointermove', (e) => { lastPointer = e.pointerType }, opts)
  document.addEventListener('pointerover', (e) => {
    lastPointer = e.pointerType
    if (e.pointerType !== 'mouse') return
    const el = tipOf(e.target)
    if (el !== suppressed) suppressed = null
    if (el === target || el === suppressed) return
    if (!el) {
      // Sang chỗ không có gì để giải thích — kể cả canvas bản đồ (trang tự bật
      // lại khi con trỏ tới một điểm trên đó).
      if (target) hideTip()
      return
    }
    const text = textOf(el)
    if (!text) return
    window.clearTimeout(timer)
    release()
    target = el
    schedule(() => {
      if (el.isConnected && target === el) reveal(text, el.getBoundingClientRect(), el)
    })
  }, opts)
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || !target) return
    // Từ nút vào chính phần con của nó: vẫn đang trên nút.
    if (e.relatedTarget instanceof Node && target.contains(e.relatedTarget)) return
    if (tipOf(e.relatedTarget) === null) hideTip()
  }, opts)
  document.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType
    suppressed = tipOf(e.target)
    hideTip()
  }, opts)
  document.addEventListener('focusin', (e) => {
    const el = tipOf(e.target)
    if (!el || !(e.target instanceof Element) || !e.target.matches(':focus-visible')) return
    const text = textOf(el)
    if (!text) return
    window.clearTimeout(timer)
    reveal(text, el.getBoundingClientRect(), el)
  })
  document.addEventListener('focusout', (e) => {
    if (target && e.target instanceof Node && target.contains(e.target)) hideTip()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip() }, true)
  window.addEventListener('scroll', hideTip, opts)
  window.addEventListener('resize', hideTip, { passive: true })
  window.addEventListener('blur', hideTip)
}
