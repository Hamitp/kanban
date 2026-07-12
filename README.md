# Akış / Flow

[Türkçe](#türkçe) · [English](#english)

## Türkçe

Akış; birden fazla projeyi Kanban panoları ve zihin haritalarıyla yönetmek, görev sürelerini ve proje finansını izlemek için hazırlanmış çevrimdışı bir Windows masaüstü uygulamasıdır.

## Programı kullanmak istiyorsanız

Kod, PowerShell, Node.js veya Git kurmanız gerekmez:

1. [En güncel Akış sürümünü açın](https://github.com/Hamitp/kanban/releases/latest).
2. `Akis-Setup-...-x64.exe` dosyasını indirin.
3. Dosyaya çift tıklayıp kurulumu tamamlayın.
4. Masaüstündeki veya Başlat menüsündeki **Akış** simgesini açın.
5. İlk açılışta **Türkçe** veya **English** seçin. Dili daha sonra Ayarlar’dan değiştirebilirsiniz.

İlk kurulum, güncelleme, başka bilgisayara taşıma ve olası Windows uyarıları için:

### [Hiç bilmeyenler için adım adım Windows kurulum rehberi](docs/KURULUM_REHBERI.md)

## Verileriniz

Her değişiklik otomatik olarak şu dosyaya yazılır:

```text
Belgeler\Akış\Save\workspace.akis.json
```

Değişiklik olduğunda saatlik güvenlik kopyaları `Belgeler\Akış\Save\Backups` altında oluşturulur; son 60 sağlam kopya korunur. Günlük kullanımda manuel kaydetme veya yedekleme yapmanız gerekmez. Uygulamanın güncellenmesi ya da kaldırılması Save klasörünü silmez.

## Başlıca özellikler

- Kişisel ve iş projelerini birbirinden ayıran, adı ve rengi değiştirilebilen bağımsız çalışma alanları
- Biten çalışma alanlarını arşivleme, geri getirme ve yalnızca arşivden kalıcı olarak silme
- Proje başına birden fazla özelleştirilebilir Kanban panosu ve zihin haritası
- Boş alanda sol tuşla veya orta tuşla gezinen; `Ctrl + fare tekerleği` ile yakınlaşan çalışma alanları
- Sürükle-bırak, görünür bırakma hedefleri, kenarda otomatik kaydırma ve klavyeyle görev taşıma
- Etiketler, bekleme/engel nedeni, öncelik, son tarih ve birden fazla kişi ataması
- Görevin aktif çalışma süresi ve tamamlanma süresi geçmişi
- Aktif, tamamlandı ve müşteriye teslim edildi proje aşamaları
- Anlaşılan tutar, kısmi/tam tahsilat, bekleyen alacak ve tahsilat geçmişi
- Proje başına bağımsız Türk lirası, Amerikan doları, Euro veya İngiliz sterlini; farklı para birimlerini yanıltıcı biçimde toplamayan finans ekranları
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

---

## English

Akış (Flow) is an offline Windows desktop app for managing multiple projects with Kanban boards and mind maps, tracking task duration, and following project finances.

### Install the app

You do not need Git, Node.js, PowerShell, or any development tools:

1. Open the [latest Akış release](https://github.com/Hamitp/kanban/releases/latest).
2. Download `Akis-Setup-...-x64.exe` from **Assets**.
3. Double-click the installer and complete setup.
4. Open **Akış** from your desktop or Start menu.
5. Choose **English** on first launch. You can change the language later in Settings.

See the [step-by-step English installation guide](docs/INSTALLATION_GUIDE.md) for Windows warnings, updates, moving to another computer, and data safety.

### Your data

Every change is saved automatically to:

```text
Documents\Akış\Save\workspace.akis.json
```

When data changes, hourly safety copies are created under `Documents\Akış\Save\Backups`; the latest 60 valid backups are kept. Updating or uninstalling the app does not delete the Save folder.

### Highlights

- Separate, named workspaces for personal and shared-screen contexts
- Custom Kanban columns, drag and drop, keyboard moving, labels, blockers, due dates, and multiple assignees
- Elegant mind maps with collapsible details, auto layout, panning, and zoom
- Task active-time and completion-time history
- Active, completed, and delivered project stages
- Project-level TRY, USD, EUR, or GBP finances, partial payments, receivables, and payment history
- Currency-separated financial dashboards: amounts in different currencies are never combined without exchange-rate data
- Portfolio progress, cycle time, delivery rhythm, workload, risk, and cash-flow insights
- Fully local atomic saving, integrity checks, and automatic recovery copies

### Development

End users do not need this section. Contributors need Node.js 22+, stable Rust, Microsoft C++ Build Tools, and the Windows SDK.

```powershell
npm ci
npm run check
npm run desktop:run
```

Build the Windows installer with `npm run desktop:dist`. Licensed under [MIT](LICENSE).
