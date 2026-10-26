import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  appendWaypoint,
  chooseRest,
  dismissAutoStop,
  endsAtStart,
  freshWaypointId,
  keepAutoStop,
  makeWaypoint,
  MAX_WAYPOINTS,
  moveToDay,
  moveWaypoint,
  nextPointName,
  patchSettings,
  prependStart,
  pushAutoToNextDay,
  pushToNextDay,
  relocateWaypoint,
  removeWaypoint,
  reorderWaypoints,
  returnToStart,
  setArriveAt,
  setAutoTime,
  setDepartAt,
  clearArrivalsAfter,
  suggestReadiness,
  toggleRest,
  updateWaypoint,
} from '../../core/doc'
import { dayEditSupported, departAtSupported, MAX_AUTO_TIMES, restToggleAllowed } from '../../core/doc'
import type { SettingsPatch } from '../../core/doc'
import { progress } from '../../core/checklist'
import { clock } from '@/shared/format'
import { decodePolyline } from '../../core/polyline'
import { pointAlong } from '../../core/profile'
import { dayLayout } from '../../core/days'
import { buildTimeline, drawLines, isRestSuggestion } from '../../core/timeline'
import type { PlanDoc, PlanResult, ResultStop, TrailPin, Waypoint } from '../../core/types'
import { addedStrain, lateArrivalOf } from '../../core/warnings'
import { fetchRoutesInBbox, fetchSnap, fetchStartTrailhead } from '../../data/api'
import type { Bbox } from '../../data/api'
import type { AuthRequest } from '@/shared/AuthDialog'
import { IFit, ILocate, IMinus, IPlus, IReturn, ITent } from '../icons'
import type { LatLng, LayerKey, MapAuto, MapWaypoint, PlanMapHandlers, Snapped } from '../map/plan-map'
import { navigate, replaceSilently } from '../route'
import { Checklist } from './Checklist'
import { MapView } from './MapView'
import type { MapApi } from './MapView'
import { Panel } from './Panel'
import type { PanelTab } from './Panel'
import { PathTab } from './PathTab'
import { StatsBar } from './StatsBar'
import { SearchDialog } from './SearchDialog'
import type { SearchPick } from './SearchDialog'
import { StartPeakDialog } from './StartPeakDialog'
import type { StartPeakAsk } from './StartPeakDialog'
import { StrainDialog } from './StrainDialog'
import { LateArrivalDialog } from './LateArrivalDialog'
import { SuggestPanel } from './SuggestPanel'
import { Timeline } from './Timeline'
import type { TimelineActions } from './Timeline'
import { Toolbar } from './Toolbar'
import { useCatalog } from './use-catalog'
import { CoachMark } from './CoachMark'
import { useGuide } from './use-guide'
import { usePlanEditor } from './use-plan-editor'

const REASON_TEXT: Record<string, string> = {
  full: `Mỗi kế hoạch tối đa ${MAX_WAYPOINTS} điểm.`,
  outside: 'Chỉ đặt được điểm trong Việt Nam.',
  missing: 'Điểm này không còn trong kế hoạch.',
  timesFull: `Mỗi kế hoạch đặt giờ được ở tối đa ${MAX_AUTO_TIMES} điểm máy chọn — bỏ bớt giờ ở vài điểm rồi đặt lại.`,
}

/** Lộ trình các cung chỉ tải khi đã phóng gần — máy chủ từ chối khung rộng hơn 3°. */
const ROUTES_MIN_ZOOM = 9
const rid = () => Math.random().toString(36).slice(2, 7)
/** Lối đi gần hơn chừng này thì để nguyên chỗ chấm — dời vài mét chỉ làm điểm nhảy. */
const SNAP_MIN_M = 15

function fitPadding() {
  const narrow = window.innerWidth < 760
  return narrow
    ? { top: 70, right: 30, bottom: Math.round(window.innerHeight * 0.42), left: 30 }
    : { top: 76, right: 76, bottom: 176, left: 420 }
}

/** Nút kèm thông báo nhanh; `tip` là câu giải thích khi rê chuột (tooltip chung). */
interface ToastAction {
  label: string
  tip?: string
  run(): void
}

export function PlanEditorScreen({
  routeId,
  session,
  dark,
  requestLogin,
}: {
  routeId: string | null
  session: Session | null
  dark: boolean
  requestLogin: (r: AuthRequest) => void
}) {
  const ed = usePlanEditor({ routeId, session, onSaved: (id) => replaceSilently(`/plan/${id}`) })
  const { trails, pois, combos, error: catalogError, retry: retryCatalog } = useCatalog()
  const mapApi = useRef<MapApi | null>(null)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ rests: true, routes: true, pois: true, peaks: true, terrain: true })
  const [tab, setTab] = useState<PanelTab>('path')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<{ text: string; action?: ToastAction } | null>(null)
  const [startAsk, setStartAsk] = useState<StartPeakAsk | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  /** "Thay thế bằng…" của một điểm ở tab Waypoints: hộp tìm chỉ chọn một mục. */
  const [replaceFor, setReplaceFor] = useState<{ id: string; name: string; lat: number; lng: number } | null>(null)
  // Vừa kéo một điểm sang chỗ / ngày khác: chờ kết quả của đúng bản đó rồi so
  // với lịch trước khi kéo — nặng thêm thì hỏi lại (chủ sản phẩm 26/10).
  const [strainCheck, setStrainCheck] = useState<{ doc: PlanDoc; before: PlanResult | null } | null>(null)
  // Vừa đặt giờ có mặt ở một điểm: chờ kết quả của đúng bản đó — tới sau giờ
  // an toàn mà phải đi bộ trong tối thì hỏi "Đồng ý / Dời sang ngày sau".
  const [lateCheck, setLateCheck] = useState<
    { doc: PlanDoc; target: { kind: 'wp'; id: string } | { kind: 'auto'; key: string } } | null
  >(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guide = useGuide()
  // Hướng dẫn hiện ở cùng khoảng trên cùng với thông báo nhanh, và thường nói
  // cùng một ý — đang có hướng dẫn thì không vẽ thông báo.
  const shownToast = guide.current ? null : toast

  // Thông báo nhanh; có `action` thì kèm một nút (đứng lâu hơn để kịp bấm).
  const say = useCallback((text: string, action?: ToastAction) => {
    setToast({ text, action })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), action ? 8000 : 3500)
  }, [])

  const { edit } = ed
  const apply = useCallback(
    (fn: (doc: PlanDoc) => ReturnType<typeof appendWaypoint> | PlanDoc) => {
      const reason = edit(fn)
      if (reason) say(REASON_TEXT[reason] ?? reason)
      return reason == null
    },
    [edit, say],
  )

  const trailsById = useMemo(() => new Map(trails.map((t) => [t.trailId, t])), [trails])
  const timeline = useMemo(() => buildTimeline(ed.doc, ed.result, ed.resultDoc), [ed.doc, ed.result, ed.resultDoc])
  // Có chỗ nghỉ máy chủ gợi ý thì mới có nút ẩn / hiện — tính trên MỌI dòng, kể
  // cả khi đang ẩn, để bấm hiện lại được.
  const hasRestSuggestions = timeline.rows.some((r) => r.type === 'auto' && isRestSuggestion(r.stop))
  // Hậu quả của lần kéo vừa rồi — chỉ khi kết quả là của ĐÚNG bản vừa kéo và
  // chưa sửa gì thêm (sửa tiếp rồi thì "Hoàn tác" không còn hoàn tác lần kéo).
  const late = useMemo(() => {
    const c = lateCheck
    if (!c || ed.doc !== c.doc || ed.resultDoc !== c.doc || !ed.result) return null
    const t = c.target
    const hit = lateArrivalOf(ed.result, (st) => (t.kind === 'wp' ? st.id === t.id : st.timeKey === t.key))
    return hit && hit.stop.targetMin != null && hit.day.limitMin != null
      ? { name: hit.stop.name, targetMin: hit.stop.targetMin, limitMin: hit.day.limitMin, stop: hit.stop }
      : null
  }, [lateCheck, ed.doc, ed.resultDoc, ed.result])
  const strain = useMemo(
    () =>
      strainCheck && ed.doc === strainCheck.doc && ed.resultDoc === strainCheck.doc && ed.result
        ? addedStrain(strainCheck.before, ed.result)
        : null,
    [strainCheck, ed.doc, ed.resultDoc, ed.result],
  )
  const draw = useMemo(() => drawLines(ed.doc, ed.result, ed.resultDoc), [ed.doc, ed.result, ed.resultDoc])

  const waypoints: MapWaypoint[] = useMemo(
    () =>
      ed.doc.waypoints.map((w, i, all) => ({
        id: w.id,
        lat: w.latE6 / 1e6,
        lng: w.lonE6 / 1e6,
        label: String(i + 1),
        name: w.name,
        rest: w.rest && i > 0 && i < all.length - 1,
        peak: w.kind === 'peak',
        restToggle: restToggleAllowed(w, i, all.length),
      })),
    [ed.doc.waypoints],
  )
  const autos: MapAuto[] = useMemo(
    () =>
      draw.autos.map(({ stop }) => ({
        id: stop.id,
        lat: stop.latE6 / 1e6,
        lng: stop.lonE6 / 1e6,
        name: stop.name,
        suggestion: isRestSuggestion(stop),
        zoneLine: stop.zone?.line,
        ...(stop.trailhead || stop.transfer || stop.pickup
          ? {
            info: {
              sub: [
                // Giờ RỜI điểm: có giờ xuất phát đặt ở đó thì đi bộ / lên xe lúc ấy.
                stop.trailhead ? `Đi bộ từ ${clock(stop.departMin ?? stop.etaMin)}` : null,
                stop.pickup ? `Lên xe lúc ${clock(stop.departMin ?? stop.etaMin)}` : null,
                stop.transfer ? 'Tới sau chuyến xe từ tối hôm trước' : null,
              ].filter(Boolean).join(' · '),
              icon: stop.trailhead ? 'walk' as const : stop.pickup ? 'car' as const : 'tent' as const,
            },
          }
          : {}),
      })),
    [draw.autos],
  )

  // ─── Sửa kế hoạch ───────────────────────────────────────────────────────
  /**
   * Điểm chấm tay không nằm trên lộ trình WayTrek: hỏi máy chủ lối đi (đường /
   * lối mòn OSM) gần nhất, rồi dời điểm ra đó — chấm giữa rừng thì không có
   * đường thật nào tới. Điểm hiện ngay ở chỗ chấm; chỉ dời nếu người dùng chưa
   * kéo nó đi chỗ khác trong lúc chờ.
   */
  const snapToPath = useCallback(
    (id: string, at: LatLng) => {
      fetchSnap(at)
        .then((s) => {
          if (!s || s.distM < SNAP_MIN_M) return
          const e6 = (x: number) => Math.round(x * 1e6)
          const moved = apply((doc) => {
            const w = doc.waypoints.find((x) => x.id === id)
            if (!w || w.latE6 !== e6(at.lat) || w.lonE6 !== e6(at.lng)) return doc
            return relocateWaypoint(doc, id, { lat: s.lat, lon: s.lng, kind: 'custom' })
          })
          if (moved) say(`Đã dời điểm ra lối đi gần nhất (cách chỗ chấm ${Math.round(s.distM)} m).`)
        })
        .catch((e) => console.warn('plan: tìm lối đi gần nhất lỗi —', e))
    },
    [apply, say],
  )

  const addPoint = useCallback(
    (at: LatLng, snapped: Snapped | null) => {
      let id: string | null = null
      const ok = apply((doc) => {
        id = freshWaypointId(doc, rid)
        return appendWaypoint(
          doc,
          makeWaypoint({
            id,
            kind: snapped ? 'route' : 'custom',
            ref: snapped?.trailId,
            lat: snapped?.lat ?? at.lat,
            lon: snapped?.lng ?? at.lng,
            name: nextPointName(doc),
          }),
        )
      })
      if (ok && !snapped && id) snapToPath(id, at)
    },
    [apply, snapToPath],
  )

  /**
   * Thêm một hoặc nhiều đỉnh / địa điểm (hộp Tìm chọn nhiều, combo) trong MỘT
   * lượt sửa — hoàn tác một lần là bỏ cả nhóm. Kế hoạch đang trống và mục đầu
   * là đỉnh thì hỏi chỗ xuất phát cho đỉnh đó, như khi thêm một đỉnh.
   */
  /**
   * Thay điểm đang chọn bằng một đỉnh / địa điểm (chủ sản phẩm 26/10): giữ id, thứ
   * tự, ô nghỉ đêm, cách đi tới, giờ đã đặt — như kéo điểm sang chỗ khác trên bản
   * đồ (`relocateWaypoint`). Một bước sửa, hoàn tác được.
   */
  const replacePoint = useCallback(
    (pick: SearchPick) => {
      const target = replaceFor
      if (!target || (pick.kind === 'peak' && !pick.trail.hasPeak)) return
      const to = pick.kind === 'peak'
        ? { lat: pick.trail.lat, lon: pick.trail.lng, kind: 'peak' as const, ref: pick.trail.trailId, name: pick.trail.name }
        : { lat: pick.place.lat, lon: pick.place.lon, kind: 'custom' as const, name: pick.place.name }
      if (apply((doc) => relocateWaypoint(doc, target.id, to))) {
        mapApi.current?.flyTo({ lat: to.lat, lng: to.lon }, pick.kind === 'peak' ? 12.5 : 15, fitPadding())
      }
    },
    [replaceFor, apply],
  )

  const addPicks = useCallback(
    (items: SearchPick[]) => {
      const picks = items.filter((p) => p.kind === 'place' || p.trail.hasPeak)
      if (picks.length === 0) {
        const t = items[0]
        if (t?.kind === 'peak') mapApi.current?.flyTo(t.trail, 12.5, fitPadding())
        return
      }
      const at = (p: SearchPick) => (p.kind === 'peak' ? { lat: p.trail.lat, lng: p.trail.lng } : { lat: p.place.lat, lng: p.place.lon })
      const first = ed.doc.waypoints.length === 0
      let firstWp: Waypoint | null = null
      const ok = apply((doc) => {
        let cur = doc
        for (const p of picks) {
          const id = freshWaypointId(cur, rid)
          const wp = p.kind === 'peak'
            ? makeWaypoint({ id, kind: 'peak', ref: p.trail.trailId, lat: p.trail.lat, lon: p.trail.lng, name: p.trail.name })
            : makeWaypoint({ id, kind: 'custom', lat: p.place.lat, lon: p.place.lon, name: p.place.name })
          firstWp ??= wp
          const r = appendWaypoint(cur, wp)
          if (!r.ok) return r
          cur = r.doc
        }
        return cur
      })
      if (!ok || !firstWp) return
      if (picks.length === 1) mapApi.current?.flyTo(at(picks[0]), picks[0].kind === 'peak' ? 12.5 : 15, fitPadding())
      else mapApi.current?.fit(picks.map(at), fitPadding())
      const head = picks[0]
      if (!first || head.kind !== 'peak') return
      // Đỉnh làm điểm đầu: hỏi có thật xuất phát trên đỉnh, hay để máy chọn chân núi.
      const p: Waypoint = firstWp
      const t = head.trail
      const settingsDoc = ed.doc
      setStartAsk({
        peakName: t.name,
        find: () => fetchStartTrailhead({ ...settingsDoc, waypoints: [p] }),
        apply: (th) => {
          const placed = apply((doc) =>
            doc.waypoints[0]?.id === p.id
              ? prependStart(doc, freshWaypointId(doc, rid), { ...th, trailId: t.trailId })
              : { ok: false, reason: 'missing' },
          )
          if (placed) {
            mapApi.current?.fit([{ lat: th.latE6 / 1e6, lng: th.lonE6 / 1e6 }, ...picks.map(at)], fitPadding())
          }
        },
      })
    },
    [apply, ed.doc],
  )
  // Tìm địa điểm: ưu tiên kết quả gần điểm cuối của kế hoạch (chỗ sắp đi tiếp).
  const lastWp = ed.doc.waypoints[ed.doc.waypoints.length - 1]
  const lastPoint = useMemo(
    () => (lastWp ? { lat: lastWp.latE6 / 1e6, lng: lastWp.lonE6 / 1e6 } : null),
    [lastWp],
  )
  const addPeak = useCallback((t: TrailPin) => addPicks([{ kind: 'peak', trail: t }]), [addPicks])

  const autoById = useCallback(
    (id: string) => draw.autos.find((a) => a.stop.id === id) ?? null,
    [draw.autos],
  )
  const keepAuto = useCallback(
    (stop: ResultStop, afterWaypointId: string) =>
      apply((doc) => keepAutoStop(doc, stop, afterWaypointId, freshWaypointId(doc, rid))),
    [apply],
  )
  // Bỏ một lán: không chèn lại lán đó. Bỏ một vùng nên nghỉ: đoàn không mang lều
  // — mọi vùng khác cũng thôi, ngày quá dài quay về cảnh báo.
  const dismissAuto = useCallback(
    (stop: ResultStop) => {
      if (stop.zone) {
        apply((doc) => patchSettings(doc, { camp: false }))
        // Bật lại nằm sâu trong Cài đặt — đưa nút ra ngay lúc vừa tắt.
        say('Đã bỏ mọi vùng nên nghỉ — đoàn không mang lều.', {
          label: 'Mang lều',
          tip: 'Bật lại: đoàn có mang lều, chỗ không có lán thì gợi ý vùng nên nghỉ',
          run: () => {
            apply((doc) => patchSettings(doc, { camp: true }))
            setToast(null)
          },
        })
        guide.fire('campOff')
      } else if (stop.poiId) apply((doc) => dismissAutoStop(doc, stop.poiId!))
    },
    [apply, say, guide],
  )

  // ─── Lộ trình các cung trong khung nhìn ─────────────────────────────────
  const routesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const routesCtl = useRef<AbortController | null>(null)
  const loadRoutes = (b: Bbox, zoom: number) => {
    if (routesTimer.current) clearTimeout(routesTimer.current)
    if (zoom < ROUTES_MIN_ZOOM || b.maxLng - b.minLng > 3 || b.maxLat - b.minLat > 3) return
    routesTimer.current = setTimeout(() => {
      routesCtl.current?.abort()
      const ctl = new AbortController()
      routesCtl.current = ctl
      fetchRoutesInBbox(b, ctl.signal)
        .then((r) => mapApi.current?.addRoutes(r))
        .catch((e) => {
          if (!ctl.signal.aborted) console.warn('plan: tải lộ trình lỗi —', e)
        })
    }, 250)
  }

  const mapHandlers: Omit<PlanMapHandlers, 'onReady' | 'onFatal'> = {
    onMapClick: addPoint,
    nextPointName: () => nextPointName(ed.doc),
    obstructed: fitPadding,
    onAddPeak: addPeak,
    onAddPoi: (p) =>
      apply((doc) =>
        appendWaypoint(doc, makeWaypoint({ id: freshWaypointId(doc, rid), kind: 'poi', ref: p.poiId, lat: p.lat, lon: p.lng, name: p.name })),
      ),
    onWaypointMoved: (id, at, snapped, target) => {
      // Thả đúng lên một đỉnh / POI (điểm đã hít vào tâm nó): thành chính chỗ đó —
      // tên, loại, mã (chủ sản phẩm 26/10). Không thì như cũ: lộ trình hoặc tự chấm.
      const ok = apply((doc) =>
        target
          ? relocateWaypoint(doc, id, { lat: target.lat, lon: target.lng, kind: target.kind, ref: target.ref, name: target.name })
          : relocateWaypoint(doc, id, {
            lat: snapped?.lat ?? at.lat,
            lon: snapped?.lng ?? at.lng,
            kind: snapped ? 'route' : 'custom',
            ref: snapped?.trailId,
          }),
      )
      if (ok && !snapped && !target) snapToPath(id, at)
    },
    onWaypointRemove: (id) => apply((doc) => removeWaypoint(doc, id)),
    // Cùng thao tác với ô "Nghỉ đêm ở đây" trên dòng thời gian (bỏ giờ xuất phát
    // đã đặt, giữ đúng số đêm đã xếp ngày).
    onWaypointToggleRest: (id) => apply((doc) => toggleRest(doc, id)),
    onKeepAuto: (id) => {
      const a = autoById(id)
      if (a) keepAuto(a.stop, a.afterWaypointId)
    },
    onDismissAuto: (id) => {
      const a = autoById(id)
      if (a) dismissAuto(a.stop)
    },
    onView: (b, zoom) => loadRoutes(b, zoom),
  }

  const actions: TimelineActions = {
    rename: (id, name) => apply((doc) => updateWaypoint(doc, id, { name })),
    move: (id, d) => apply((doc) => moveWaypoint(doc, id, d)),
    remove: (id) => apply((doc) => removeWaypoint(doc, id)),
    toggleRest: (id) => apply((doc) => toggleRest(doc, id)),
    setTransport: (id, t) => apply((doc) => updateWaypoint(doc, id, { transport: t })),
    keepAuto,
    dismissAuto,
    setArriveAt: (id, at) => {
      let next: PlanDoc | null = null
      apply((doc) => (next = setArriveAt(doc, id, at)))
      setLateCheck(at != null && next ? { doc: next, target: { kind: 'wp', id } } : null)
    },
    // Sửa giờ xuất phát thì giờ có mặt phía sau tính lại theo nó (chủ sản phẩm
    // 26/10) — bỏ giờ có mặt đã đặt ở các điểm mà giờ xuất phát đó quyết.
    setDepartAt: (id, m, nightHere) =>
      apply((doc) => {
        const next = setDepartAt(doc, id, m, nightHere)
        return m == null ? next : clearArrivalsAfter(next, ed.result, { kind: 'wp', id })
      }),
    setNightTransfer: (min) => apply((doc) => patchSettings(doc, { nightTransferMin: min })),
    setDepart: (min) => setFirstDepart(min),
    chooseRest: (stop, choice) => apply((doc) => chooseRest(doc, stop, choice, freshWaypointId(doc, rid))),
    moveToDay: (id, slot) => {
      const before = ed.result
      const { dayOf } = dayLayout(timeline.rows)
      let moved: PlanDoc | null = null
      apply((doc) => (moved = moveToDay(doc, dayOf, id, slot)))
      if (moved && moved !== ed.doc) setStrainCheck({ doc: moved, before })
    },
    setAutoTime: (key, patch) => {
      const live = new Set(ed.result?.stops.flatMap((s) => (s.timeKey ? [s.timeKey] : [])) ?? [])
      let next: PlanDoc | null = null
      apply((doc) => {
        const r = setAutoTime(doc, key, patch, live)
        if (!r.ok) return r
        next = patch.departAt == null ? r.doc : clearArrivalsAfter(r.doc, ed.result, { kind: 'auto', key })
        return { ok: true, doc: next }
      })
      setLateCheck(patch.arriveAt != null && next ? { doc: next, target: { kind: 'auto', key } } : null)
    },
    // Bấm chấm số ở lộ trình: soi kỹ đúng điểm đó (chủ sản phẩm 24/10 — 13 còn xa quá).
    focus: (lat, lng) => mapApi.current?.flyTo({ lat, lng }, 16, fitPadding()),
  }

  const settings = (p: SettingsPatch) => apply((doc) => patchSettings(doc, p))
  /**
   * Giờ xuất phát của điểm đầu (cũng là giờ đi mặc định của các ngày sau): giờ có
   * mặt đã đặt trong ngày leo đầu tiên thôi tính ngược giờ đi (`clearArrivalsAfter`).
   */
  const setFirstDepart = (min: number) =>
    apply((doc) => clearArrivalsAfter(patchSettings(doc, { departMin: min }), ed.result, { kind: 'first' }))

  // ─── Về vị trí của tôi ──────────────────────────────────────────────────
  // Chỉ hỏi vị trí khi người dùng bấm nút — không xin quyền lúc mở trang.
  const [locating, setLocating] = useState(false)
  const locate = () => {
    if (!('geolocation' in navigator)) {
      say('Trình duyệt này không cho lấy vị trí.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        mapApi.current?.setMe(at)
        mapApi.current?.flyTo(at, 13, fitPadding())
      },
      (err) => {
        setLocating(false)
        say(
          err.code === err.PERMISSION_DENIED
            ? 'Chưa được phép lấy vị trí — bật quyền vị trí cho trang này trong trình duyệt.'
            : 'Không lấy được vị trí. Thử lại sau giây lát.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  // ─── Ôm trọn kế hoạch lúc mở ────────────────────────────────────────────
  const fitPlan = useCallback(() => {
    const pts = ed.doc.waypoints.map((w) => ({ lat: w.latE6 / 1e6, lng: w.lonE6 / 1e6 }))
    if (pts.length) mapApi.current?.fit(pts, fitPadding())
  }, [ed.doc.waypoints])
  // Ôm trọn kế hoạch đúng lúc vừa mở (một lần). Người dùng thêm điểm đầu tiên
  // thì không được giật camera đi chỗ khác.
  const initialFit = useMemo(
    () =>
      ed.opened && ed.opened.waypoints.length > 0
        ? { points: ed.opened.waypoints.map((w) => ({ lat: w.latE6 / 1e6, lng: w.lonE6 / 1e6 })), padding: fitPadding() }
        : null,
    [ed.opened],
  )

  // ─── Rê chuột trên biểu đồ độ cao ───────────────────────────────────────
  const resultPaths = useMemo(
    () => ed.result?.legs.flatMap((l) => l.draw.map((d) => decodePolyline(d.line))) ?? [],
    [ed.result],
  )
  const onHover = useCallback(
    (frac: number | null) => {
      const p = frac == null ? null : pointAlong(resultPaths, frac)
      mapApi.current?.setHover(p ? { lng: p[0], lat: p[1] } : null)
    },
    [resultPaths],
  )

  // ─── Phím tắt ───────────────────────────────────────────────────────────
  const { undo: doUndo, redo: doRedo } = ed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || t.isContentEditable)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) doRedo()
        else doUndo()
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        doRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo])

  useEffect(() => {
    document.title = `${ed.doc.title} · Kế hoạch · WayTrek`
  }, [ed.doc.title])

  // Áp dụng gợi ý: kế hoạch đổi hẳn hình dạng (thêm chân núi, đổi thứ tự) nên
  // ôm lại khung nhìn theo kế hoạch mới.
  const applySuggestion = () => {
    const s = ed.suggestion
    if (s.kind !== 'ready' || s.outcome.kind !== 'ok') return
    const pts = s.outcome.doc.waypoints.map((w) => ({ lat: w.latE6 / 1e6, lng: w.lonE6 / 1e6 }))
    ed.applySuggestion()
    mapApi.current?.fit(pts, fitPadding())
  }

  const save = () => {
    if (ed.saveNow() === 'needAuth') {
      requestLogin({ reason: 'Đăng nhập để lưu kế hoạch vào tài khoản WayTrek và mở được trên app.', beforeRedirect: ed.persistNow })
    }
  }

  // ─── Màn chặn: cần đăng nhập / không có / lỗi ───────────────────────────
  if (ed.load.kind === 'needAuth' || ed.load.kind === 'notFound' || ed.load.kind === 'failed') {
    return (
      <main className="pl-page">
        <div className="pl-intro">
          {ed.load.kind === 'needAuth' && (
            <>
              <h1>Đăng nhập để mở kế hoạch này</h1>
              <p>Kế hoạch chỉ mở được bằng chính tài khoản đã tạo ra nó.</p>
              <div className="pl-intro-actions">
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => requestLogin({})} data-tip="Đăng nhập bằng tài khoản đã tạo kế hoạch này">
                  Đăng nhập
                </button>
              </div>
            </>
          )}
          {ed.load.kind === 'notFound' && (
            <>
              <h1>Không tìm thấy kế hoạch</h1>
              <p>Kế hoạch có thể đã bị xoá, hoặc thuộc một tài khoản khác.</p>
              <div className="pl-intro-actions">
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => navigate('/plan')} data-tip="Về danh sách kế hoạch đã lưu">
                  Kế hoạch của tôi
                </button>
              </div>
            </>
          )}
          {ed.load.kind === 'failed' && (
            <>
              <h1>Chưa mở được kế hoạch</h1>
              <p>{ed.load.message}</p>
              <div className="pl-intro-actions">
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => window.location.reload()} data-tip="Tải lại trang để mở lại kế hoạch">
                  Thử lại
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    )
  }

  const count = ed.doc.waypoints.length
  const prepCount = progress(ed.checklist)

  return (
    <div className="pl-body">
      <MapView
        apiRef={mapApi}
        dark={dark}
        initialFit={initialFit}
        trails={trails}
        pois={pois}
        lines={draw.lines}
        waypoints={waypoints}
        autos={autos}
        layers={layers}
        handlers={mapHandlers}
      />
      <Panel
        doc={ed.doc}
        result={ed.result}
        computing={ed.computing || ed.load.kind === 'loading' || ed.save.kind === 'saving'}
        computeError={ed.computeError}
        save={ed.save}
        tab={tab}
        prepCount={prepCount}
        onTab={setTab}
        onTitle={(v) => settings({ title: v })}
        onDate={(v) => settings({ startDate: v })}
        onRetryCompute={ed.retryCompute}
        onRetrySave={save}
        onConflict={ed.resolveConflict}
        onSaveAsNew={ed.saveAsNew}
        onLogin={() => requestLogin({ reason: 'Đăng nhập lại để lưu thay đổi.' })}
      >
        {ed.load.kind === 'loading' ? (
          <p className="pl-muted pl-pad">Đang mở kế hoạch…</p>
        ) : tab === 'route' ? (
          <>
            {catalogError && (
              <p className="pl-status is-warn pl-pad">
                {catalogError} <button type="button" className="pl-text-btn" onClick={retryCatalog} data-tip="Tải lại các đỉnh, lộ trình, lán trên bản đồ">Thử lại</button>
              </p>
            )}
            <SuggestPanel
              readiness={suggestReadiness(ed.doc)}
              state={ed.suggestion}
              onSuggest={ed.suggest}
              onApply={applySuggestion}
              onDismiss={ed.dismissSuggestion}
              extra={hasRestSuggestions && (
                // Ẩn / hiện chỗ nghỉ máy chủ gợi ý — trên bản đồ lẫn dòng thời gian
                // (chủ sản phẩm 26/10), cùng hàng và cùng kiểu với nút gợi ý.
                <button
                  type="button"
                  className="pl-btn pl-btn-quiet pl-suggest-btn"
                  onClick={() => setLayers((l) => ({ ...l, rests: !l.rests }))}
                  data-tip={layers.rests
                    ? 'Ẩn lán và vùng nên nghỉ WayTrek tự chọn — chỉ còn những điểm bạn chọn, trên bản đồ lẫn ở đây'
                    : 'Hiện lại lán và vùng nên nghỉ WayTrek tự chọn cho các đêm'}
                >
                  <ITent size={16} />
                  {/* Nhãn ngắn: cả hai trạng thái vừa một hàng với nút gợi ý (đo 26/10: nhãn dài làm hàng xuống dòng khi đổi). */}
                  {layers.rests ? 'Ẩn chỗ nghỉ' : 'Hiện chỗ nghỉ'}
                </button>
              )}
            />
            <Timeline
              rows={timeline.rows}
              count={count}
              fresh={ed.rowsFresh || ed.result == null}
              computeError={ed.computeError}
              trails={trailsById}
              actions={actions}
              nightTransferMin={ed.doc.nightTransferMin ?? null}
              firstLegWpId={ed.doc.waypoints[1]?.id ?? null}
              departOk={departAtSupported(ed.result)}
              showRests={layers.rests}
              dayMove={dayEditSupported(ed.result)}
              autoTimes={ed.doc.autoTimes}
            />
            {count >= 2 && !endsAtStart(ed.doc) && (
              <button
                type="button"
                className="pl-btn pl-btn-quiet pl-return"
                onClick={() => apply((doc) => returnToStart(doc, freshWaypointId(doc, rid)))}
                data-tip="Thêm điểm cuối trùng điểm xuất phát — chuyến đi rồi quay về"
              >
                <IReturn size={16} /> Quay về điểm xuất phát
              </button>
            )}
            {!ed.saved && count > 0 && (
              <button type="button" className="pl-text-btn pl-discard" onClick={ed.discardNewDraft} data-tip="Xoá bản nháp chưa lưu, bắt đầu lại với bản đồ trống">
                Bỏ bản nháp này
              </button>
            )}
          </>
        ) : tab === 'path' ? (
          <PathTab
            doc={ed.doc}
            result={ed.result}
            dark={dark}
            roundTrip={endsAtStart(ed.doc)}
            onFocus={actions.focus}
            onAdd={() => setSearchOpen(true)}
            onReplace={(id) => {
              const w = ed.doc.waypoints.find((x) => x.id === id)
              if (w) setReplaceFor({ id, name: w.name, lat: w.latE6 / 1e6, lng: w.lonE6 / 1e6 })
            }}
            onRoundTrip={(on) =>
              apply((doc) => {
                if (on) return endsAtStart(doc) ? doc : returnToStart(doc, freshWaypointId(doc, rid))
                // Tắt: bỏ điểm cuối khi nó chính là điểm xuất phát (đã quay về).
                const last = doc.waypoints[doc.waypoints.length - 1]
                return endsAtStart(doc) && doc.waypoints.length > 2 ? removeWaypoint(doc, last.id) : doc
              })}
            onApply={(ids) => apply((doc) => reorderWaypoints(doc, ids))}
          />
        ) : (
          <Checklist
            items={ed.checklist}
            error={ed.checklistError}
            onDone={ed.setItemDone}
            onRename={ed.renameItem}
            onRemove={ed.removeItem}
            onAdd={ed.addItem}
          />
        )}
      </Panel>
      <Toolbar
        doc={ed.doc}
        canUndo={ed.canUndo}
        canRedo={ed.canRedo}
        onUndo={ed.undo}
        onRedo={ed.redo}
        layers={layers}
        onLayer={(k, on) => setLayers((l) => ({ ...l, [k]: on }))}
        onSettings={settings}
        save={ed.save}
        saved={ed.saved}
        canSave={count > 0 && ed.load.kind === 'ready'}
        onSave={save}
        settingsOpen={settingsOpen}
        onSettingsOpen={setSettingsOpen}
        onSearch={() => setSearchOpen(true)}
      />
      <div className="pl-controls">
        <button type="button" className="pl-ctrl" onClick={() => mapApi.current?.zoomBy(1)} aria-label="Phóng to" data-tip="Phóng to bản đồ">
          <IPlus />
        </button>
        <button type="button" className="pl-ctrl" onClick={() => mapApi.current?.zoomBy(-1)} aria-label="Thu nhỏ" data-tip="Thu nhỏ bản đồ">
          <IMinus />
        </button>
        <button
          type="button"
          className="pl-ctrl"
          onClick={fitPlan}
          disabled={count === 0}
          aria-label="Ôm trọn kế hoạch"
          data-tip="Ôm trọn mọi điểm của kế hoạch vào khung nhìn"
        >
          <IFit />
        </button>
        <button
          type="button"
          className="pl-ctrl"
          onClick={locate}
          disabled={locating}
          aria-label="Về vị trí của tôi"
          data-tip="Đưa bản đồ về chỗ bạn đang đứng — trình duyệt sẽ hỏi quyền vị trí"
        >
          <ILocate />
        </button>
      </div>
      <StatsBar
        result={ed.result}
        pace={ed.doc.pace}
        fresh={ed.fresh}
        onPace={() => setSettingsOpen(true)}
        onHover={onHover}
      />
      <CoachMark guide={guide.current} onClose={guide.dismiss} />
      <div className={`pl-toast${shownToast ? ' is-on' : ''}${shownToast?.action ? ' has-action' : ''}`} role="status" aria-live="polite">
        {shownToast?.text}
        {shownToast?.action && (
          <button type="button" className="pl-toast-action" onClick={shownToast.action.run} data-tip={shownToast.action.tip}>
            {shownToast.action.label}
          </button>
        )}
      </div>
      <StartPeakDialog ask={startAsk} onClose={() => setStartAsk(null)} />
      <LateArrivalDialog
        late={late}
        onKeep={() => setLateCheck(null)}
        onNextDay={() => {
          const c = lateCheck
          setLateCheck(null)
          if (!c || !late) return
          const { dayOf } = dayLayout(timeline.rows)
          if (c.target.kind === 'wp') {
            const id = c.target.id
            apply((doc) => pushToNextDay(doc, dayOf, id))
            return
          }
          const key = c.target.key
          const next = ed.doc.waypoints[late.stop.afterWaypointIndex + 1]
          const live = new Set(ed.result?.stops.flatMap((s) => (s.timeKey ? [s.timeKey] : [])) ?? [])
          if (next) apply((doc) => pushAutoToNextDay(doc, dayOf, next.id, key, live))
        }}
      />
      <StrainDialog
        lines={strain}
        onKeep={() => setStrainCheck(null)}
        onUndo={() => {
          setStrainCheck(null)
          ed.undo()
        }}
      />
      <SearchDialog
        open={searchOpen || replaceFor != null}
        onClose={() => {
          setSearchOpen(false)
          setReplaceFor(null)
        }}
        trails={trails}
        combos={combos}
        onPick={(t) => mapApi.current?.flyTo(t, 12.5, fitPadding())}
        onAdd={addPicks}
        focus={replaceFor ?? lastPoint}
        replace={replaceFor}
        onReplace={replacePoint}
      />
    </div>
  )
}
