# Akış v4.1.0 — Kalite ve Kabul Planı

## 1. İş yükü puanı ve veri uyumluluğu

- Görev ve düzeltici aksiyon puan listesi yalnız `1, 2, 3, 5, 8, 13` değerlerini sunar.
- Türkçe ve İngilizce rehber metinleri doğru aralıkları açıklar; uzun metin dar ekranlarda taşmaz.
- 13 puanlı görev oluşturma, düzenleme, kopyalama, Save → yeniden açma ve puan bazlı burn-up hesaplamasında korunur.
- Eski Save dosyaları değişmeden açılır; geçersiz ve 13 üzerindeki değerler güvenli varsayılana döner.

## 2. Proje ve portföy sorun özeti

- Yeni açık sorun ilgili projenin panelinde ve aktif portföy özetinde anında görünür.
- Kritik/yüksek, doğrulamada ve takip tarihi geçmiş sayaçları yalnız açık sorunlardan hesaplanır.
- Önem, gecikmiş takip ve son güncellenme sırası tutarlıdır; satır doğru sorun ayrıntısını açar.
- Sorun kapatıldığında açık listelerden ve sayaçlardan çıkar.
- Portföy özeti arşivlenmiş, tamamlanmış veya teslim edilmiş projeleri içermez; proje paneli yalnız kendi projesini gösterir.
- Hiç açık sorun olmadığında anlaşılır boş durum görünür.

## 3. Önümüzdeki 7 Gün

- Bugün ve sonraki altı takvim günü dahildir; sekizinci tarih dahil değildir.
- Toplantı, planlı iş, not ve tamamlanmamış görev son tarihleri tarih/saat sırasıyla birleşir.
- Aynı gün içindeki saatli etkinlikler doğru sıralanır; saatsiz kayıtlar anlaşılır biçimde gösterilir.
- Tamamlanmış görevler, tamamlandı sütunundaki eski görevler ve arşivli proje/panolar gösterilmez; bağımsız takvim kaydı gösterilir.
- Ay ve yıl geçişlerinde, yerel saat/gece yarısı sınırında tarih kayması oluşmaz.
- Etkinlik Takvime, görev ilgili Kanban panosuna gider; fazla kayıt sayısı ve boş durum doğru görünür.

## 4. PDF, önizleme ve baskı

- **A3:** PDF tek sayfadır ve gerçek A3 yatay ölçüsündedir; dokuz A3 bölümü okunur ve taşmaz.
- **Balık kılçığı:** Omurga, kategori dalları, nedenler ve işaretli kök nedenler metodolojiye uygun görünür.
- **5 Neden:** Sorun ve nedenler yönlü zincir hâlindedir; kanıt ve doğrulama durumu kaybolmaz.
- **Birleşik dosya:** Özet, 5 Neden, balık kılçığı, A3 ve aksiyon/doğrulama bölümleri doğru sırayla yer alır; uzun metinler, yediden fazla neden ve dörtten fazla aksiyon ek sayfalara taşar, hiçbir kayıt sessizce kaybolmaz.
- Türkçe karakterler ile İngilizce metinler PDF'de aranabilir ve bozulmadan görüntülenir.
- Renkli ve siyah-beyaz modlar, önizleme yakınlaştırması, yazdırma ve PDF kaydetme ayrı ayrı çalışır.
- PDF tamamen çevrimdışı üretilir; ağ isteği veya harici hizmet bağımlılığı yoktur.
- Masaüstü kaydı çalışma alanına özel `Save\Exports\<Çalışma Alanı>` altında yapılır; kişisel/iş ayrımı, güvenli klasör ve dosya adı, aynı isim çakışması, klasörü açma, `%PDF-` doğrulaması ve 20 MB sınırı test edilir.
- Rapor alınması veya iptal edilmesi sorun kaydını ve çalışma alanı Save dosyasını değiştirmez.

## 5. UX, dil ve regresyon

- Yeni kartlar Türkçe/İngilizce, dört tema ve 1280+, 900 ve 560 piksel kırılımlarında taşmadan çalışır.
- Uzun proje/sorun adlarında ellipsis ve tam metin ipucu bulunur; klavye odağı ve erişilebilir adlar görünürdür.
- Kanban sürükle-bırak, zihin haritası, finans, takvim düzenleme, arşiv, çalışma alanı ve otomatik Save akışlarında gerileme yoktur.
- Uygulama çevrimdışı ve konsol penceresi olmadan açılır; rapor araçları mevcut Save/kurtarma zincirini etkilemez.

## 6. Otomasyon ve sürüm kapısı

```powershell
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
npm run desktop:dist
```

Sürüm yalnız şu koşullarda yayımlanır:

- ESLint, TypeScript typecheck, renderer üretim derlemesi ve tüm JavaScript birim testleri geçer.
- Rust depolama/rapor testleri geçer.
- Temiz Windows kurulumunda NSIS yükleme, mevcut Save ile yükseltme, PDF kaydetme, baskı önizleme ve fiziksel/PDF yazıcı akışları elle doğrulanır.
- Türkçe ve İngilizce örnek A3, balık kılçığı, 5 Neden ve birleşik dosya görsel olarak incelenir; kesilen veya okunamayan zorunlu içerik bulunmaz.
