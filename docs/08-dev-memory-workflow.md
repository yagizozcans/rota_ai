# 08 — Geliştirme Belleği & Bakım İş Akışı (claude-mem)
**RotaAI** · Bağlı: `00-overview.md`

---

> **Durum: ÜRÜN DIŞI — geliştirme/bakım aracı.** Bu doküman bir ürün katmanı (01–07) tanımlamaz. RotaAI'yi *inşa ederken ve bakımını yaparken* kullanılan bir Claude Code eklentisini — **claude-mem** — iş akışımıza bağlar. Ürünün çalışma zamanına (runtime) hiçbir şey eklemez; koddan, container'lardan ve KVKK yüzeyinden ayrıdır.
>
> Kaynak: https://github.com/thedotmack/claude-mem

## 1. Amaç
RotaAI 4 fazlı, 7 katmanlı, haftalar–aylar süren bir yapım işi (bkz. `00-overview.md §5`). Bu tür uzun projelerde en büyük verimlilik kaybı **oturumlar arası bağlam kaybıdır**: her yeni Claude Code oturumu koddan ve PRD'lerden bağlamı yeniden türetmek zorunda kalır — hangi kararların neden verildiği, hangi katmanın nerede kaldığı, hangi tuzağa düşüldüğü unutulur.

**claude-mem** bu boşluğu kapatır: oturum boyunca yapılan işi otomatik yakalar, sıkıştırıp yerel bir belleğe yazar ve sonraki oturumlarda ilgili bağlamı geri getirir. Böylece "01 mobil katmanında offline kuyruk şemasını neden SQLite seçtik" gibi kararlar sonraki oturumda hazır gelir.

## 2. Ne Yapar / Nasıl Çalışır
- **Yaşam döngüsü hook'ları (5 adet):** `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`, `SessionEnd`. Bunlar Claude Code'a otomatik kurulur; elle müdahale gerekmez.
- **Worker servisi:** Bun üzerinde çalışan yerel bir HTTP API + web görüntüleyici (viewer) UI. Belleği yönetir ve arama uçları sunar.
- **Depolama:** SQLite (sessions, observations, summaries) + FTS5 tam-metin arama. Ek olarak **Chroma** vektör DB ile hibrit (anlamsal + anahtar kelime) arama.
- **MCP arama araçları (3 katmanlı iş akışı):**
  1. `search` — kompakt indeks döner (~50-100 token/sonuç),
  2. `timeline` — bir sonucun kronolojik çevresini gösterir,
  3. `get_observations` — ID ile tam detayı çeker.

  Önce filtrele, sonra çek → ~10x token tasarrufu.
- **Otomatik çalışır:** Yakalama arka planda; geliştiricinin bir şey yapması gerekmez.

## 3. Kurulum ve Yapılandırma
**Gereksinimler:** Node.js 20+, Bun, uv (paket yöneticisi), SQLite 3.

**Kurulum (bu repoda, bir kez):**
```bash
npx claude-mem install
```
Alternatif: Claude Code plugin marketplace üzerinden kurulum.

**RotaAI için yapılandırma kuralları:**
- **Bulut senkronu KAPALI.** claude-mem, `cmem.ai`'ye buluta yedekleme sunar. Bu proje KVKK hassasiyetli (bkz. `06-infra-devops.md §4`) olduğundan **cloud sync devre dışı bırakılır**; bellek yalnızca yerelde kalır.
- **`<private>` etiketi zorunlu disiplin.** Sırlar (JWT secret, DB parolası, R2/B2 access key, örnek plaka/yüz içeren test verisi yolu) bir mesajda geçecekse `<private>...</private>` içine alınır ki belleğe yazılmasın.
- **Bellek deposu `.gitignore`'a eklenir.** claude-mem'in yerel SQLite/Chroma verisi repoya commit'lenmez.

## 4. Bakım / Geliştirme İş Akışına Bağlanması
claude-mem'i katman ve faz bazlı çalışmaya şöyle örüyoruz:

| Ne zaman | Uygulama |
|----------|----------|
| **Oturum başı** | claude-mem `SessionStart`'ta ilgili geçmiş bağlamı otomatik enjekte eder. Geliştirici işe "kaldığımız yer neydi" diye sormadan başlar. |
| **Katman değiştirirken** | Yeni bir katmana geçmeden `search` ile o katmanın (ör. "04 GIS koordinat dönüşümü") önceki kararlarını çek. |
| **Karar verirken** | Mimari kararları (EPSG seçimi, tekilleştirme eşiği, güven eşiği 0.4) net cümlelerle yaz — bunlar `PostToolUse`/`Stop` ile yakalanıp gelecekte `get_observations` ile geri gelir. |
| **Hata/tuzak sonrası** | Çözülen bir bug'ı ("Celery retry idempotent değildi, çift InventoryItem yazıyordu") açıkça özetle; tekrar aynı tuzağa düşülmez. |
| **Faz sonu** | Faz kapanışında viewer UI'dan o fazın observation'larını gözden geçir → PRD kabul kriterleriyle (her katmanın §Kabul Kriterleri) karşılaştır. |

**Anthropic dosya-belleği ile ilişki:** Bu repoda ayrıca kalıcı bir dosya-belleği (`memory/` + `MEMORY.md`) mevcut. İş bölümü:
- **`memory/` (dosya-belleği):** İnsan-küratörlü, kalıcı gerçekler — kullanıcı tercihleri, proje kararları, referanslar. Az sayıda, elle onaylı.
- **claude-mem:** Otomatik, hacimli oturum geçmişi — "ne yaptık, ne denedik". Aranabilir çalışma günlüğü.

Kural: **kalıcı bir karar netleşince** claude-mem geçmişinden çıkarılıp `memory/`'ye tek-cümlelik gerçek olarak terfi ettirilir.

## 5. Ne İnşa Edilecek (build sırası)
PRD fazları *ürün olgunluğunu* sıralar; aşağıdaki sıra ise **en hızlı elle test edilebilir iskelete** ulaşmak için önerilen *geliştirme* sırasıdır. İkisi örtüşür ama aynı değildir: modelin doğruluğu üretim seviyesine gelmeden önce uçtan uca dikey dilimi ayağa kaldırırız.

| # | İnşa adımı | Katman(lar) | Neden bu sırada | "Bitti" sinyali |
|---|-----------|-------------|-----------------|-----------------|
| 1 | **Repo iskeleti + Docker Compose + boş PostGIS şeması** | 06, 04 | Herkesin `docker-compose up` ile aynı ortamı ayağa kaldırması. | `sessions/frames/detections/inventory_items` tabloları GIST indeksle ayakta. |
| 2 | **Backend upload + kuyruk (sahte AI)** | 03 | Kontratları (`CaptureFrame`, `Detection`, `InventoryItem`) gerçek kod haline getir; AI yerine rastgele bbox dönen stub. | Bir görüntü POST → S3'e yazılıyor → Celery task → `pending` InventoryItem düşüyor. |
| 3 | **Onay konsolu (minimum)** | 05 | Dikey dilimi göz ile kapat: harita + bbox + A/R/C kısayolları. | Sahte tespit onaylanıp haritada nokta olarak görünüyor. |
| 4 | **Mobil çekim (minimum)** | 01 | Gerçek saha verisi akışı: 5m tetik + GPS + offline kuyruk + upload. | 10 km sürüşte kareler doğru `session_id`+GPS ile backend'de. |
| 5 | **AI baseline — stub'ı gerçek modelle değiştir** | 02 | Faz 0'ın çekirdeği. Dikey dilim hazır olduğu için model geldiği an sistem "canlanır". | YOLO26-s Türkiye test görüntülerinde levhaları kabul edilebilir doğrulukla tespit ediyor + doğruluk raporu. |
| 6 | **GIS tekilleştirme + export** | 04 | 20 karede görünen tek levha = 1 kayıt; TUSAGA-Aktif/ITRF export. | GeoJSON QGIS'te doğru konumda; çift sayım makul. |
| 7 | **KVKK bulanıklaştırma + yedekleme** | 06, 02 | Pilot öncesi kamu zorunluluğu. | Plaka/yüz işleme hattında bulanıklaşıyor; günlük DB dump geri yükleme testli. |
| 8 | *(Faz 3)* Hasar modülü — feature flag arkasında | 07 | Çekirdek akış değişmeden `type: "damage"` ekler. | Bayrak açıkken hasar tespitleri kuyruğa düşüyor; kapalıyken çekirdek etkilenmiyor. |

**Anahtar ilke:** 1→4 arası, model üretim doğruluğuna gelmeden önce **sahte/küçük AI ile uçtan uca dikey dilim** kurulur. Böylece "çekim → AI → GIS → onay → harita" akışı Faz 0 bitmeden elle test edilebilir; model olgunlaştıkça sadece 5. adım güçlenir.

## 6. Kabul Kriterleri (bu iş akışı için)
- [ ] `npx claude-mem install` çalıştırıldı; 5 hook Claude Code'da aktif.
- [ ] Cloud sync (`cmem.ai`) kapalı; bellek yalnızca yerelde.
- [ ] Bellek deposu `.gitignore`'da; repoya sızmıyor.
- [ ] Sırlar `<private>` disiplini ile belleğe girmiyor.
- [ ] Yeni oturum başında önceki katman kararları otomatik/`search` ile geri geliyor.
- [ ] Kalıcı kararlar claude-mem'den `memory/`'ye terfi ediliyor.

## 7. İlgili Doküman
- Ana indeks ve fazlar: `00-overview.md`
- Altyapı/KVKK (bellek gizlilik kuralları buradan miras): `06-infra-devops.md`
