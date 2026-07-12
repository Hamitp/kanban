# Akış — Windows Kurulum ve Kullanıma Başlama Rehberi

Bu rehber yazılım geliştirme veya GitHub tecrübesi olmayan kullanıcılar içindir. Akış'ı kullanmak için kod yazmanız, PowerShell açmanız ya da GitHub hesabı oluşturmanız gerekmez.

## En kısa anlatım

1. [En güncel Akış sürümünü açın](https://github.com/Hamitp/kanban/releases/latest).
2. **Assets** bölümünden `Akis-Setup-...-x64.exe` dosyasını indirin.
3. İndirdiğiniz dosyaya çift tıklayın.
4. Kurulumdan sonra masaüstündeki veya Başlat menüsündeki **Akış** simgesine çift tıklayın.
5. İlk açılışta **Türkçe** veya **English** seçin. Bu seçimi daha sonra Ayarlar’dan değiştirebilirsiniz.

Hepsi bu kadar. Daha sonraki kullanımlarda tarayıcı, internet bağlantısı veya PowerShell gerekmez.

## 1. Uyumlu bilgisayarlar

- Windows 10 veya Windows 11
- 64 bit işlemci
- Kurulum ve ortak Windows bileşenleri için en az 150 MB boş alan
- Yalnız kurulum dosyasını indirmek için internet bağlantısı

Akış kurulduktan sonra proje, Kanban panosu ve zihin haritalarınızı internetsiz kullanabilirsiniz. Çoğu güncel Windows bilgisayarda gerekli WebView2 bileşeni zaten vardır. Yoksa küçük kurulum programı bu ortak Windows bileşenini Microsoft'tan indirir.

## 2. Resmî indirme sayfasını açın

Projenin resmî adresi:

**[github.com/Hamitp/kanban](https://github.com/Hamitp/kanban)**

Doğrudan son sürüme gitmek için:

**[github.com/Hamitp/kanban/releases/latest](https://github.com/Hamitp/kanban/releases/latest)**

GitHub hesabı gerekmez.

## 3. Doğru dosyayı indirin

Sürüm sayfasının altındaki **Assets** bölümünde şu biçimdeki dosyaya tıklayın:

```text
Akis-Setup-3.0.0-x64.exe
```

Sürüm numarası zamanla değişebilir. Dosya adının `Akis-Setup-` ile başlaması ve `x64.exe` ile bitmesi yeterlidir.

Yalnız programı kullanacaksanız şunları indirmeniz gerekmez:

- `Source code (zip)`
- `Source code (tar.gz)`
- `.sha256` dosyası

`.sha256` dosyası yalnız ileri düzey bütünlük kontrolü içindir.

## 4. Kurulumu çalıştırın

1. Windows **İndirilenler** klasörünü açın.
2. `Akis-Setup-...-x64.exe` dosyasını bulun.
3. Dosyaya çift tıklayın.
4. Kurulum tamamlanana kadar ekrandaki kısa adımları izleyin.

Kurulum mevcut Windows kullanıcısı için yapılır; normal koşullarda yönetici parolası istemez. Node.js, Git, Rust veya başka geliştirici programları kurmaz.

## 5. Windows SmartScreen uyarısı gösterirse

Akış açık kaynaklıdır; ancak kurulum henüz ücretli bir ticari kod imzalama sertifikasıyla imzalanmamıştır. Windows ilk kurulumda “Windows bilgisayarınızı korudu” uyarısı gösterebilir.

Dosyayı yukarıdaki resmî GitHub sayfasından indirdiyseniz:

1. **Ek bilgi** seçeneğine tıklayın.
2. Dosya adının `Akis-Setup-...-x64.exe` olduğunu doğrulayın.
3. **Yine de çalıştır** seçeneğine tıklayın.

Kurulumu e-posta eki veya tanımadığınız bir internet sitesinden indirmeyin.

## 6. Programı her gün nasıl açacaksınız?

- Masaüstündeki **Akış** simgesine çift tıklayın; veya
- Windows Başlat menüsünde `Akış` aratıp uygulamaya tıklayın.

İkinci kez yanlışlıkla simgeye tıklarsanız ayrı bir veri yazıcısı açılmaz; mevcut Akış penceresi öne gelir.

İlk açılışta uygulama dilinizi sorar. Dil seçimi para birimini zorunlu olarak belirlemez. Yeni projeler için varsayılan para birimini **Ayarlar → Dil ve bölge** bölümünden Türk lirası, Amerikan doları, Euro veya İngiliz sterlini olarak ayrıca seçebilirsiniz. Her projenin para birimi bağımsızdır; farklı para birimleri kur bilgisi olmadan tek toplamda birleştirilmez.

## 7. Kayıt için sizin yapmanız gereken var mı?

Hayır. Akış her değişikliği otomatik kaydeder. Kaydet düğmesine basmanız, tarayıcı açmanız veya günlük yedek almanız gerekmez.

Ana veri dosyası:

```text
Belgeler\Akış\Save\workspace.akis.json
```

Otomatik güvenlik kopyaları:

```text
Belgeler\Akış\Save\Backups
```

Sistem şu güvenlik adımlarını kendi yapar:

- Dosyayı önce geçici bir dosyaya eksiksiz yazar ve doğrular.
- Önceki sağlam sürümü `workspace.previous.akis.json` olarak korur.
- Değişiklik varsa saatte en fazla bir güvenlik kopyası oluşturur.
- Son 60 sağlam otomatik kopyayı saklar.
- Ana dosya bozulmuşsa önce previous, sonra en yeni sağlam yedeği dener.
- Kurtarma yapıldıysa uygulamada bunu bildirir.
- Sağlam kopya bulunamazsa sorunlu verinin üzerine boş çalışma alanı yazmaz.

Save klasörünü uygulamada **Ayarlar → Otomatik kayıt → Save klasörünü aç** yoluyla görebilirsiniz. Dosyaları günlük kullanımda elle düzenlemeyin.

## 8. Bilgisayarı kapatınca veriler ne olur?

Projeler, görevler, finans bilgileri, tahsilatlar, temanız ve zihin haritalarınız diskte kalır. Bilgisayarı veya Akış'ı yeniden açtığınızda son kayıt geri gelir. Pencere kapanırken de en son çalışma alanı bir kez daha güvenli biçimde yazılır.

## 9. Yeni sürüme güncelleme

1. Akış'ı kapatın.
2. [En güncel sürümü](https://github.com/Hamitp/kanban/releases/latest) açın.
3. Yeni `Akis-Setup-...-x64.exe` dosyasını indirin.
4. Dosyaya çift tıklayıp kurulumu tamamlayın.
5. Akış simgesini yeniden açın.

Yeni sürüm `Belgeler\Akış\Save` klasörünü silmez. Önceki Electron tabanlı Akış sürümünden 1.0'a geçerken de aynı veri biçimi ve klasör kullanılır.

## 10. Başka bir bilgisayara kurma

Yeni bilgisayarda boş başlamak için yalnız son sürüm kurulumunu indirip çalıştırın.

Eski bilgisayardaki çalışmalarınızı da taşımak istiyorsanız bu işlem yalnız bilgisayar değiştirirken bir kez gerekir:

1. Eski bilgisayarda Akış'ı kapatın.
2. `Belgeler\Akış\Save` klasörünü USB belleğe veya güvendiğiniz bir bulut klasörüne kopyalayın.
3. Yeni bilgisayara Akış'ı kurup bir kez açın, sonra kapatın.
4. Kopyaladığınız **Save** klasörünü yeni bilgisayardaki `Belgeler\Akış` klasörüne yerleştirin.
5. Akış'ı açın.

Bu manuel işlem günlük yedekleme için değil, yalnız iki bilgisayar arasında veri taşımak içindir.

## 11. Programı kaldırma

1. Windows **Ayarlar** uygulamasını açın.
2. **Uygulamalar → Yüklü uygulamalar** bölümüne girin.
3. Akış'ı bulup **Kaldır** seçeneğine basın.

Uygulama kaldırıldığında veriler güvenlik amacıyla `Belgeler\Akış\Save` klasöründe kalır. Verileri de tamamen silmek istiyorsanız uygulamayı kaldırdıktan sonra `Belgeler\Akış` klasörünü ayrıca silebilirsiniz. Bu son işlem geri alınamaz.

## 12. Sık karşılaşılan sorunlar

### Masaüstü kısayolunu bulamıyorum

Windows Başlat menüsünde `Akış` araması yapın. Uygulama görünmüyorsa kurulum dosyasını yeniden çalıştırın.

### Simgeye tıklıyorum ama pencere görünmüyor

1. Birkaç saniye bekleyin.
2. Akış simgesine yeniden çift tıklayın; mevcut pencere öne gelmelidir.
3. Gerekirse Windows'u yeniden başlatın.

### Projelerim görünmüyor

1. Save klasöründeki dosyaları silmeyin veya değiştirmeyin.
2. Akış'ı yeniden açın; otomatik kurtarma previous ve yedekleri sırayla dener.
3. Sorun sürerse [GitHub Issues](https://github.com/Hamitp/kanban/issues) sayfasında hata kaydı açın.

### Kurulum WebView2 indirmek istiyor

Bu normaldir ve yalnız bilgisayarınızda ortak Microsoft WebView2 bileşeni yoksa olur. Akış ayrı bir Chromium kopyası taşımadığı için kendi kurulum dosyası küçük kalır.

## 13. Yardım ve hata bildirimi

**[Akış hata ve öneri sayfasını açın](https://github.com/Hamitp/kanban/issues)** ve **New issue** düğmesine basın. Teknik terim kullanmadan şunları yazmanız yeterlidir:

- Ne yapmaya çalışıyordunuz?
- Hangi düğmeye bastınız?
- Ne olmasını bekliyordunuz?
- Bunun yerine ne oldu?
- Varsa ekran görüntüsü veya hata metni

## Güvenli bağlantılar

- [Resmî proje](https://github.com/Hamitp/kanban)
- [En güncel Windows kurulumu](https://github.com/Hamitp/kanban/releases/latest)
- [Bu kurulum rehberi](https://github.com/Hamitp/kanban/blob/main/docs/KURULUM_REHBERI.md)
- [Hata ve öneriler](https://github.com/Hamitp/kanban/issues)
