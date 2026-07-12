# Akış v4.0.0 — Düşünceden Öğrenmeye

Akış v4, mevcut çevrimdışı Kanban, zihin haritası, çalışma alanı ve finans temelini bozmadan planlama ile problem çözmeyi tek akışta birleştirir.

## Öne çıkan yenilikler

- Kanban panoları ve zihin haritaları artık projeye göre renkli, daraltılabilir gruplarda gösterilir.
- Proje ayrıntısına görünür **Projelere dön** düğmesi eklendi.
- Zihin haritasındaki fikirler hedef pano ve sütun seçilerek Kanban görevine dönüştürülebilir; bağlantı iki yönde korunur.
- Görevlere 1, 2, 3, 5 veya 8 iş yükü puanı verilebilir.
- Görev oluşturma ve sütun hareketleri geçmişe kaydedilir.
- Proje ayrıntısında görev sayısı veya iş yükü puanıyla 30/90 gün ya da tüm dönem burn-up grafiği bulunur.
- Proje veya görevle ilişkilendirilebilen sorun kayıtları; 5 Neden, balık kılçığı, A3 ve düzeltici aksiyon araçları eklendi.
- Sorun, çözümün etkili olduğu doğrulanmadan kapatılamaz.
- Düzeltici aksiyonlar sorumlu, tarih ve puan bilgisiyle Kanban görevine dönüştürülebilir.
- Toplantı, planlı iş ve not türlerini içeren sade aylık takvim eklendi; görev son tarihleri otomatik görünür.
- İçgörülere açık sorun, doğrulama, çözüm süresi ve tekrar eden kök neden görünümü eklendi.
- Bütün yeni ekranlar Türkçe ve İngilizce çalışır; çalışma alanı izolasyonu korunur.

## Veri güvenliği ve yükseltme

- v3 verileri ilk açılışta kayıpsız biçimde v4 veri modeline normalize edilir.
- Eski görevlerin iş yükü puanı varsayılan olarak 1 kabul edilir.
- Eski görevlerden türetilen burn-up başlangıç tarihleri yaklaşık olarak işaretlenir.
- `Save`, `Previous` ve otomatik yedek kurtarma zinciri değişmeden korunur.
- Güncelleme, `Belgeler\Akış\Save` klasörünü silmez.

## Bilinçli olarak eklenmeyenler

Bu sürümde hesap sistemi, çok kullanıcılı eşzamanlı çalışma, Google/Outlook senkronizasyonu, bildirim servisi, karmaşık tekrar kuralları ve Gantt bulunmaz. Akış yerel, sade ve hızlı kalır.

---

## English summary

Akış v4 adds project-grouped Kanban and mind-map libraries, idea-to-task conversion, effort points, movement history, project burn-up charts, a simple calendar, and a complete problem-solving toolkit with 5 Whys, fishbone, A3, corrective Kanban tasks, effectiveness verification, and lessons learned.

All new surfaces are available in Turkish and English. Existing v3 data is migrated locally and safely; the `Documents\Akış\Save` folder and its recovery chain are preserved. The app remains offline-first and does not add accounts, cloud sync, or multi-user collaboration.
