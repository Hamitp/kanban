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
- Kanban ve zihin haritası kütüphanelerinde projeye göre gruplanmış, daraltılabilir çalışma alanları
- Boş alanda sol tuşla veya orta tuşla gezinen; `Ctrl + fare tekerleği` ile yakınlaşan çalışma alanları
- Sürükle-bırak, görünür bırakma hedefleri, kenarda otomatik kaydırma ve klavyeyle görev taşıma
- Güvenli biçimde eklenip silinebilen etiketler; bekleme/engel nedeni, öncelik, son tarih ve birden fazla kişi ataması
- 1, 2, 3, 5, 8 ve 13 puanlık iş yükü tahmini; küçük, orta/zor ve çok zor işler için görünür puanlama rehberi; görev hareket geçmişinden üretilen görev/puan bazlı burn-up grafiği
- Zihin haritasındaki bir fikri hedef pano ve sütunu seçerek çift yönlü bağlantılı Kanban görevine dönüştürme
- Proje ve göreve bağlanabilen sorun kayıtları; 5 Neden, balık kılçığı, A3, düzeltici aksiyon, etki doğrulaması ve öğrenilen dersler
- Proje detayında açık sorun paneli; Genel Bakışta aktif projeler için kritik/yüksek, doğrulama ve geciken takip sayılarını içeren portföy sorun özeti
- A3 yatay tek sayfa, gerçek balık kılçığı, görsel 5 Neden zinciri veya birleşik sorun çözme dosyasını Türkçe/İngilizce ve renkli/siyah-beyaz hazırlayan çevrimdışı PDF, baskı önizleme ve yazdırma
- Toplantı, planlı iş ve not eklenebilen sade aylık takvim; görev son tarihlerinin otomatik görünümü ve Genel Bakışta birleşik **Önümüzdeki 7 Gün** gündemi
- Görevin aktif çalışma süresi ve tamamlanma süresi geçmişi
- Aktif, tamamlandı ve müşteriye teslim edildi proje aşamaları
- Anlaşılan tutar, kısmi/tam tahsilat, bekleyen alacak ve tahsilat geçmişi
- Proje başına bağımsız Türk lirası, Amerikan doları, Euro veya İngiliz sterlini; farklı para birimlerini yanıltıcı biçimde toplamayan finans ekranları
- İlerleme, çevrim süresi, haftalık teslim ritmi, risk ve nakit akışı içgörüleri; kişi kapasitesini görev sayısı veya iş yükü puanına göre karşılaştıran görünüm
- Daraltılabilir fikir ayrıntıları, otomatik düzen ve tümünü sığdırma özellikli zihin haritası
- Arşivleme, geri getirme ve başka projeye bağımsız kopyalama
- Dört tema, kişisel profil adı ve erişilebilir klavye odağı
- Atomik yerel kayıt, checksum doğrulaması, previous/yedek kurtarma ve tek uygulama örneği

PDF raporları masaüstü uygulamasında otomatik olarak `Belgeler\Akış\Save\Exports\<Çalışma Alanı>` klasörüne kaydedilir. [v4.2.0 sürüm ayrıntılarını okuyun](docs/RELEASE_NOTES_v4.2.0.md).

### Kişi bazlı iş yükünü kullanma

**İçgörüler > Kişi bazlı görev yükü** kartı ilk açıldığında kişi başına tamamlanmamış **görev sayısını** gösterir. Aynı karttaki **İş yükü puanı** seçeneğiyle kolay ve zor görevlerin etkisini `1–13` puan üzerinden karşılaştırabilirsiniz. Hesap yalnız aktif projelerdeki havuz, önceliklendirilmiş ve aktif görevleri kapsar; biten işler dahil edilmez. Ortak bir görev, tam puanıyla her atanan kişide görünür.

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
- Custom Kanban columns, drag and drop, keyboard moving, safely removable labels, blockers, due dates, and multiple assignees
- Project-grouped Kanban and mind map libraries with collapsible sections
- 1, 2, 3, 5, 8 and 13-point effort estimates with a visible guide for small, medium/hard and very hard work, plus task/effort burn-up charts based on movement history
- Two-way conversion from a mind-map idea to a selected Kanban board and column
- Project/task-linked problem records with 5 Whys, fishbone, A3, corrective tasks, effectiveness verification, and lessons learned
- A project-level open-problems panel and a portfolio problem summary for active projects on Overview
- Fully offline PDF, print preview and printing for a single-page landscape A3, a true fishbone diagram, a visual 5 Whys chain, or a combined problem-solving dossier; output can be Turkish/English and color/monochrome
- A simple monthly calendar for meetings, planned work and notes, with automatically derived task due dates and a combined **Next 7 Days** agenda on Overview
- Elegant mind maps with collapsible details, auto layout, panning, and zoom
- Task active-time and completion-time history
- Active, completed, and delivered project stages
- Project-level TRY, USD, EUR, or GBP finances, partial payments, receivables, and payment history
- Currency-separated financial dashboards: amounts in different currencies are never combined without exchange-rate data
- Portfolio progress, cycle time, delivery rhythm, risk, and cash-flow insights, including per-person capacity compared by task count or effort points
- Fully local atomic saving, integrity checks, and automatic recovery copies

Desktop PDF reports are saved automatically under `Documents\Akış\Save\Exports\<Workspace>`. See the [v4.2.0 release notes](docs/RELEASE_NOTES_v4.2.0.md).

### Using workload by person

The **Insights > Workload by person** card opens with each person's unfinished **task count**. Select **Effort points** on the same card to compare the impact of easy and difficult tasks on the `1–13` point scale. The calculation covers backlog, prioritized, and active tasks in active projects; completed work is excluded. A shared task appears at its full value for every assignee.

### Development

End users do not need this section. Contributors need Node.js 22+, stable Rust, Microsoft C++ Build Tools, and the Windows SDK.

```powershell
npm ci
npm run check
npm run desktop:run
```

Build the Windows installer with `npm run desktop:dist`. Licensed under [MIT](LICENSE).
