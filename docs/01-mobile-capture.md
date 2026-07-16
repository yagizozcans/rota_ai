# 01 — Mobil Çekim Katmanı PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Saha aracına (belediye aracı, KGM bölge aracı, özel araç) monte edilen bir telefonla, sürüş sırasında düzenli aralıklarla yol görüntüsü + konum + metadata toplayıp backend'e yükleyen mobil uygulama. **Bu katmanda AI çalışmaz** — sadece güvenilir veri toplama ve yükleme yapar.

## 2. Teknoloji
- **React Native** (tek kod tabanı, Android + iOS). Android öncelikli (kamu araçlarında yaygın).
- Kamera: `react-native-vision-camera` (yüksek performanslı frame yakalama).
- Konum: `react-native-geolocation` + cihaz sensörleri (heading için gyroscope/magnetometer).
- Yerel depolama (offline): SQLite (`react-native-sqlite-storage`).

## 3. Fonksiyonel Gereksinimler

### 3.1 Oturum (Session) Yönetimi
- Kullanıcı "Sürüşü Başlat" der → yeni `session_id` üretilir.
- Sürüş boyunca tüm kareler bu oturuma bağlanır (bkz. 00-overview §4.1 `CaptureFrame`).
- "Sürüşü Bitir" → oturum kapanır, yükleme kuyruğu tamamlanmayı bekler.

### 3.2 Görüntü Yakalama
- **Video değil, aralıklı foto** — mesafe bazlı tetikleme (varsayılan her ~5 metrede bir kare; GPS hızına göre hesaplanır).
- Alternatif tetikleme: sabit zaman aralığı (düşük sinyalde fallback).
- Her kareye metadata iliştirilir: `gps` (lat, lon, accuracy, speed), `heading_deg`, `timestamp`, `device_id`.

### 3.3 Offline-First
- Sinyal olmayan bölgelerde (kamu araçları her yerde bağlanamaz) kareler **yerelde SQLite + dosya sisteminde** tutulur.
- İnternet bulununca otomatik arka plan senkronizasyonu (backend'e upload — bkz. §4).
- Yükleme başarılı olunca yerel kopya silinir (cihaz dolmasın).

### 3.4 Yükleme
- Her kare backend'in upload endpoint'ine gönderilir (bkz. `03-backend-api.md §4.1`).
- Multipart: görüntü dosyası + `CaptureFrame` JSON metadata.
- Yeniden deneme (retry) mantığı: başarısız yüklemeler kuyrukta kalır, exponential backoff ile tekrar denenir.

### 3.5 Kalite Kontrol (cihaz tarafı, hafif)
- Bulanık/çok karanlık kareleri basit bir eşikle ele (Laplacian variance ile blur tespiti) — gereksiz veri yüklemeyi azaltır. Ağır AI değil, sadece basit filtre.
- GPS accuracy > 20m ise kareyi işaretle (backend güven skorunu düşürebilsin).

## 4. Katmanlar Arası Kontrat
- **Çıktı → 03 Backend:** her kare için `CaptureFrame` (00-overview §4.1) + görüntü dosyası.
- **Girdi ← 03 Backend:** kimlik doğrulama token'ı (sürüş başlatmadan önce login), upload onay/hata yanıtı.

## 5. Kapsam Dışı (MVP)
- Cihaz üstünde canlı AI/tespit (tüm işleme bulutta — bkz. 02).
- Kullanıcıya sahada sonuç gösterme (sadece "X kare toplandı, Y yüklendi" durumu).
- iOS optimizasyonu (Android MVP'de yeterli).

## 6. Kabul Kriterleri
- [ ] 10 km'lik bir sürüşte kareler ~5m aralıkla, doğru GPS ile toplanıyor.
- [ ] Sinyal kesintisinde kareler kaybolmuyor, sinyal gelince yükleniyor.
- [ ] Her kare backend'de doğru `session_id` ve metadata ile görünüyor.
- [ ] Bulanık kareler filtreleniyor (yükleme hacmi makul).
