/**
 * Công tắc "Quay về điểm xuất phát" — MỘT kiểu cho cả tab Waypoints lẫn cuối
 * tab Lịch trình (chủ sản phẩm 26/10: lấy kiểu của tab Waypoints làm chuẩn).
 * Bật: thêm điểm cuối trùng điểm xuất phát; tắt: bỏ điểm đó.
 */
export function RoundTripSwitch({ on, disabled, onChange }: {
  on: boolean
  disabled: boolean
  onChange(on: boolean): void
}) {
  return (
    <label className="pl-switch" data-tip="Thêm điểm cuối trùng điểm xuất phát — tắt thì bỏ điểm đó">
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="pl-switch-track" aria-hidden="true" />
      <span>Quay về điểm xuất phát</span>
    </label>
  )
}
