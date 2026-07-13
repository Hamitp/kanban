# Akış v4.1.1 - PDF oluşturma düzeltmesi

Bu yama, v4.1.0 kurulumunda **PDF oluştur** düğmesine basıldığında görülebilen `Failed to fetch` hatasını düzeltir.

## Düzeltilen sorun

- Kurulu masaüstü uygulamasının güvenlik politikası, uygulama paketindeki yerel PDF yazı tiplerinin okunmasına izin vermiyordu.
- Yerel uygulama varlıkları için güvenli `self` erişimi eklendi; internet veya harici sunucu erişimi açılmadı.
- Eksik ya da bozuk font varlığı ayrıca doğrulanıyor ve anlaşılır bir hata mesajıyla bildiriliyor.
- PDF üretimi hâlâ tamamen çevrimdışı çalışır ve raporlar çalışma alanına özel `Save\Exports` klasörüne kaydedilir.

Mevcut Save verileri, projeler, sorun kayıtları ve rapor içerikleri değişmeden korunur.

## English summary

Akış v4.1.1 fixes the `Failed to fetch` error that could occur when creating a PDF in the installed v4.1.0 desktop application. The packaged WebView can now securely read the bundled PDF fonts from its own origin. No internet or external-service access was added, and existing local data remains unchanged.
