# Akış

Akış; birden fazla projeyi Kanban boardlar ve mind mapler aracılığıyla yöneten, internet bağlantısı gerektirmeyen kişisel Windows masaüstü uygulamasıdır.

## Programı kullanmak istiyorsanız

Kod indirmeniz veya geliştirici araçları kurmanız gerekmez:

1. **[En güncel Windows kurulum dosyasını açın](https://github.com/Hamitp/kanban/releases/latest).**
2. `Akis-Setup-...-x64.exe` dosyasını indirin.
3. Dosyaya çift tıklayın.
4. Kurulumdan sonra masaüstündeki **Akış** simgesini açın.

İlk kez kurulum yapıyorsanız ayrıntılı anlatımı okuyun:

### [Hiç bilmeyenler için adım adım Windows kurulum rehberi](docs/KURULUM_REHBERI.md)

## Kısa kurulum özeti

1. `Akis-Setup-...-x64.exe` kurulum dosyasını bir kez çalıştırın.
2. Kurulumdan sonra masaüstündeki **Akış** kısayoluna çift tıklayın.
3. Tarayıcı, PowerShell veya başka bir geliştirme aracı açmanız gerekmez.

Uygulama bütün değişiklikleri otomatik olarak şu klasöre kaydeder:

```text
Belgeler\Akış\Save\workspace.akis.json
```

Saatlik güvenlik kopyaları `Belgeler\Akış\Save\Backups` altında otomatik tutulur. Kullanıcının manuel yedek alması gerekmez. Uygulama kaldırılıp yeniden kurulduğunda Save klasörü korunur.

## Özellikler

- Proje altında birden fazla Kanban board ve mind map
- Özelleştirilebilir sütunlar ve sürükle-bırak görev akışı
- Kanban ve mind map alanlarında düğmelerle veya `Ctrl + fare tekerleği` ile yakınlaştırma
- Daha rahat okunabilen arayüz yazıları ve her çalışma alanı için kaydedilen yakınlaştırma seviyesi
- Etiketler, bekleme/engel nedeni, son tarih ve çoklu kişi ataması
- Görev çalışma süresi ve proje ilerleme analitiği
- Mind map üzerinde fikir ekleme, taşıma, renklendirme ve otomatik düzen
- Arşivleme, geri getirme ve başka projeye bağımsız kopyalama
- Dört tema, otomatik dosya kaydı ve otomatik güvenlik kopyaları
- Tek uygulama örneği ve bozuk dosyadan otomatik kurtarma

## Geliştirme

Node.js 22.13 veya daha yeni bir sürümle:

```bash
npm install
npm run dev
npm run desktop:run
```

Windows kurulum dosyası üretmek için:

```bash
npm run desktop:dist
```

## Lisans

MIT
