// Chữ hiển thị cho các mã dữ liệu. Mã icon POI là bộ cố định của app
// (`poiIconOptions` trong `way_trek/lib/features/poi/domain/poi_models.dart`).

const POI_KIND: Record<string, string> = {
  shelter: 'Lán',
  camp: 'Cây cổ thụ',
  water: 'Nguồn nước',
  view: 'Điểm ngắm cảnh',
  food: 'Ăn uống',
  trailhead: 'Điểm bắt đầu leo',
  photo: 'Điểm chụp ảnh',
  flag: 'Mốc',
  directions: 'Ngã rẽ',
  place: 'Điểm',
}

export function poiKindLabel(kind: string): string {
  return POI_KIND[kind] ?? 'Điểm'
}
