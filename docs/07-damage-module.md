# 07 — Yol Hasarı Tespiti Modülü (OPSİYONEL EKLENTİ) PRD
**RotaAI** · Bağlı: `00-overview.md` · Kardeş: `02-ai-pipeline.md`

---

> **Durum: MVP DIŞI.** Bu, çekirdek ürünün (varlık envanteri) üzerine sonradan eklenen opsiyonel bir modüldür. MVP'de geliştirilmez; Faz 3'te veya bir müşteri özel olarak talep ettiğinde devreye alınır. Ayrı bir PRD olmasının sebebi, çekirdek ürünü sade tutmak ve bu özelliği bağımsız olarak satılabilir/kapatılabilir kılmaktır.

## 1. Amaç
Yol yüzeyi bozulmalarını (çukur, çatlak, kenar bozulması, oturma/rutting) görüntüden tespit edip sınıflandıran ve şiddet skoruyla konumlandıran eklenti modül. Varlık envanteri pipeline'ıyla (02) aynı altyapıyı paylaşır ama ayrı model ve sınıf seti kullanır.

## 2. Neden Ayrı Modül?
- **Farklı alıcı ihtiyacı:** Bazı kurumlar sadece varlık envanteri ister (levha/bariyer sayımı), bazıları hasar da ister. Ayrı modül = ayrı fiyatlandırma, ayrı satış.
- **Farklı veri kaynağı:** Hasar için hazır açık veri seti bol (RDD2022 gibi); varlık için kendi verini toplaman gerekiyordu. Yani bu modül aslında daha hızlı kurulabilir — ama ürün odağı varlıkta olduğu için sonraya bırakıldı.
- **Bağımsız açılıp kapanabilir:** Backend'de bir bayrakla (feature flag) etkinleştirilir; kapalıyken çekirdek akışı hiç etkilemez.

## 3. Teknoloji
- **Model:** YOLO26-small (02 ile aynı altyapı, ayrı ağırlıklar). Hasar için hazır RDD2022 verisi mevcut olduğundan baseline hızlı kurulur.
- **Veri seti (hazır avantaj):** RDD2022 (47.420 çok-ülkeli yol fotoğrafı) veya Kaggle "Road Damage Dataset: Potholes, Cracks and Manholes" (YOLO formatında hazır). Referans implementasyon: `oracl4/RoadDamageDetection`.
- **Servis biçimi:** Backend Celery worker'ından çağrılan ikinci bir model çağrısı; aynı görüntü hem varlık hem (etkinse) hasar modelinden geçebilir.

## 4. Sınıflar (00-overview §4.4 damage)
`pothole`, `crack_longitudinal`, `crack_transverse`, `crack_alligator`, `edge_deterioration`, `rutting`.

## 5. Fonksiyonel Gereksinimler
- **Girdi:** görüntü + `frame_id` (02 ile aynı, `03-backend-api.md §5`).
- **Çıktı:** `Detection[]` (00-overview §4.2) ama `type: "damage"`. Backend bunu varlık tespitleriyle aynı şekilde koordinatlandırıp GIS'e yazar.
- **Şiddet (severity):** MVP-hasar için basit kural (bbox alanı + sınıf); kesin şiddet insan onayında (05) belirlenir.
- **Aynı sözleşme:** 02 ile birebir aynı `Detection` arayüzünü kullanır — yani backend, GIS ve onay konsolu bu modülü desteklemek için değişmez, sadece yeni sınıflar gelir.

## 6. Katmanlar Arası Kontrat
- **Girdi ← 03 Backend:** `frame_id` + görüntü (feature flag açıksa çağrılır).
- **Çıktı → 03 Backend:** `Detection[]` (`type: "damage"`).
- **Onay ← 05:** hasar tespitleri de aynı onay kuyruğuna düşer; onaylayıcı hasar sınıfı + şiddet atar.
- **GIS → 04:** hasar öğeleri de `inventory_items` tablosunda saklanır (`type` alanı ayırır); export'ta filtrelenebilir.

## 7. Kapsam Dışı
- Fiziksel derinlik/boyut ölçümü (mm hassasiyet — kamera ile yapılamaz; lazer/LiDAR gerekir).
- IRI (pürüzlülük endeksi) hesabı — ivmeölçer/özel sensör gerektirir, ayrı bir çalışma.

## 8. Kabul Kriterleri (modül devreye alınırsa)
- [ ] Feature flag açıldığında hasar tespitleri `type: "damage"` ile üretiliyor.
- [ ] Çekirdek varlık akışı, modül kapalıyken hiç etkilenmiyor.
- [ ] Hasar öğeleri onay kuyruğuna düşüp GIS'e yazılıyor, export'ta tipe göre filtreleniyor.
- [ ] RDD2022 baseline modeli Türkiye görüntülerinde kabul edilebilir hasar tespiti yapıyor.
