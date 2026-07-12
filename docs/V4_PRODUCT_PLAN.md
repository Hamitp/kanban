# Akış v4.0.0 — Ürün Planı

## Ürün amacı

Akış v4; düşünceyi görünür kılma, işi planlama, zamanı düzenleme ve ortaya çıkan sorunlardan öğrenme döngüsünü tek, çevrimdışı ve çalışma alanına göre izole bir masaüstü uygulamasında birleştirir.

```text
Düşün → Planla → Uygula → Sorunu çöz → Doğrula → Öğren
```

## Kesin kapsam

### Gezinme ve çalışma kütüphaneleri

- Proje detayında görünür “Projelere dön” eylemi.
- Kanban ve zihin haritası kütüphanelerinde çalışmaların projeye göre gruplanması.
- Her proje grubunda proje rengi, çalışma sayısı, proje bağlantısı ve daraltma/açma.
- Tek kartlık projelerde de aynı görsel hiyerarşinin korunması.

### Zihin haritasından göreve

- Seçili fikirden hedef pano ve sütun seçerek görev oluşturma.
- Fikir başlığı ve notunun göreve taşınması.
- Fikir ile görev arasında çift yönlü, güvenli bağlantı.
- Kaynak silinse bile oluşturulan görev içeriğinin korunması.
- Aynı fikir için mevcut bağlantı varken mükerrer görev uyarısı.

### Görev iş yükü ve geçmişi

- İş yükü seçenekleri: 1, 2, 3, 5 ve 8 puan.
- Puanı olmayan eski görevlerin 1 puan kabul edilmesi.
- Görev oluşturma ve sütun geçişlerinin tarihçesinin tutulması.
- Backlog, planlanan, aktif ve tamamlanan akış anlamlarının tarihçede korunması.

### Sorun çözme araç seti

- Projeye veya göreve bağlı sorun kaydı.
- Durum, önem, etki, gözlem, kanıt, kişiler ve tarihler.
- Esnek uzunlukta 5 Neden analizi.
- Özel kategori destekli balık kılçığı analizi.
- A3: arka plan, mevcut durum, hedef, kök neden, karşı önlem, uygulama, doğrulama, standartlaştırma ve dersler.
- Analiz maddelerinden düzeltici Kanban görevleri oluşturma.
- Görev tamamlanması ile çözüm doğrulamasının birbirinden ayrılması.
- Kapatılan sorunlardan öğrenilen dersler görünümü.

### Sade takvim

- Aylık görünüm ve yaklaşanlar listesi.
- Toplantı, planlı iş ve not türleri.
- Başlık, tarih, isteğe bağlı saat, proje ve kısa not.
- Görev son tarihlerinin salt okunur takvim girdileri olarak gösterilmesi.
- Etkinlik ekleme, düzenleme ve silme.
- Her çalışma alanında tamamen ayrı takvim.

### Burn-up ve içgörüler

- Proje bazında toplam planlanmış kapsam ve tamamlanan kapsam çizgileri.
- Backlog kapsam dışında; planned + active + done kapsam içinde.
- Görev sayısı ve iş yükü puanı arasında geçiş.
- 30 gün, 90 gün ve tüm proje dönemleri.
- Açık sorunlar, durum dağılımı, ortalama çözüm süresi, kök neden sıklığı ve doğrulama bekleyen kayıtlar.

### Dil, yerellik ve güvenlik

- Bütün yeni yüzeylerde Türkçe ve İngilizce.
- Tarih, sayı, erişilebilir ad ve hata metinlerinin dile uyumu.
- İnternet, hesap veya bulut gerektirmeyen çalışma.
- v3 verisinin v4’e kayıpsız geçişi; previous ve otomatik yedek zincirinin korunması.

## Bilinçli olarak kapsam dışı

- Google Calendar veya Outlook senkronizasyonu.
- Çok kullanıcılı eşzamanlı çalışma ve kullanıcı hesabı.
- Karmaşık Gantt, kaynak seviyelendirme ve kritik yol hesabı.
- Bildirim servisi, tekrar eden etkinlikler ve katılımcı davetleri.
- Yapay zekâ veya haricî veri gönderimi.

## Yayın yaklaşımı

Geliştirme veri temeli, UX, sorun çözme, takvim ve analiz dilimleri hâlinde doğrulanır; kullanıcıya tek kararlı `v4.0.0` sürümü olarak sunulur.
