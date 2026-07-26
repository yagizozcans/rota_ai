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

### 3.6 Çekim Ekranı Göstergeleri (Offline HUD)
Sürüş sırasında operatör ekranında, canlı kamera görüntüsünün üzerine hafif bir bilgi katmanı (overlay) bindirilir. Amaç: saha koşullarında (özellikle offline, sinyalsiz bölgelerde) cihazın ve çekimin durumunu **tek bakışta** görebilmek. Bu göstergeler yalnızca bilgilendirmedir, AI değildir.

- **Kalan kayıt süresi (depolamaya göre):** Cihazın boş depolama alanı ÷ (kare üretim hızı × ortalama JPEG kare boyutu) formülüyle tahmini kayıt süresi **saat** cinsinden gösterilir (ör. `~6.5 saat`). Ortalama kare boyutu son çekilen karelerin hareketli ortalamasından güncellenir. Kalan süre bir eşiğin (ör. < 30 dk) altına düşünce gösterge kırmızıya döner ve operatörü uyarır — böylece depolama dolup çekim sessizce durmaz.
- **Hava sıcaklığı (°C):** Öncelik cihazın ortam sıcaklık sensörü; yoksa online iken çekilip cache'lenen en yakın istasyon değeri. Cache 60 dakikadan eskiyse değer soluk gösterilir (bayat). Hiçbir kaynak yoksa gösterge "~" olarak, HUD'un pasif renginde görünür — boş bırakılmaz, sıfır/placeholder sayı gösterilmez. Bu durumda kare metadata'sına weather_temp_c alanı hiç yazılmaz.
- **GPS doğruluğu (m):** Anlık GPS accuracy metre cinsinden (§3.2 metadata'sıyla aynı değer). Renk kodlu: yeşil `< 10m`, sarı `10–20m`, kırmızı `> 20m` — §3.5'teki 20m eşiğiyle tutarlı, sürücü kötü sinyalde yavaşlaması/beklemesi gerektiğini anlar.
- **Dosya yolu (sol alt köşe):** Aktif oturumun karelerinin yazıldığı yerel depolama yolu (SQLite + dosya sistemi kök dizini), sol alt köşede küçük ve soluk bir metin (`monospace`) olarak gösterilir (ör. `/data/rotaai/sessions/<session_id>/`). Sahada veri nereye kaydediliyor sorusunu ve olası hata ayıklamayı tek bakışta çözer.

### 3.7 Ekran Yönü ve Çekim Kontrolleri (UI)
- **Yatay (landscape) zorunlu:** Uygulama yalnızca yatay yönde çalışır — telefon araca yatay monte edilir. Dikey yön kilitli, otomatik döndürme devre dışı. Tüm yerleşim (HUD göstergeleri §3.6, kontrol butonları) yataya göre tasarlanır.
- Ekranın **sağ tarafında dikey dizili 3 büyük buton** bulunur. Sürüş sırasında, gerekirse eldivenle, hızlı ve şaşmadan basılabilmesi için geniş dokunma hedefi (büyük) olarak tasarlanır:
  1. **Kayıt (Video):** Aslında video değildir — §3.2'deki mesafe bazlı (her ~5 metrede bir kare) otomatik foto çekimini **başlatır/durdurur**. Operatöre bir video kaydı gibi sunulur: aktifken yanıp sönen kırmızı bir "REC" noktası görünür (sayaç/süre yok). Bu, "Sürüşü Başlat/Bitir" oturumunun (§3.1) sahadaki asıl kontrolüdür.
  2. **Foto:** Otomatik aralıktan bağımsız, o anki noktada **tek bir manuel kare** çeker (operatörün özellikle kaydetmek istediği bir tabela/hasar için). Aynı `session_id` ve metadata ile kaydedilir.
  3. **Öznitelik (Attributes):** Şimdilik yer tutucu (placeholder) — buton yerleşimde bulunur ama davranışı henüz tanımlı değil. İşlevi ileride belirlenecek.

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
- [ ] Çekim ekranında kalan kayıt süresi (saat), hava sıcaklığı, GPS doğruluğu ve dosya yolu offline'da da doğru gösteriliyor.
- [ ] Boş depolama azaldıkça kalan süre göstergesi düşüyor ve eşik altında uyarı veriyor.
- [ ] GPS doğruluğu göstergesi 10m / 20m eşiklerinde renk değiştiriyor.
- [ ] Uygulama yatay yönde kilitli; dikeyde açılmıyor/döndürülmüyor.
- [ ] Sağdaki 3 büyük buton (Kayıt / Foto / Öznitelik) yerleşimde görünüyor; Kayıt aktifken yanıp sönen REC noktası görünüyor. (Öznitelik şimdilik yer tutucu.)
- [ ] Manuel "Foto" karesi ilgili konum/kare ile backend'de görünüyor.
