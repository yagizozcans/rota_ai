# 04 — GIS & Veri Katmanı PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Tespit edilen envanter öğelerini mekansal olarak depolamak, koordinat sistemleri arasında dönüştürmek ve kurumların kullanabileceği standart GIS çıktıları üretmek. Kamu kurumları verinin **kendi koordinat sisteminde ve GIS formatında** gelmesini bekler — bu katman o güveni sağlar.

## 2. Teknoloji
- **PostgreSQL + PostGIS** (03 Backend ile ortak veritabanı).
- Koordinat dönüşümü: PostGIS `ST_Transform` + doğru EPSG kodları.
- Çıktı servisi: GeoServer veya `pg_featureserv` (WFS/WMS için); MVP'de basit GeoJSON export yeterli, WFS Faz 3.

## 3. Koordinat Sistemleri
- **Toplama:** GPS ham verisi WGS84 (EPSG:4326) — mobil'den böyle gelir.
- **Kurum çıktısı:** Türkiye'de resmi sistem **TUSAGA-Aktif / ITRF** tabanlı. UTM dilimlerine göre uygun EPSG (ör. ITRF96 TM30/TM33/TM36 dilimleri) seçilir.
- Eski projelerle uyum için gerekirse ED50 dönüşümü de desteklenir.
- **Kural:** ham veri her zaman WGS84 saklanır; dönüşüm çıktı anında (`ST_Transform`) yapılır — böylece tek kaynak veri, çoklu hedef sistem.

## 4. Veri Modeli (ana tablolar)
- `organizations` — kiracılar (id, ad, tür: belediye/KGM/özel). Kiracı anahtarının kök tablosu (bkz. `00-overview §4.5`).
- `sessions` — sürüş oturumları (id, **org_id**, cihaz, başlangıç/bitiş, kullanıcı).
- `frames` — çekilen kareler (id, **org_id**, session_id, geom POINT, heading, timestamp, image_ref, gps_accuracy).
- `detections` — AI tespitleri (id, **org_id**, frame_id, class, bbox, confidence, model_version).
- `inventory_items` — koordinatlandırılmış envanter (id, **org_id**, detection_id, geom, class, severity, review_status, reviewer_id, reviewed_at) → 00-overview §4.3.
- `training_feedback` — reddedilen/düzeltilen örnekler (id, **org_id**, …) — 02 active learning'e besleme.

Tüm geometrik alanlar PostGIS `geometry(Point, 4326)`; mekansal indeks (GIST) zorunlu.

**Kiracı izolasyonu:** Kiracıya bağlı her tabloda `org_id` sütunu bulunur ve **satır düzeyi güvenlik (Row-Level Security)** ile oturumdaki `org_id`'ye göre filtrelenir — böylece bir kurumun sorgusu diğerinin verisine erişemez (bkz. `00-overview §4.5`). `org_id` üzerine indeks önerilir. Büyük/hassas müşteri ölçekte ayrı DB'ye terfi edebilir (ortak şema → ayrı instance).

## 5. Çıktı / Export
- **GeoJSON export** (MVP): onaylı `inventory_items` filtrelenip indirilebilir.
- **Shapefile** (kurumlar hâlâ yaygın kullanıyor): opsiyonel dönüştürme.
- **WFS/WMS** (Faz 3): kurumun kendi GIS'ine (ArcGIS/QGIS) canlı bağlantı.
- Export her zaman kurumun istediği koordinat sisteminde (§3) sunulur.

## 6. Mekansal İşlemler (MVP)
- Nokta bazlı envanter (her tespit bir POINT). Yol segmenti/güzergah bazlı toplama Faz 2+.
- Aynı varlığın (ör. bir levha ardışık birçok karede görünür) tekrar tespiti için tekilleştirme (yakınlık + sınıf eşleşmesi + yön) — çift sayımı azaltır. Bu, varlık envanterinde kritik: 20 karede görünen tek levha, 1 envanter kaydı olmalı.

## 7. Katmanlar Arası Kontrat
- ← 03 Backend: `InventoryItem` yazar, koordinat dönüşümü ister.
- ↔ 05 Onay: onay durumunu günceller (`review_status`).
- → kurum: GeoJSON/Shapefile/WFS export.
- → 02 AI: `training_feedback` (reddedilen örnekler).

## 8. Kapsam Dışı (MVP)
- Yol segmenti/linear referencing (nokta bazlı yeterli).
- Canlı WFS (Faz 3).
- Zaman serisi / envanter değişim takibi (yıllar arası karşılaştırma) — Faz 3.

## 9. Kabul Kriterleri
- [ ] Tespitler WGS84 POINT olarak PostGIS'e yazılıyor, mekansal indeks çalışıyor.
- [ ] Her kayıt `org_id` taşıyor; RLS ile bir kiracının sorgusu başka kiracının verisini döndürmüyor.
- [ ] Export, kurumun TUSAGA-Aktif/ITRF sisteminde doğru koordinatla çıkıyor.
- [ ] Onaylı envanter GeoJSON olarak indirilip QGIS'te doğru konumda açılıyor.
- [ ] Ardışık kare çift sayımı makul ölçüde tekilleştiriliyor.
