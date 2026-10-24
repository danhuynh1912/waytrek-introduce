// Hàng gửi lưu một kế hoạch (spec/43 §9.2):
// - Một lượt bay tại một thời điểm; sửa trong lúc đang bay thì lượt sau mang
//   bản MỚI NHẤT, không gửi từng bản trung gian.
// - `baseVersion` lấy từ PHẢN HỒI của lượt trước — web không tự xung đột với
//   chính nó.
// - Xung đột / đã xoá / mất phiên / lỗi: dừng hàng, chờ người dùng hoặc
//   `retry()`; bản đang sửa không bao giờ bị bỏ.

import type { PlanDoc, PlanResult } from './types.ts'

export type SaveOutcome =
  | { kind: 'saved'; version: number; result: PlanResult }
  | { kind: 'conflict'; version: number; doc: PlanDoc; result: PlanResult | null }
  | { kind: 'deleted' }
  | { kind: 'auth' }
  | { kind: 'failed'; message: string }

export type SaveEvent =
  | { type: 'saving'; rev: number }
  /** `doc` là đúng bản đã gửi — kết quả thuộc về nó, không phải bản đang sửa. */
  | { type: 'saved'; rev: number; doc: PlanDoc; version: number; result: PlanResult }
  | { type: 'conflict'; rev: number; version: number; doc: PlanDoc; result: PlanResult | null }
  | { type: 'deleted' }
  | { type: 'auth' }
  | { type: 'failed'; rev: number; message: string }

export type SendFn = (doc: PlanDoc, baseVersion: number) => Promise<SaveOutcome>

export class SaveQueue {
  #send: SendFn
  #emit: (e: SaveEvent) => void
  #version: number
  #latest: { rev: number; doc: PlanDoc } | null = null
  #savedRev = -1
  #inflight = false
  #blocked = false

  constructor(send: SendFn, emit: (e: SaveEvent) => void, version: number) {
    this.#send = send
    this.#emit = emit
    this.#version = version
  }

  get version(): number {
    return this.#version
  }

  get busy(): boolean {
    return this.#inflight
  }

  /** Còn bản chưa lưu (kể cả đang bay). */
  get dirty(): boolean {
    return this.#latest != null && this.#latest.rev > this.#savedRev
  }

  submit(rev: number, doc: PlanDoc): void {
    if (this.#latest && rev < this.#latest.rev) return
    this.#latest = { rev, doc }
    void this.#pump()
  }

  /** Gửi lại sau lỗi mạng / sau khi đăng nhập lại. */
  retry(): void {
    this.#blocked = false
    void this.#pump()
  }

  /** "Giữ bản này": ghi đè lên bản máy chủ vừa thấy. */
  keepMine(serverVersion: number): void {
    this.#version = serverVersion
    this.retry()
  }

  /** "Dùng bản kia": bản máy chủ thành bản đang có, không gửi gì. */
  takeServer(serverVersion: number, rev: number): void {
    this.#version = serverVersion
    this.#latest = null
    this.#savedRev = Math.max(this.#savedRev, rev)
    this.#blocked = false
  }

  async #pump(): Promise<void> {
    if (this.#inflight || this.#blocked) return
    const job = this.#latest
    if (!job || job.rev <= this.#savedRev) return
    this.#inflight = true
    this.#emit({ type: 'saving', rev: job.rev })
    let out: SaveOutcome
    try {
      out = await this.#send(job.doc, this.#version)
    } catch (e) {
      out = { kind: 'failed', message: e instanceof Error ? e.message : String(e) }
    }
    this.#inflight = false
    switch (out.kind) {
      case 'saved':
        this.#version = out.version
        this.#savedRev = Math.max(this.#savedRev, job.rev)
        this.#emit({ type: 'saved', rev: job.rev, doc: job.doc, version: out.version, result: out.result })
        void this.#pump()
        return
      case 'conflict':
        this.#blocked = true
        this.#emit({ type: 'conflict', rev: job.rev, version: out.version, doc: out.doc, result: out.result })
        return
      case 'deleted':
        this.#blocked = true
        this.#emit({ type: 'deleted' })
        return
      case 'auth':
        this.#blocked = true
        this.#emit({ type: 'auth' })
        return
      case 'failed':
        this.#blocked = true
        this.#emit({ type: 'failed', rev: job.rev, message: out.message })
        return
    }
  }
}
