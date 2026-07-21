# RotaAI — MVP Ürün Gereksinim Dokümanları (PRD)
**Ana Genel Bakış ve Katman Haritası**

*Çalışma adı: RotaAI — Yapay Zeka Destekli Yol Envanteri ve Bakım Karar Destek Platformu*
*Versiyon: 0.1 (MVP) — Bu doküman tüm katman PRD'lerini bağlayan ana indekstir.*

---

## 1. Amaç

Bu doküman seti, RotaAI'nin MVP'sini oluşturan tüm teknik katmanların gereksinimlerini tanımlar. Her katmanın kendi PRD dosyası vardır ama hepsi tek bir uçtan uca veri akışında birlikte çalışır. Bu dosya, katmanlar arası **kontratları** (birbirlerine ne gönderdiklerini, ne beklediklerini) tanımlar — diğer PRD'ler bu kontratlara referans verir.

## 2. Katman Haritası

| No | Katman | Dosya | Ana Teknoloji | Sorumluluğu |
|----|--------|-------|---------------|-------------|
| 01 | Mobil Çekim | `01-mobile-capture.md` | React Native | Sahada foto + GPS + metadata toplar, backend'e yükler |
| 02 | AI Pipeline | `02-ai-pipeline.md` | YOLO26-s / Python | **Yol varlığı (levha, pano, bariyer, direk, işaretleme) tespiti + sınıflandırma — MVP ÇEKİRDEĞİ** |
| 03 | Backend API | `03-backend-api.md` | FastAPI + Celery + Redis | Orkestrasyon, kuyruk, kimlik doğrulama, veri akışı |
| 04 | GIS & Veri | `04-gis-data.md` | PostgreSQL + PostGIS | Koordinat dönüşümü, mekansal veri, GIS çıktı (WFS) |
| 05 | Onay Konsolu | `05-review-console.md` | React + MapLibre | İnsan onaylı tasdik (human-in-the-loop) |
| 06 | Altyapı/DevOps | `06-infra-devops.md` | Docker + VPS | Deployment, depolama, KVKK, güvenlik |
| 07 | Yol Hasarı Modülü *(opsiyonel)* | `07-damage-module.md` | YOLO26-s / Python | Çukur/çatlak tespiti — **MVP DIŞI, eklenti modül** |

## 3. Uçtan Uca Veri Akışı

```
[01 MOBİL]  saha aracı foto + GPS toplar
     │  (HTTP upload: görüntü dosyası + JSON metadata)
     ▼
[03 BACKEND]  yüklemeyi alır, S3'e ({org_id}/… ön-ekli) yazar, işleme görevini kuyruğa atar
     │  (Celery task: image_id + storage_path)
     ▼
[02 AI]  YOLO26-s görüntüyü işler → tespit listesi (bbox + sınıf + güven skoru)
     │  (JSON: detections[])
     ▼
[03 BACKEND]  tespitleri alır, koordinatla eşler
     │  (detection + GPS → mekansal kayıt)
     ▼
[04 GIS]  PostGIS'e yazar, koordinat sistemine dönüştürür (WGS84 → TUSAGA-Aktif)
     │  (durum: "onay bekliyor")
     ▼
[05 ONAY]  harita mühendisi ekranda tasdikler (onay / red / düzelt)
     │  onaylananlar → final katman | reddedilenler → yeniden eğitim seti
     ▼
[04 GIS]  final envanter katmanı → kuruma WFS/rapor olarak sunulur
     │  reddedilen örnekler → [02 AI] active learning döngüsüne geri besleme
     └──────────────────────────────────────────────┘
```

## 4. Katmanlar Arası Ortak Kontratlar

Bu veri yapıları tüm katmanlar tarafından paylaşılır. Herhangi bir katman PRD'si bunlara "bkz. 00-overview §4" diye referans verir.

### 4.1 `CaptureFrame` (Mobil → Backend)
Sahada çekilen tek bir kare.
```json
{
  "frame_id": "uuid",
  "org_id": "uuid",              // kiracı (kurum/şirket) — bkz. §4.5
  "session_id": "uuid",          // bir sürüş oturumu
  "device_id": "string",
  "timestamp": "ISO8601",
  "gps": { "lat": 41.0, "lon": 28.9, "accuracy_m": 3.2, "speed_kmh": 45 },
  "heading_deg": 275.0,          // aracın yönü (gyroscope)
  "image_ref": "storage_path"    // yüklenen görüntünün yolu (org_id ile ön-ekli, §4.5)
}
```
> Not: `org_id`, cihaz login'inde alınan token'dan da türetilebilir; kare gövdesinde taşınması izleme/hata ayıklamayı kolaylaştırır. Backend her durumda token'daki `org_id`'yi yetki kaynağı kabul eder (istemciye güvenmez).
> `image_ref`, istemci tarafından deterministik anahtar (`{org_id}/{session_id}/{frame_id}.jpg`) olarak doldurulur ama **tavsiye niteliğindedir**: backend anahtarı token'ın `org_id`'si + id'lerden yeniden hesaplar ve yetkili olandır; uyuşmazlıkta kendi anahtarıyla yazıp uyarı loglar, yüklemeyi reddetmez (plan Q4). `frame_id` ve `session_id` istemci tarafından üretilir (plan Q1).

### 4.2 `Detection` (AI → Backend)
AI'nin bir kare üzerinde bulduğu tek bir nesne.
```json
{
  "detection_id": "uuid",
  "frame_id": "uuid",
  "type": "asset | damage",     // MVP: sadece "asset"
  "class": "sign_A1 | sign_B2 | barrier | light_pole | road_marking | ...",
  "bbox": [x, y, w, h],          // görüntü piksel koordinatı
  "confidence": 0.87,            // 0-1
  "model_version": "v0.1-rdd2022"
}
```

### 4.3 `InventoryItem` (Backend/GIS → Onay → Final)
Koordinatlandırılmış, onay sürecindeki envanter kaydı.
```json
{
  "item_id": "uuid",
  "org_id": "uuid",              // kiracı — kare/tespit zincirinden taşınır (§4.5)
  "detection_id": "uuid",
  "geom": "POINT(...)",          // PostGIS geometrisi
  "srid_source": 4326,           // WGS84
  "class": "pothole",
  "severity": "low | medium | high | null",
  "review_status": "pending | approved | rejected | corrected",
  "reviewer_id": "uuid | null",
  "reviewed_at": "ISO8601 | null"
}
```

### 4.4 Sınıf Taksonomisi (ortak sözlük)
- **Varlık (asset) — MVP ÇEKİRDEĞİ:** KGM Trafik İşaretleri El Kitabı'na göre levha/pano sınıfları (`sign_*`: uyarı, düzenleme, bilgi levhaları), `barrier` (bariyer/otokorkuluk), `light_pole` (aydınlatma direği), `road_marking` (yatay işaretleme), `guardrail`, `traffic_signal`. Varlık tespiti ve konumlandırma MVP'nin ana değeridir (bkz. `02-ai-pipeline.md`).
- **Hasar (damage) — OPSİYONEL MODÜL:** `pothole`, `crack_longitudinal`, `crack_transverse`, `crack_alligator`, `edge_deterioration`, `rutting`. MVP dışıdır, ayrı bir eklenti modülüyle gelir (bkz. `07-damage-module.md`).
- `type` alanı `asset | damage` olarak ayrımı taşır; MVP'de yalnızca `asset` üretilir.

### 4.5 Kiracı (Tenant) İzolasyonu — `org_id`
Her veri parçası bir **kiracıya** (kurum/şirket, ör. bir belediye veya KGM bölge müdürlüğü) aittir. MVP'de kiracı **anahtarı** baştan gömülür; kiracı **yönetimi** (self-servis onboarding, kurum admin paneli, faturalama) Faz 3'e kalır — bkz. §6. Amaç: ileride pahalı veri göçünden (her nesneyi yeniden yollamak, her satıra sütun eklemek) kaçınmak ve kamu için **KVKK bazında kurum verisi ayrımını** baştan sağlamak.

- **Model:** her `user`/`device` tek bir `org`'a bağlıdır. `org_id`, `CaptureFrame → Detection → InventoryItem` zinciri boyunca taşınır. Yetki kaynağı her zaman login token'ındaki `org_id`'dir (istemciye güvenilmez).
- **Object storage (görüntü):** tek kova, **kiracı ön-ekli yol** → `{org_id}/{session_id}/{frame_id}.jpg`. Büyük/hassas müşteri için ölçekte ayrı kova opsiyonu (bkz. `06 §3`).
- **Veritabanı (PostGIS):** ortak şema + kiracıya bağlı her tabloda `org_id` sütunu; **satır düzeyi güvenlik (RLS)** ile sorgular kiracılar arası sızmaz. Büyük müşteri ölçekte ayrı DB'ye terfi edebilir (bkz. `04 §4`).

## 5. MVP Kapsamı ve Fazlar

| Faz | Süre | Kapsam | İlgili PRD'ler |
|-----|------|--------|----------------|
| **0 — Kanıt** | 3-5 hafta | Levha veri seti topla/etiketle (KGM El Kitabı sınıfları), YOLO26-small ile baseline levha tespiti, birkaç km test, doğruluk raporu | 02 |
| **1 — MVP** | 6-10 hafta | Uçtan uca varlık envanteri: çekim → AI (levha/varlık) → GIS → onay, tek bölge pilotu | 01,02,03,04,05,06 |
| **2 — Özelleştirme** | Paralel | Varlık sınıflarını genişlet (bariyer/direk/işaretleme), KGM standardına ince ayar | 02,04 |
| **3 — Ölçek** | Pilot sonrası | Çoklu müşteri, WFS entegrasyonu, **yol hasarı modülü ekle**, hava durumu modülü | 03,04,07 |

**MVP "bitti" tanımı:** Bir saha aracıyla ~10 km sürülüp, çekilen görüntülerden yol varlıkları (levha, pano, bariyer, direk, işaretleme) otomatik tespit edilip konumlandırılıp, bir harita mühendisi onay konsolundan tasdikleyip, sonuç bir harita üzerinde varlık envanteri katmanı olarak görüntülenebiliyorsa MVP tamamdır.

## 6. Kapsam Dışı (MVP'de YOK)
- **Yol hasarı tespiti** (çukur/çatlak) — opsiyonel eklenti modül, ayrı PRD (`07-damage-module.md`), Faz 3'te eklenir
- Gerçek zamanlı/edge inference (her şey buluta yüklenip işlenir)
- Hava durumu / kışlık bakım modülü (Faz 3)
- Çoklu kurum/kiracı **yönetimi** (self-servis onboarding, kurum admin paneli, faturalama) — Faz 3. *Not: kiracı **anahtarı** (`org_id`) ve izolasyon (storage ön-eki + DB RLS) MVP'ye dahildir — bkz. §4.5.*
- Mobil uygulamada canlı AI (sadece toplama yapar)

## 7. İlgili Doküman
Proje iş taslağı (pazar, rekabet, GTM): `../proje-taslagi.md`
