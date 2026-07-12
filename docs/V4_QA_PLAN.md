# Akış v4.0.0 — Kalite ve Kabul Planı

## Veri güvenliği

- Gerçek v3 Save dosyasının kurulum öncesi özeti ve SHA-256 değeri alınır.
- v3 → v4 açılışında çalışma alanı, proje, pano, zihin haritası, görev, kişi, finans ve arşiv sayıları değişmez.
- `workspace.previous.akis.json` eski sağlam sürümü korur.
- Bozuk yeni alanlar tüm dosyayı kaybettirmez; doğrulama güvenli biçimde başarısız olur.

## Fonksiyonel kabul

- Proje detayından tek eylemle proje listesine dönülür.
- Kütüphaneler projeye göre gruplanır; gruplar açılıp kapanır ve proje bağlantısı çalışır.
- Fikirden görev oluşturulur, bağlantının iki yönü açılır ve mükerrer görev engellenir.
- Görev puanı kaydedilir; geçiş olayları her sütun değişiminde doğru sırada oluşur.
- Sorun oluşturma, düzenleme, durum geçişi, 5 Neden, balık kılçığı ve A3 kayıtları yeniden açıldığında korunur.
- Düzeltici aksiyon hedef Kanban’a görev olarak düşer ve kaynağına bağlı kalır.
- Sorun yalnız etkililik doğrulandıktan sonra kapatılabilir.
- Takvim etkinliği oluşturulur, düzenlenir, silinir; görev son tarihleri doğru günde görünür.
- Burn-up görev ve puan modunda aynı olay geçmişinden tutarlı değer üretir.

## UX ve erişilebilirlik

- Türkçe ve İngilizce ekranlarda karışık dil bulunmaz.
- Klavye odağı, dialog kapatma, aria adları ve hata açıklamaları çalışır.
- 1280+, 900–1240 ve dar ekran düzenleri taşma olmadan kullanılabilir.
- Gruplar ve analiz yüzeyleri gereksiz kalabalık oluşturmadan daraltılabilir.

## Otomasyon

- TypeScript strict typecheck.
- ESLint.
- Veri normalizasyonu ve v3→v4 geçiş testleri.
- Görev puanı/geçiş, bağlantı, sorun yaşam döngüsü, takvim ve burn-up birim testleri.
- Üretim renderer derlemesi.
- Rust Save doğrulama, atomik yazma ve kurtarma testleri.
- GitHub Windows NSIS paketleme hattı.

## Gerçek kullanıcı akışları

- Mevcut verili yükseltme.
- Boş çalışma alanında ilk sorun, ilk etkinlik ve ilk fikir→görev akışı.
- Bir projede birden fazla pano/haritanın gruplanmış görünümü.
- Türkçe ↔ İngilizce geçişi.
- Masaüstü simgesinden sessiz konsolsuz açılış ve otomatik Save doğrulaması.
