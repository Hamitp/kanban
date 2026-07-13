# Akış v4.1.0 — Görünür sorunlar, yakın plan ve profesyonel çıktılar

Bu sürüm, günlük karar vermeyi hızlandırır ve sorun çözme çalışmalarını ekiplerle paylaşılabilir, yazdırılabilir belgelere dönüştürür. Yeni özelliklerin tamamı yerel ve çevrimdışı çalışır.

## İş yükü puanlaması

- İş yükü seçeneklerinin üst sınırı **13** oldu: `1, 2, 3, 5, 8, 13`.
- Görev ve düzeltici aksiyon ekranlarına ortak rehber eklendi:
  - **1–3:** Küçük işler
  - **5–8:** Orta veya zor işler
  - **13:** Çok zor, çok adımlı veya belirsiz iş
- Eski görevlerin puanları korunur; 13 puan kayıt, kopyalama ve veri normalizasyonunda desteklenir.

## Sorun ve yakın dönem görünürlüğü

- Proje detayına, yalnız o projenin çözüm sürecindeki kayıtlarını gösteren **Açık Sorunlar** paneli eklendi.
- Genel Bakışa aktif projelerdeki açık, kritik/yüksek, doğrulama bekleyen ve takip tarihi geçen sorunları özetleyen portföy kartı eklendi.
- Sorun satırları doğrudan ilgili kaydı açar; kapatılan sorunlar açık sayaçlarından çıkar.
- Genel Bakıştaki **Önümüzdeki 7 Gün** kartı, takvim etkinlikleriyle tamamlanmamış görev son tarihlerini aynı kronolojik listede birleştirir.
- Arşivlenmiş proje ve panolar ile tamamlanmış görevler yakın dönem gündemine karışmaz.

## Metodolojiye uygun PDF ve baskı

Sorun ayrıntısındaki **Rapor / Yazdır** ekranı şunları üretir:

- Gerçek A3 ölçüsünde yatay, tek sayfalık **A3 raporu**
- Neden kategorilerini ve kök nedenleri gerçek diyagram biçiminde gösteren **balık kılçığı raporu**
- Sorundan nedenlere ilerleyen görsel **5 Neden zinciri**
- Özet, 5 Neden, balık kılçığı, A3 ve aksiyonları bir araya getiren; uzun içerikleri eksiksiz tam kayıt eklerinde koruyan **birleşik sorun çözme dosyası**

Her çıktı için Türkçe/İngilizce ve renkli/siyah-beyaz seçenekleri, yakınlaştırılabilir baskı önizlemesi, yazdırma ve PDF kaydetme bulunur. PDF dosyası uygulama içinde, internet veya bulut servisi kullanılmadan oluşturulur. Masaüstünde güvenli dosya adıyla `Belgeler\Akış\Save\Exports\<Çalışma Alanı>` klasörüne yazılır; kişisel ve iş raporları birbirinden ayrılır ve aynı adlı mevcut dosyanın üzerine sessizce yazılmaz.

## Uyumluluk ve güvenlik

- Mevcut çalışma alanı ve Save yapısı geriye dönük uyumludur; yeni özellikler için kullanıcı verisi sıfırlanmaz.
- Rapor üretimi çalışma alanı verisini değiştirmez.
- PDF kaydı yalnız uygulamanın yerel `Exports` klasörüne yapılır ve geçersiz veya aşırı büyük rapor verisi reddedilir.
- Kullanıcı hesabı, sunucu bağlantısı veya çevrimiçi PDF hizmeti eklenmedi.

## English summary

Akış v4.1.0 adds 13-point effort estimates with a shared sizing guide, project and portfolio open-problem visibility, and a combined Next 7 Days agenda. Problem-solving records can now be previewed, printed, or exported fully offline as a single-page landscape A3, a true fishbone diagram, a visual 5 Whys chain, or a combined dossier. Reports support Turkish/English and color/monochrome output and are saved locally under a workspace-specific folder inside the application's `Save\Exports` directory.
