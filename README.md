# Akış

Akış; birden fazla projeyi Kanban panoları ve zihin haritalarıyla yönetmek, görev sürelerini ve proje finansını izlemek için hazırlanmış çevrimdışı bir Windows masaüstü uygulamasıdır.

## Programı kullanmak istiyorsanız

Kod, PowerShell, Node.js veya Git kurmanız gerekmez:

1. [En güncel Akış sürümünü açın](https://github.com/Hamitp/kanban/releases/latest).
2. `Akis-Setup-...-x64.exe` dosyasını indirin.
3. Dosyaya çift tıklayıp kurulumu tamamlayın.
4. Masaüstündeki veya Başlat menüsündeki **Akış** simgesini açın.

İlk kurulum, güncelleme, başka bilgisayara taşıma ve olası Windows uyarıları için:

### [Hiç bilmeyenler için adım adım Windows kurulum rehberi](docs/KURULUM_REHBERI.md)

## Verileriniz

Her değişiklik otomatik olarak şu dosyaya yazılır:

```text
Belgeler\Akış\Save\workspace.akis.json
```

Değişiklik olduğunda saatlik güvenlik kopyaları `Belgeler\Akış\Save\Backups` altında oluşturulur; son 60 sağlam kopya korunur. Günlük kullanımda manuel kaydetme veya yedekleme yapmanız gerekmez. Uygulamanın güncellenmesi ya da kaldırılması Save klasörünü silmez.

## Başlıca özellikler

- Proje başına birden fazla özelleştirilebilir Kanban panosu ve zihin haritası
- Boş alanda sol tuşla veya orta tuşla gezinen; `Ctrl + fare tekerleği` ile yakınlaşan çalışma alanları
- Sürükle-bırak, görünür bırakma hedefleri, kenarda otomatik kaydırma ve klavyeyle görev taşıma
- Etiketler, bekleme/engel nedeni, öncelik, son tarih ve birden fazla kişi ataması
- Görevin aktif çalışma süresi ve tamamlanma süresi geçmişi
- Aktif, tamamlandı ve müşteriye teslim edildi proje aşamaları
- Anlaşılan tutar, kısmi/tam tahsilat, bekleyen alacak ve tahsilat geçmişi
- İlerleme, çevrim süresi, haftalık teslim ritmi, iş yükü, risk ve nakit akışı içgörüleri
- Daraltılabilir fikir ayrıntıları, otomatik düzen ve tümünü sığdırma özellikli zihin haritası
- Arşivleme, geri getirme ve başka projeye bağımsız kopyalama
- Dört tema, kişisel profil adı ve erişilebilir klavye odağı
- Atomik yerel kayıt, checksum doğrulaması, previous/yedek kurtarma ve tek uygulama örneği

## Neden küçük?

Akış, kendi içinde ayrı bir Chromium kopyası taşımak yerine Windows'un ortak WebView2 bileşenini kullanan Tauri masaüstü mimarisine sahiptir. Uygulama kodu ve kurulum dosyası bu nedenle klasik Electron paketlerinden belirgin biçimde küçüktür. Kurulum dosyasının kesin boyutu her sürümün GitHub **Assets** bölümünde görünür.

## Geliştirme

Bu bölüm yalnız projeye kod katkısı yapmak isteyenler içindir. Son kullanıcıların bunları kurması gerekmez.

Gerekenler: Node.js 22+, Rust stable, Microsoft C++ Build Tools ve Windows SDK.

```powershell
npm ci
npm run check
npm run desktop:run
```

Windows NSIS kurulumunu üretmek için:

```powershell
npm run desktop:dist
```

## Lisans

[MIT](LICENSE)
