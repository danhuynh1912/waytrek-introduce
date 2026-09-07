import { PRIVACY_URL, STORE_URL, TERMS_URL } from '@/data/screens'
import { Apple } from './Header'

export function Outro() {
  return (
    <section className="outro" id="tai-app">
      <div className="outro-grid">
        <div>
          <h2>Lần leo tới, hãy mang WayTrek theo</h2>
          <p>Bạn tải bản đồ trước ở nhà, lên núi ghi hành trình bằng GPS, chụp một tấm là AI gọi tên cây, và về tới nơi thì đỉnh đã nằm trong sơn phả của bạn.</p>
          <a className="store-badge" href={STORE_URL} target="_blank" rel="noopener">
            <Apple />
            <span><small>Tải miễn phí trên</small><b>App Store</b></span>
          </a>
        </div>
        <div className="facts" aria-label="Vài con số">
          <div><b>16</b><span>cung núi có tuyến GPX thật</span></div>
          <div><b>3D</b><span>địa hình từ dữ liệu DEM</span></div>
          <div><b>0 sóng</b><span>vẫn có bản đồ và tuyến</span></div>
          <div><b>1 chạm</b><span>để AI gọi tên cây trong ảnh</span></div>
        </div>
      </div>
      <footer className="foot">
        <span>© {new Date().getFullYear()} WayTrek. Dành cho leo núi Việt Nam.</span>
        <nav>
          <a href={PRIVACY_URL} target="_blank" rel="noopener">Quyền riêng tư</a>
          <a href={TERMS_URL} target="_blank" rel="noopener">Điều khoản</a>
          <a href={STORE_URL} target="_blank" rel="noopener">App Store</a>
        </nav>
      </footer>
    </section>
  )
}
