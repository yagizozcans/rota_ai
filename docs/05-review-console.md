# 05 — İnsan Onay Konsolu (Human-in-the-Loop) PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Harita mühendisinin AI tespitlerini hızlıca onaylayıp/reddedip/düzelttiği web arayüzü. Bu katman ürünün **rekabet farklılaştırıcısı**: çoğu rakip tam otomatik; RotaAI'nin insan onaylı süreci kamu ihalelerinde "sorumluluk kimde" sorusuna güvenli cevap verir (bkz. `../proje-taslagi.md §6`).

## 2. Teknoloji
- **React + Vite + Tailwind** (mevcut stack).
- Harita: **MapLibre GL JS** (açık kaynak, Mapbox alternatifi).
- Görüntü + bbox overlay için canvas/SVG.

## 3. Fonksiyonel Gereksinimler

### 3.1 Onay Kuyruğu
- Backend'den bekleyen `InventoryItem`'ları çeker (`GET /review/queue`, bkz. `03-backend-api.md §4.2`).
- Her öğe için: orijinal görüntü + AI'nin çizdiği bbox + önerilen sınıf + güven skoru gösterilir.
- Öğeler harita üzerinde de konumlanmış görünür (MapLibre).

### 3.2 Hızlı Tasdik Akışı
- **Hız kritik** — mühendis saatlerce bu ekranda olacak. Klavye kısayolları zorunlu:
  - `A` = onayla (approve)
  - `R` = reddet (reject)
  - `C` = düzelt (sınıf/severity değiştir)
  - `→` / `←` = sonraki/önceki öğe
- Düzeltmede: sınıfı taksonomiden (00-overview §4.4) seç, severity ata (`low/medium/high`).

### 3.3 Toplu İşlem (opsiyonel MVP+)
- Yüksek güvenli (>0.9) tespitleri toplu onaylama seçeneği (mühendis hızlanır, riskliye odaklanır).

### 3.4 Geri Besleme
- Reddedilen/düzeltilen öğeler `training_feedback`'e yazılır (bkz. `04-gis-data.md §7` → `02-ai-pipeline.md §3 active learning`).

## 4. Katmanlar Arası Kontrat
- ← 03 Backend: onay kuyruğu (`InventoryItem` + görüntü + bbox).
- → 03 Backend: karar (`approved/rejected/corrected` + düzeltme).
- Dolaylı → 02 AI: reddedilen örnekler yeniden eğitime döner.

## 5. UX İlkeleri
- Tek ekranda karar verilebilmeli (görüntü + harita + aksiyon aynı görünümde).
- Onaylanan öğe kuyruktan anında düşer, sıradaki gelir (kesintisiz akış).
- Durum göstergesi: "kuyrukta X öğe kaldı, bugün Y onaylandı".

## 6. Kapsam Dışı (MVP)
- Çok kullanıcılı eşzamanlı onay / iş yükü dağıtımı (Faz 3).
- Denetim izi (audit log) detayı — MVP'de temel `reviewer_id` + `reviewed_at` yeterli.
- Mobil onay arayüzü (masaüstü MVP'de yeterli).

## 7. Kabul Kriterleri
- [ ] Kuyruk yükleniyor, her öğe görüntü + bbox + öneri ile gösteriliyor.
- [ ] Klavye kısayollarıyla saniyeler içinde onay/red/düzelt yapılabiliyor.
- [ ] Karar backend'e yazılıp öğe kuyruktan düşüyor.
- [ ] Reddedilen örnekler yeniden eğitim setine gidiyor.
- [ ] Onaylı öğeler haritada doğru konumda görünüyor.
