# 02 — AI / Computer Vision Pipeline PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Backend'den gelen bir yol görüntüsünü işleyip, üzerindeki **yol varlıklarını** (trafik levhaları, panolar, bariyerler, aydınlatma direkleri, yatay işaretlemeler) tespit edip sınıflandıran ve her tespit için konum (bbox) + sınıf + güven skoru üreten servis. **Bu, ürünün çekirdek değer motorudur — MVP'nin ana çıktısı varlık envanteridir.**

> Not: Yol hasarı (çukur/çatlak) tespiti bu katmanın kapsamında DEĞİLDİR. O, opsiyonel bir eklenti modüldür — bkz. `07-damage-module.md`. Bu iki pipeline aynı YOLO26 altyapısını paylaşır ama ayrı modeller/ağırlıklar ve ayrı sınıf setleri kullanır.

## 2. Teknoloji
- **Model:** YOLO26-small (`yolo26s.pt`, Ultralytics) — tek pipeline'da tespit + sınıflandırma. YOLO26'nın küçük-nesne iyileştirmeleri (ProgLoss + STAL) uzaktaki/küçük levhaların tespitinde avantaj sağlar; NMS-free uçtan uca çıkarım deployment'ı basitleştirir. Veri seti formatı YOLOv8/YOLO11 ile uyumlu olduğundan gerekirse tek satırla bu sürümlere dönülebilir.
- **Framework:** PyTorch + Ultralytics.
- **Servis biçimi:** Backend'in Celery worker'ı içinden çağrılan Python modülü (bkz. `03-backend-api.md §5`). MVP'de ayrı mikroservis değil; ölçekte ayrı inference worker'a çıkarılır.

## 3. Model Stratejisi (fazlı)

### Faz 0 — Baseline levha tespiti
- **Veri seti:** Levha tespiti için hazır tek-ülke veri setleri sınırlı olduğundan, **kendi etiketli verini toplamak** gerekir. Yaklaşım:
  - Türkiye'de saha çekimi (kendi imkanlarınla) + etiketleme, **KGM Trafik İşaretleri El Kitabı**'ndaki sınıflara göre.
  - Hızlandırıcı: açık kaynak trafik levhası veri setleri (ör. GTSRB — Alman levha seti, Mapillary Traffic Sign Dataset) ile ön-eğitim (pretraining), sonra Türkiye verisiyle fine-tune (transfer learning).
  - Referans metodoloji: **İTÜ 2024 doktora tezi** — KGM İstanbul 1. Bölge D-100 pilotu, 23 levha tipi, Faster-RCNN, ~18.000 fotoğrafla eğitim. Bu tez birebir yol haritası olarak kullanılabilir; YOLO26 karşılığı uygulanır.
- Çıktı: sınırlı sayıda levha sınıfında çalışan bir baseline model + **doğruluk raporu** (satış materyali — precision/recall/mAP metrikleriyle).

### Faz 1 — MVP varlık envanteri
- **Çekirdek sınıflar** (00-overview §4.4 asset):
  - `sign_*` — trafik levhaları (uyarı, düzenleme/yasaklama, bilgi/yönlendirme; KGM El Kitabı alt tiplerine göre)
  - `barrier` / `guardrail` — bariyer / otokorkuluk
  - `light_pole` — aydınlatma direği
  - `road_marking` — yatay işaretleme (şerit, yaya geçidi vb.)
  - `traffic_signal` — trafik ışığı
- MVP'de önce en yüksek değerli ve en sık sınıflarla başla (levhalar + bariyer); nadir sınıflar Faz 2'ye bırakılabilir.

### Faz 2 — Genişletme ve ince ayar
- Varlık sınıflarını genişlet (nadir levha tipleri, ek mobilya: korkuluk, refüj, kilometre taşı, sinyalizasyon dolabı vb.).
- Active learning: onay konsolunda (05) reddedilen/düzeltilen örnekler yeniden eğitim setine döner → model yerel veriyle iyileşir.
- KGM/kurum şartnamelerindeki sınıf ayrımlarına tam uyum.

## 4. Fonksiyonel Gereksinimler
- **Girdi:** görüntü dosyası + `frame_id` (backend'den, bkz. `03-backend-api.md §5`).
- **İşlem:** görüntüyü modele ver → tespitleri al → her tespit için `Detection` nesnesi üret (00-overview §4.2), `type: "asset"`.
- **Güven eşiği:** yapılandırılabilir (varsayılan 0.4). Altındakiler elenir ya da "düşük güven" işaretiyle onaya bırakılır (karar 05'te).
- **Aynı varlığın çoklu karede tekrarı:** bir levha ardışık birçok karede görünür; backend/GIS tarafında tekilleştirilir (bkz. `04-gis-data.md §6`). AI her kareyi bağımsız işler, tekilleştirme AI'nın işi değildir.
- **Model versiyonlama:** her tespit `model_version` taşır.

## 5. Eğitim Altyapısı
- Başlangıçta kiralık GPU: Google Colab Pro / RunPod / Lambda Labs (sermaye gerektirmez).
- Etiketleme aracı: CVAT veya Roboflow (levha bbox + sınıf etiketleme).
- Model ağırlıkları versiyonlanır (dosya + versiyon etiketi; ölçekte MLflow/DVC).
- Yeniden eğitim tetikleyicisi: onay konsolundan yeterli düzeltilmiş örnek birikince periyodik retrain.

## 6. Katmanlar Arası Kontrat
- **Girdi ← 03 Backend:** `frame_id` + görüntü yolu (Celery task).
- **Çıktı → 03 Backend:** `Detection[]` (00-overview §4.2, `type: "asset"`), backend koordinatlandırıp 04 GIS'e yazar.
- **Geri besleme ← 05 Onay:** reddedilen/düzeltilen tespitler → yeniden eğitim seti (active learning).
- **Kardeş modül:** `07-damage-module.md` aynı arayüzü (`Detection` sözleşmesi) `type: "damage"` ile kullanır; backend her iki tipi de aynı şekilde işleyebilir.

## 7. Kapsam Dışı (MVP)
- **Yol hasarı tespiti** (bkz. `07-damage-module.md`).
- Edge/cihaz üstü inference (Faz 3).
- Piksel bazlı segmentasyon (MVP bbox yeterli).
- Levhanın üzerindeki metni okuma / OCR (ileride; MVP sınıf tespiti yeterli).
- Fiziksel boyut ölçümü (kamera tabanlı sistemler mm hassasiyet vermez; konum + sınıf + varlık sayımı yeterli).

## 8. Kabul Kriterleri
- [ ] Bir görüntü verildiğinde `type: "asset"` içeren standart `Detection[]` çıktısı dönüyor.
- [ ] Baseline model Türkiye test görüntülerinde çekirdek levha sınıflarını kabul edilebilir doğrulukla tespit ediyor (doğruluk raporu üretildi: precision/recall/mAP).
- [ ] Güven eşiği yapılandırılabilir ve `model_version` her tespitte mevcut.
- [ ] Reddedilen örnekler yeniden eğitim setine yazılabiliyor.
- [ ] Aynı görüntüdeki birden fazla varlık ayrı ayrı tespit ediliyor.
