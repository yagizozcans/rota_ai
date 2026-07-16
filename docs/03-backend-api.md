# 03 — Backend API Katmanı PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Tüm katmanları birbirine bağlayan orkestrasyon merkezi. Mobil yüklemeleri alır, depolar, AI işleme görevlerini kuyruğa atar, sonuçları GIS'e yazdırır, onay konsoluna veri sağlar, kimlik doğrulaması yapar. **Sistemin trafik polisi.**

## 2. Teknoloji
- **API:** Python + FastAPI (mevcut stack ile uyumlu, AI pipeline ile doğal entegrasyon).
- **Kuyruk:** Celery + Redis (ağır AI işini arka planda çalıştır, upload'ı bloklamadan).
- **Depolama (görüntü):** S3-uyumlu object storage (Cloudflare R2 / Backblaze B2 — düşük egress maliyeti; bkz. `06-infra-devops.md §3`).
- **Veritabanı:** PostgreSQL + PostGIS (04 ile ortak; bkz. `04-gis-data.md`).
- **Kimlik:** JWT tabanlı auth.

## 3. Sorumluluklar
1. Mobil'den kare + metadata al, görüntüyü object storage'a yaz.
2. Her kare için AI işleme görevini Celery kuyruğuna at.
3. AI'dan dönen `Detection[]`'ı al, GPS ile eşleyip koordinatlandır, PostGIS'e `InventoryItem` olarak yaz (durum: `pending`).
4. Onay konsoluna (05) bekleyen kayıtları serve et, onay/red kararlarını işle.
5. Final envanter katmanını rapor/WFS olarak dışa sun (04 ile birlikte).

## 4. Ana Endpoint'ler

### 4.1 Yükleme (← 01 Mobil)
- `POST /api/v1/sessions` → yeni sürüş oturumu, `session_id` döner.
- `POST /api/v1/frames` → multipart (görüntü + `CaptureFrame` JSON). Görüntüyü depolar, işleme görevini kuyruğa atar, `frame_id` döner.
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

## 6. Kimlik ve Roller (MVP — basit)
- **saha_kullanici:** sadece mobil upload yapabilir.
- **onaylayici (harita mühendisi):** onay konsoluna erişir.
- **admin:** her şey + export.

## 7. Katmanlar Arası Kontrat (özet)
- ← 01 Mobil: `CaptureFrame` + görüntü (§4.1).
- ↔ 02 AI: `frame_id`+görüntü gönderir, `Detection[]` alır (§5).
- ↔ 04 GIS: `InventoryItem` yazar/okur.
- ↔ 05 Onay: kuyruk serve eder, karar alır (§4.2).

## 8. Kapsam Dışı (MVP)
- Multi-tenant (çoklu kurum izolasyonu) — Faz 3.
- Gelişmiş rol/yetki yönetimi (RBAC) — MVP'de 3 rol yeterli.
- Rate limiting / API gateway — ölçekte.

## 9. Kabul Kriterleri
- [ ] Mobil'den gelen kare depolanıp işleme kuyruğuna giriyor.
- [ ] AI sonucu koordinatlanıp PostGIS'e `pending` olarak yazılıyor.
- [ ] Onay konsolu kuyruğu çekip karar gönderebiliyor.
- [ ] Onaylı envanter GeoJSON olarak export edilebiliyor.
