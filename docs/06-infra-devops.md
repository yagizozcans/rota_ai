# 06 — Altyapı / DevOps / KVKK PRD
**RotaAI MVP** · Bağlı: `00-overview.md`

---

## 1. Amaç
Tüm katmanların üzerinde çalıştığı altyapıyı, deployment'ı, depolamayı ve yasal uyumu (KVKK) tanımlar. MVP'de **düşük maliyetli, tek sunucu** hedeflenir (bootstrapped strateji — bkz. `../proje-taslagi.md §7`).

## 2. Deployment Mimarisi (MVP)
- **Tek VPS** (Hetzner / DigitalOcean — Türkiye'den erişimi iyi, düşük maliyet).
- **Docker Compose** ile tek sunucuda: FastAPI (03) + PostGIS (04) + Redis + Celery worker (02+03).
- Onay konsolu (05) statik build olarak aynı sunucudan veya CDN'den servis edilir.
- Ölçekte (KGM gibi büyük müşteride): AI inference ayrı GPU worker havuzuna, DB managed servise, AWS/GCP'ye taşınır.

## 3. Depolama
- Görüntüler: S3-uyumlu object storage — **Cloudflare R2 veya Backblaze B2** (egress ücreti AWS S3'ten düşük, hacimli görüntü için önemli).
- Veritabanı: PostgreSQL+PostGIS (VPS üstünde MVP; managed Faz 3).
- Yedekleme: günlük DB dump + object storage versiyonlama.

## 4. KVKK / Veri Gizliliği (kamu için zorunlu)
- **Plaka + yüz otomatik bulanıklaştırma** — MVP'ye dahil. Görüntüler işlenirken kişisel veri anonimleştirilir (RoadAI'nin standart uygulaması). Bu, kamu ihalesinde sorulacak ilk sorulardan biri.
- Veri Türkiye'de/AB'de tutulmalı tercih edilir (kamu hassasiyeti) — VPS/storage bölge seçimi buna göre.
- Erişim logları + rol bazlı erişim (03 §6).
- Veri saklama politikası: ham görüntüler işlendikten sonra bir süre sonra silinebilir/arşivlenir (kurumla anlaşmaya göre).

## 5. CI/CD (MVP — hafif)
- Git tabanlı (GitHub). Basit pipeline: test → Docker build → VPS'e deploy.
- Model ağırlıkları ayrı versiyonlanır (bkz. `02-ai-pipeline.md §5`).

## 6. İzleme
- Temel: uygulama logları + hata takibi (ör. Sentry ücretsiz tier).
- Kuyruk sağlığı (Celery/Redis) izlenir — işleme birikirse görünür olsun.

## 7. Maliyet Notu (bootstrapped)
- MVP aylık altyapı hedefi: düşük (tek VPS + object storage + kiralık GPU sadece eğitim anında).
- Sabit büyük maliyet yok; müşteri geldikçe ölçeklenir.

## 8. Katmanlar Arası Rol
- Tüm katmanları (01-05) barındırır ve birbirine bağlar.
- Depolama kontratı: 01 yükler, 02 okur, 03 yazar/yönetir.
- KVKK katmanı 02 (bulanıklaştırma) ve 04 (veri saklama) ile kesişir.

## 9. Kapsam Dışı (MVP)
- Yüksek erişilebilirlik / çoklu bölge (Faz 3).
- Otomatik yatay ölçekleme (Faz 3).
- Managed Kubernetes (MVP'de Docker Compose yeterli).

## 10. Kabul Kriterleri
- [ ] Tüm servisler tek `docker-compose up` ile ayağa kalkıyor.
- [ ] Görüntüler object storage'a yazılıp AI worker tarafından okunuyor.
- [ ] Plaka/yüz bulanıklaştırma işleme hattında çalışıyor.
- [ ] Günlük yedekleme alınıyor, geri yükleme test edildi.
