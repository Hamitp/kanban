# Akış v4.0.0 — Kalite Doğrulama Raporu

Tarih: 12 Temmuz 2026

## Sonuç

Akış v4 kapsamındaki veri migrasyonu, temel iş kuralları, kullanıcı akışları, iki dil ve Windows kayıt katmanı doğrulandı. Kritik veya yayın engelleyici açık kusur bulunmadı.

## Otomatik kontroller

- `npm run lint`: geçti.
- `npm run typecheck`: geçti.
- `npm test`: 30/30 test geçti.
- Üretim arayüz derlemesi: geçti.
- GitHub Actions Windows `verify`: geçti.
- Rust masaüstü kayıt, atomik yazma, previous/yedek ve kurtarma testleri: GitHub Windows ortamında geçti.

İlk başarılı Windows doğrulaması: [GitHub Actions #29209255198](https://github.com/Hamitp/kanban/actions/runs/29209255198)

Yerel PowerShell oturumunda Rust testi kaynak kod hatası nedeniyle değil, Microsoft C++ `link.exe` bulunmadığı için başlatılamadı. Aynı test temiz Windows GitHub Actions ortamında başarıyla tamamlandı.

## Gerçek arayüz kontrolleri

- İlk açılış dil seçimi ve Türkçe ana ekran.
- İngilizceye Ayarlar’dan geçiş ve yeni menülerin İngilizce adları.
- Kanban panolarının proje rengi, sayaç, daraltma ve proje bağlantısıyla gruplanması.
- Proje ayrıntısında **Projelere dön**, burn-up özetleri ve grafik erişilebilir adı.
- Takvim aylık görünümü, görev son tarihleri, yaklaşanlar ve yeni etkinlik kaydı.
- Sorun kaydı oluşturma; 5 Neden, balık kılçığı, A3 ve aksiyon sekmelerine erişim.
- Düzeltici aksiyonu Kanban görevine dönüştürme ve sekme odağının korunması.
- Zihin haritası fikrini hedef pano/sütuna dönüştürme ve bağlı görevi açma.
- Tarayıcı konsolunda hata veya uyarı bulunmaması.

## Migrasyon ve veri güvenliği

- v1 iç veri ve v2/v3 çalışma alanı kapları v4/v2 biçimine normalize edilir.
- Eski görevler 1 iş yükü puanı alır; ilk geçişleri `inferred` olarak işaretlenir.
- Sorunlar ve takvim kayıtları çalışma alanından dışarı taşmaz.
- Silinen görev/pano bağlantıları analiz ve fikir içeriğini silmeden temizlenir.
- Proje silme işlemi bağlı sorun analizlerini sayar; takvim olaylarını silmek yerine proje bağlantısını kaldırır.
- Gerçek kullanıcı `Documents\Akış\Save` klasörü geliştirme ve tarayıcı testleri sırasında değiştirilmedi.

## Boyut

Üretim web varlıkları yaklaşık olarak:

- JavaScript: 428,36 KB (gzip 126,49 KB)
- CSS: 79,47 KB (gzip 14,87 KB)
- HTML: 0,71 KB

Windows kurulum dosyasının kesin boyutu `v4.0.0` GitHub Release varlığı üretildikten sonra ayrıca doğrulanır.
