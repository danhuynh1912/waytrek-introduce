import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  appendWaypoint,
  dismissAutoStop,
  endsAtStart,
  freshWaypointId,
  keepAutoStop,
  makeWaypoint,
  MAX_WAYPOINTS,
  moveWaypoint,
  nextPointName,
  patchSettings,
  relocateWaypoint,
  removeWaypoint,
  returnToStart,
  setArriveAt,
  suggestReadiness,
  updateWaypoint,
} from '../../core/doc'
import type { SettingsPatch } from '../../core/doc'
import { progress } from '../../core/checklist'
import { decodePolyline } from '../../core/polyline'
import { pointAlong } from '../../core/profile'
import { buildTimeline, drawLines } from '../../core/timeline'
import type { PlanDoc, ResultStop, TrailPin } from '../../core/types'
import { fetchRoutesInBbox } from '../../data/api'
import type { Bbox } from '../../data/api'
import type { AuthRequest } from '../AuthDialog'
import { IFit, IMinus, IPlus, IReturn } from '../icons'
import type { LatLng, LayerKey, MapAuto, MapWaypoint, PlanMapHandlers, Snapped } from '../map/plan-map'
import { navigate, replaceSilently } from '../route'
import { Checklist } from './Checklist'
import { MapView } from './MapView'
import type { MapApi } from './MapView'
import { Panel } from './Panel'
import { StatsBar } from './StatsBar'
import { SuggestPanel } from './SuggestPanel'
import { Timeline } from './Timeline'
import type { TimelineActions } from './Timeline'
import { Toolbar } from './Toolbar'
import { useCatalog } from './use-catalog'
import { usePlanEditor } from './use-plan-editor'

const REASON_TEXT: Record<string, string> = {
  full: `Mỗi kế hoạch tối đa ${MAX_WAYPOINTS} điểm.`,
  outside: 'Chỉ đặt được điểm trong Việt Nam.',
  missing: 'Điểm này không còn trong kế hoạch.',
}

/** Lộ trình các cung chỉ tải khi đã phóng gần — máy chủ từ chối khung rộng hơn 3°. */
const ROUTES_MIN_ZOOM = 9
const rid = () => Math.random().toString(36).slice(2, 7)

function fitPadding() {
  const narrow = window.innerWidth < 760
  return narrow
    ? { top: 70, right: 30, bottom: Math.round(window.innerHeight * 0.42), left: 30 }
    : { top: 76, right: 76, bottom: 176, left: 420 }
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
  const { trails, pois, error: catalogError, retry: retryCatalog } = useCatalog()
  const mapApi = useRef<MapApi | null>(null)
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ routes: true, pois: true, peaks: true, terrain: true })
  const [tab, setTab] = useState<'route' | 'prep'>('route')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
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
  const poisById = useMemo(() => new Map(pois.map((p) => [p.poiId, p])), [pois])
  const timeline = useMemo(() => buildTimeline(ed.doc, ed.result, ed.resultDoc), [ed.doc, ed.result, ed.resultDoc])
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
        middle: i > 0 && i < all.length - 1,
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
        zoneLine: stop.zone?.line,
      })),
    [draw.autos],
  )

  // ─── Sửa kế hoạch ───────────────────────────────────────────────────────
  const addPoint = useCallback(
    (at: LatLng, snapped: Snapped | null) =>
      apply((doc) =>
        appendWaypoint(
          doc,
          makeWaypoint({
            id: freshWaypointId(doc, rid),
            kind: snapped ? 'route' : 'custom',
            ref: snapped?.trailId,
            lat: snapped?.lat ?? at.lat,
            lon: snapped?.lng ?? at.lng,
            name: nextPointName(doc),
          }),
        ),
      ),
    [apply],
  )

  const addPeak = useCallback(
    (t: TrailPin) => {
      if (!t.hasPeak) {
        mapApi.current?.flyTo(t, 12.5, fitPadding())
        return
      }
      const first = ed.doc.waypoints.length === 0
      const ok = apply((doc) =>
        appendWaypoint(doc, makeWaypoint({ id: freshWaypointId(doc, rid), kind: 'peak', ref: t.trailId, lat: t.lat, lon: t.lng, name: t.name })),
      )
      if (ok && first) mapApi.current?.flyTo(t, 12.5, fitPadding())
    },
    [apply, ed.doc.waypoints.length],
  )

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
      if (stop.zone) apply((doc) => patchSettings(doc, { camp: false }))
      else if (stop.poiId) apply((doc) => dismissAutoStop(doc, stop.poiId!))
    },
    [apply],
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
    onAddPeak: addPeak,
    onAddPoi: (p) =>
      apply((doc) =>
        appendWaypoint(doc, makeWaypoint({ id: freshWaypointId(doc, rid), kind: 'poi', ref: p.poiId, lat: p.lat, lon: p.lng, name: p.name })),
      ),
    onWaypointMoved: (id, at, snapped) =>
      apply((doc) =>
        relocateWaypoint(doc, id, {
          lat: snapped?.lat ?? at.lat,
          lon: snapped?.lng ?? at.lng,
          kind: snapped ? 'route' : 'custom',
          ref: snapped?.trailId,
        }),
      ),
    onWaypointRemove: (id) => apply((doc) => removeWaypoint(doc, id)),
    onWaypointToggleRest: (id) =>
      apply((doc) => updateWaypoint(doc, id, { rest: !doc.waypoints.find((w) => w.id === id)?.rest })),
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
    toggleRest: (id) => apply((doc) => updateWaypoint(doc, id, { rest: !doc.waypoints.find((w) => w.id === id)?.rest })),
    setTransport: (id, t) => apply((doc) => updateWaypoint(doc, id, { transport: t })),
    keepAuto,
    dismissAuto,
    setArriveAt: (id, at) => apply((doc) => setArriveAt(doc, id, at)),
    focus: (lat, lng) => mapApi.current?.flyTo({ lat, lng }, 13, fitPadding()),
  }

  const settings = (p: SettingsPatch) => apply((doc) => patchSettings(doc, p))

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
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => requestLogin({})}>Đăng nhập</button>
              </div>
            </>
          )}
          {ed.load.kind === 'notFound' && (
            <>
              <h1>Không tìm thấy kế hoạch</h1>
              <p>Kế hoạch có thể đã bị xoá, hoặc thuộc một tài khoản khác.</p>
              <div className="pl-intro-actions">
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => navigate('/plan')}>Kế hoạch của tôi</button>
              </div>
            </>
          )}
          {ed.load.kind === 'failed' && (
            <>
              <h1>Chưa mở được kế hoạch</h1>
              <p>{ed.load.message}</p>
              <div className="pl-intro-actions">
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => window.location.reload()}>Thử lại</button>
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
        trails={trails}
        tab={tab}
        prepCount={prepCount}
        onTab={setTab}
        onTitle={(v) => settings({ title: v })}
        onDate={(v) => settings({ startDate: v })}
        onDepart={(m) => settings({ departMin: m })}
        onAutoShift={(v) => settings({ autoShift: v })}
        onRetryCompute={ed.retryCompute}
        onRetrySave={save}
        onConflict={ed.resolveConflict}
        onSaveAsNew={ed.saveAsNew}
        onLogin={() => requestLogin({ reason: 'Đăng nhập lại để lưu thay đổi.' })}
        onPickTrail={(t) => mapApi.current?.flyTo(t, 12.5, fitPadding())}
        onAddPeak={addPeak}
      >
        {ed.load.kind === 'loading' ? (
          <p className="pl-muted pl-pad">Đang mở kế hoạch…</p>
        ) : tab === 'route' ? (
          <>
            {catalogError && (
              <p className="pl-status is-warn pl-pad">
                {catalogError} <button type="button" className="pl-text-btn" onClick={retryCatalog}>Thử lại</button>
              </p>
            )}
            <SuggestPanel
              readiness={suggestReadiness(ed.doc)}
              state={ed.suggestion}
              onSuggest={ed.suggest}
              onApply={applySuggestion}
              onDismiss={ed.dismissSuggestion}
            />
            <Timeline
              rows={timeline.rows}
              count={count}
              fresh={ed.fresh || ed.result == null}
              computeError={ed.computeError}
              trails={trailsById}
              pois={poisById}
              actions={actions}
            />
            {count >= 2 && !endsAtStart(ed.doc) && (
              <button
                type="button"
                className="pl-btn pl-btn-quiet pl-return"
                onClick={() => apply((doc) => returnToStart(doc, freshWaypointId(doc, rid)))}
              >
                <IReturn size={16} /> Quay về điểm xuất phát
              </button>
            )}
            {!ed.saved && count > 0 && (
              <button type="button" className="pl-text-btn pl-discard" onClick={ed.discardNewDraft}>Bỏ bản nháp này</button>
            )}
          </>
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
      />
      <div className="pl-controls">
        <button type="button" className="pl-ctrl" onClick={() => mapApi.current?.zoomBy(1)} aria-label="Phóng to"><IPlus /></button>
        <button type="button" className="pl-ctrl" onClick={() => mapApi.current?.zoomBy(-1)} aria-label="Thu nhỏ"><IMinus /></button>
        <button type="button" className="pl-ctrl" onClick={fitPlan} disabled={count === 0} aria-label="Ôm trọn kế hoạch" title="Ôm trọn kế hoạch"><IFit /></button>
      </div>
      <StatsBar
        result={ed.result}
        pace={ed.doc.pace}
        fresh={ed.fresh}
        onPace={() => setSettingsOpen(true)}
        onHover={onHover}
      />
      <div className={`pl-toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  )
}
