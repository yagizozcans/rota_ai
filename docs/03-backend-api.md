# 03 — Backend API Katmanı PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Tüm katmanları birbirine bağlayan orkestrasyon merkezi. Mobil yüklemeleri alır, depolar, AI işleme görevlerini kuyruğa atar, sonuçları GIS'e yazdırır, onay konsoluna veri sağlar, kimlik doğrulaması yapar. **Sistemin trafik polisi.**

## 2. Teknoloji
- **API:** Python + FastAPI (mevcut stack ile uyumlu, AI pipeline ile doğal entegrasyon).
- **Kuyruk:** Celery + Redis (ağır AI işini arka planda çalıştır, upload'ı bloklamadan).
- **Depolama (görüntü):** S3-uyumlu object storage (Cloudflare R2 / Backblaze B2 — düşük egress maliyeti; bkz. `06-infra-devops.md §3`). Nesne yolu kiracı ön-ekli: `{org_id}/{session_id}/{frame_id}.jpg` (bkz. `00-overview §4.5`).
- **Veritabanı:** PostgreSQL + PostGIS (04 ile ortak; bkz. `04-gis-data.md`).
- **Kimlik:** JWT tabanlı auth.

## 3. Sorumluluklar
1. Mobil'den kare + metadata al, görüntüyü object storage'a kiracı ön-ekli yolla (`{org_id}/…`) yaz. `org_id` login token'ından alınır (bkz. `00-overview §4.5`).
2. Her kare için AI işleme görevini Celery kuyruğuna at.
3. AI'dan dönen `Detection[]`'ı al, GPS ile eşleyip koordinatlandır, PostGIS'e `InventoryItem` olarak yaz (durum: `pending`).
4. Onay konsoluna (05) bekleyen kayıtları serve et, onay/red kararlarını işle.
5. Final envanter katmanını rapor/WFS olarak dışa sun (04 ile birlikte).

## 4. Ana Endpoint'ler

### 4.0 Kimlik (← 01 Mobil)
- `POST /api/v1/auth/login` → JWT döner (`org_id`, `device_id`, `role` claim'leri). Sürüş başlamadan alınır; sonraki tüm `sessions`/`frames` çağrıları `Authorization: Bearer <token>` taşır. MVP'de pilot için uzun ömürlü token üreten basit bir issuer'dır (gerçek kullanıcı deposu + rotasyon Faz 3 — bkz. 01 §4, plan Q7).

### 4.1 Yükleme (← 01 Mobil)
- `POST /api/v1/sessions` → **istemci tarafından üretilen `session_id`'yi kabul eder ve idempotent upsert yapar** (aynı id ile tekrar çağrı no-op). Offline-first: mobil `session_id`'yi kendi üretir (plan Q1), bu çağrı yalnızca fırsat buldukça (online olunca) yapılır, ön koşul değildir. `org_id` token'dan alınır.
- `POST /api/v1/frames` → multipart (görüntü + `CaptureFrame` JSON, form alanları `metadata` + `image`). Bilinmeyen `session_id`'yi token'ın `org_id`'si altında **tembel (lazy) otomatik kaydeder** — böylece kare yüklemesi oturum kaydına bağımlı değildir ve sıralama önemsizdir. İstemci `frame_id`'si kullanılır → aynı karenin tekrar yüklenmesi idempotenttir (kayıp ack çift kayıt yaratmaz). `frame_id` döner.
- `POST /api/v1/sessions/{id}/complete` → oturumu kapat.

### 4.2 Onay (↔ 05 Konsol)
- `GET /api/v1/review/queue` → onay bekleyen `InventoryItem`'lar (görüntü + bbox + öneri sınıfı).
- `POST /api/v1/review/{item_id}` → karar: `approved | rejected | corrected` (+ düzeltme varsa yeni sınıf/severity).

### 4.3 Çıktı (→ kurum)
- `GET /api/v1/inventory` → onaylı envanter (filtrelenebilir: bölge, sınıf, tarih).
- `GET /api/v1/inventory/export` → GeoJSON / Shapefile / WFS bağlantısı (bkz. `04-gis-data.md §5`).

## 5. AI Entegrasyonu (↔ 02)
- Celery task `process_frame(frame_id, image_path)`:
  1. Görüntüyü storage'dan çek.
  2. 02'deki YOLO26-s modülünü çağır → `Detection[]`.
  3. Her tespiti kare GPS'i + heading ile koordinatlandır (ham WGS84 nokta).
  4. 04'e `InventoryItem` olarak yaz (durum `pending`).
- Hata/timeout durumunda görev retry edilir, kalıcı hata loglanır.
- `gps.accuracy_m > 20` olan kareler koordinatlandırmada düşük güvenle işaretlenir (01 §3.5; ayrı bir alan gerektirmez — backend bunu `accuracy_m`'den türetir, plan Q6).

## 6. Kimlik ve Roller (MVP — basit)
- Her kullanıcı/cihaz tek bir kiracıya (`org`) bağlıdır; JWT token `org_id` taşır ve tüm sorgular buna göre kiracıya göre filtrelenir (bkz. `00-overview §4.5`).
- **saha_kullanici:** sadece kendi org'una mobil upload yapabilir.
- **onaylayici (harita mühendisi):** kendi org'unun onay konsoluna erişir.
- **admin:** kendi org'unda her şey + export. (Kurumlar arası "süper admin" Faz 3.)

## 7. Katmanlar Arası Kontrat (özet)
- ← 01 Mobil: `CaptureFrame` + görüntü (§4.1).
- ↔ 02 AI: `frame_id`+görüntü gönderir, `Detection[]` alır (§5).
- ↔ 04 GIS: `InventoryItem` yazar/okur.
- ↔ 05 Onay: kuyruk serve eder, karar alır (§4.2).

## 8. Kapsam Dışı (MVP)
- Kiracı **yönetimi** (onboarding, kurum admin paneli, faturalama) — Faz 3. *Kiracı anahtarı `org_id` + izolasyon (storage ön-eki, DB RLS, token'da org_id) MVP'ye dahildir — bkz. `00-overview §4.5`.*
- Gelişmiş rol/yetki yönetimi (RBAC) — MVP'de 3 rol yeterli.
- Rate limiting / API gateway — ölçekte.

## 9. Kabul Kriterleri
- [ ] Mobil'den gelen kare depolanıp işleme kuyruğuna giriyor.
- [ ] AI sonucu koordinatlanıp PostGIS'e `pending` olarak yazılıyor.
- [ ] Onay konsolu kuyruğu çekip karar gönderebiliyor.
- [ ] Onaylı envanter GeoJSON olarak export edilebiliyor.
