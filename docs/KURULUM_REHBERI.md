# Akış — Windows Kurulum ve Kullanıma Başlama Rehberi

Bu rehber, yazılım geliştirme veya GitHub tecrübesi olmayan kullanıcılar için hazırlanmıştır. Akış'ı kullanmak için kod yazmanız, PowerShell açmanız veya GitHub hesabı oluşturmanız gerekmez.

## En kısa anlatım

1. [Akış'ın en güncel sürüm sayfasını açın](https://github.com/Hamitp/kanban/releases/latest).
2. `Akis-Setup-...-x64.exe` isimli kurulum dosyasını indirin.
3. İndirdiğiniz dosyaya çift tıklayın.
4. Kurulumdan sonra masaüstündeki **Akış** simgesine çift tıklayın.

Hepsi bu kadar. Program daha sonra tarayıcı, internet bağlantısı veya PowerShell gerektirmeden çalışır.

---

## 1. Bilgisayarınızda neler olmalı?

Akış'ın mevcut sürümü aşağıdaki bilgisayarlar içindir:

- Windows 10 veya Windows 11
- 64 bit işlemci
- Yaklaşık 500 MB boş disk alanı
- Yalnızca kurulum dosyasını indirmek için internet bağlantısı

Program kurulduktan sonra Kanban boardlarınızı ve mind maplerinizi internet bağlantısı olmadan kullanabilirsiniz.

## 2. GitHub'da doğru sayfayı açın

İnternet tarayıcınızda şu adresi açın:

**[https://github.com/Hamitp/kanban](https://github.com/Hamitp/kanban)**

Bu sayfa projenin resmi GitHub deposudur. Sayfanın sağ tarafında veya üst bölümünde **Releases** ya da **Sürümler** bağlantısını göreceksiniz.

En kolay yöntem doğrudan şu bağlantıyı kullanmaktır:

**[En güncel Akış sürümünü aç](https://github.com/Hamitp/kanban/releases/latest)**

GitHub hesabınızın olması gerekmez.

## 3. Doğru dosyayı indirin

Sürüm sayfasındaki **Assets** bölümünü açın. Aşağıdakine benzeyen dosyaya tıklayın:

```text
Akis-Setup-0.1.0-x64.exe
```

Sürüm numarası zamanla değişebilir. Örneğin gelecekte dosyanın adı `Akis-Setup-0.2.0-x64.exe` olabilir. Önemli olan dosya adının:

- `Akis-Setup-` ile başlaması,
- `x64.exe` ile bitmesidir.

### Hangi dosyaları indirmemelisiniz?

Programı yalnızca kullanmak istiyorsanız aşağıdaki dosyaları indirmeyin:

- `Source code (zip)`
- `Source code (tar.gz)`
- `.blockmap` uzantılı dosyalar
- `.sha256` uzantılı kontrol dosyası

Bunlar normal son kullanıcı kurulumu için gerekli değildir.

## 4. İndirilen kurulum dosyasını bulun

Tarayıcınız dosyayı genellikle Windows'un **İndirilenler** klasörüne kaydeder.

1. Dosya Gezgini'ni açın.
2. Sol menüden **İndirilenler** klasörüne girin.
3. `Akis-Setup-...-x64.exe` dosyasını bulun.
4. Dosyaya çift tıklayın.

Tarayıcınız ekranın üstünde veya altında indirme bildirimi gösteriyorsa dosyayı doğrudan bu bildirimin içinden de açabilirsiniz.

## 5. Windows güvenlik uyarısı gösterirse

Akış açık kaynaklıdır fakat mevcut kurulum dosyası henüz ticari bir kod imzalama sertifikasıyla imzalanmamıştır. Bu nedenle Windows ilk açılışta aşağıdakine benzer bir mesaj gösterebilir:

```text
Windows bilgisayarınızı korudu
Microsoft Defender SmartScreen tanınmayan bir uygulamanın başlamasını engelledi.
```

Dosyayı bu rehberdeki resmi GitHub sürüm sayfasından indirdiyseniz:

1. **Ek bilgi** düğmesine tıklayın.
2. Dosya adının `Akis-Setup-...-x64.exe` olduğunu kontrol edin.
3. **Yine de çalıştır** düğmesine tıklayın.

Kurulum dosyasını e-posta eki, mesajlaşma uygulaması veya tanımadığınız başka bir internet sitesinden indirmeyin.

## 6. Kurulumu tamamlayın

Akış tek tıklamalı bir kurulum kullanır:

1. Kurulum dosyasını çalıştırın.
2. Kısa bir kurulum ilerleme ekranı görebilirsiniz.
3. Akış bilgisayarınıza otomatik olarak kurulur.
4. Masaüstüne **Akış** kısayolu eklenir.
5. Başlat menüsüne **Akış** eklenir.
6. Kurulum tamamlanınca uygulama açılır.

Yönetici hesabı, Node.js, Git, PowerShell veya başka bir program kurmanız gerekmez.

## 7. Programı sonraki günlerde nasıl açacaksınız?

Her kullanımda yalnızca şunu yapın:

1. Masaüstündeki **Akış** simgesini bulun.
2. Simgeye çift tıklayın.

Masaüstü kısayolunu bulamazsanız:

1. Windows Başlat düğmesine basın.
2. Arama bölümüne `Akış` yazın.
3. Sonuçlardaki Akış uygulamasına tıklayın.

Tarayıcı veya PowerShell açmanız gerekmez.

## 8. Verileriniz nereye kaydedilir?

Akış bütün proje, görev, Kanban ve mind map verilerinizi otomatik olarak şu klasöre kaydeder:

```text
Belgeler\Akış\Save\workspace.akis.json
```

Saatlik güvenlik kopyaları şu klasörde tutulur:

```text
Belgeler\Akış\Save\Backups
```

Bilmeniz gerekenler:

- Her değişiklik otomatik kaydedilir.
- Manuel olarak “Kaydet” düğmesine basmanız gerekmez.
- Değişiklik varsa saatte en fazla bir otomatik güvenlik kopyası oluşturulur.
- Son 60 sağlam güvenlik kopyası korunur.
- Program kapanıp açıldığında son çalışma alanınız geri gelir.
- Windows yeniden başlatıldığında verileriniz kaybolmaz.
- Programı güncellemek Save klasörünü silmez.
- Programı kaldırmak Save klasörünü otomatik olarak silmez.

`workspace.akis.json` dosyasını Not Defteri veya başka bir programla elle değiştirmeyin.

Save klasörünü uygulamanın içinden açmak için:

1. Akış'ta **Ayarlar** bölümüne girin.
2. **Otomatik kayıt** bölümünü bulun.
3. **Save klasörünü aç** düğmesine tıklayın.

## 9. Programı başka bir bilgisayara kurmak

Yeni bilgisayarda yalnızca programı kullanmaya başlayacaksanız:

1. Yeni bilgisayarda [en güncel sürümü indirin](https://github.com/Hamitp/kanban/releases/latest).
2. `Akis-Setup-...-x64.exe` dosyasını çalıştırın.
3. Masaüstündeki Akış kısayolunu açın.

Program yeni ve boş bir çalışma alanıyla başlayacaktır.

### Eski bilgisayardaki çalışmalarınızı da taşımak istiyorsanız

Bu işlem yalnız bilgisayar değiştirirken gereklidir; günlük yedekleme için yapılmaz.

1. Eski bilgisayarda Akış'ı kapatın.
2. `Belgeler\Akış` klasörünü USB belleğe veya güvenilir bir bulut klasörüne kopyalayın.
3. Yeni bilgisayara Akış'ı kurun.
4. Yeni bilgisayarda Akış'ı bir kez açıp kapatın.
5. Yeni bilgisayardaki `Belgeler\Akış` klasörünü açın.
6. Eski bilgisayardan kopyaladığınız **Save** klasörünü buraya yerleştirin.
7. Akış'ı yeniden açın.

Eski projeleriniz, görevleriniz, temanız ve mind mapleriniz yeni bilgisayarda görünmelidir.

## 10. Yeni sürüme güncellemek

Yeni bir Akış sürümü yayınlandığında:

1. Akış'ı kapatın.
2. [GitHub'daki en güncel sürüm sayfasını](https://github.com/Hamitp/kanban/releases/latest) açın.
3. Yeni `Akis-Setup-...-x64.exe` dosyasını indirin.
4. İndirdiğiniz dosyaya çift tıklayın.
5. Kurulum tamamlanınca masaüstündeki Akış kısayolunu açın.

Yeni sürüm mevcut programın üzerine kurulur. `Belgeler\Akış\Save` klasöründeki verileriniz korunur.

## 11. Programı kaldırmak

1. Windows **Ayarlar** uygulamasını açın.
2. **Uygulamalar** bölümüne girin.
3. **Yüklü uygulamalar** listesini açın.
4. Akış'ı bulun.
5. Yanındaki menüden **Kaldır** seçeneğine basın.

Program kaldırıldığında çalışma verileriniz güvenlik amacıyla `Belgeler\Akış\Save` klasöründe kalır.

Kişisel verilerinizi de tamamen silmek istiyorsanız, programı kaldırdıktan sonra `Belgeler\Akış` klasörünü ayrıca silebilirsiniz. Bu işlem geri alınamaz.

## 12. Sık karşılaşılan sorunlar

### “Windows bilgisayarınızı korudu” mesajı çıkıyor

Bu rehberin **Windows güvenlik uyarısı gösterirse** bölümündeki adımları izleyin. Dosyayı yalnızca resmi GitHub deposundan indirdiğinizden emin olun.

### Masaüstünde kısayol oluşmadı

Windows Başlat menüsünde `Akış` araması yapın. Uygulama orada görünüyorsa sağ tıklayıp masaüstü kısayolu oluşturabilirsiniz. Görünmüyorsa kurulum dosyasını yeniden çalıştırın.

### Simgeye tıklıyorum fakat pencere açılmıyor

1. Birkaç saniye bekleyin.
2. Akış simgesine tekrar çift tıklayın. İkinci tıklama mevcut pencereyi öne getirir.
3. Olmazsa bilgisayarı yeniden başlatıp tekrar deneyin.
4. Sorun devam ederse GitHub'da hata kaydı oluşturun.

### Projelerim görünmüyor

1. Akış'ı kapatın.
2. `Belgeler\Akış\Save` klasörünün mevcut olduğunu kontrol edin.
3. Save veya Backups klasöründeki dosyaları silmeyin ya da değiştirmeyin.
4. Sorunu [GitHub Issues](https://github.com/Hamitp/kanban/issues) bölümünden bildirin.

### Antivirüs programı kurulum dosyasını engelliyor

Kurulum dosyasını yalnızca resmi GitHub Releases sayfasından indirdiğinizi doğrulayın. Dosyayı indirirken oluşan uyarının ekran görüntüsüyle birlikte GitHub'da hata kaydı açabilirsiniz.

## 13. Yardım veya hata bildirimi

Bir sorun yaşarsanız şu sayfayı açın:

**[Akış hata ve öneri sayfası](https://github.com/Hamitp/kanban/issues)**

**New issue** düğmesine basıp şu bilgileri yazmanız yeterlidir:

- Ne yapmaya çalışıyordunuz?
- Hangi düğmeye bastınız?
- Ne olmasını bekliyordunuz?
- Bunun yerine ne oldu?
- Varsa hata mesajının veya ekranın görüntüsü

Teknik terimler kullanmanız gerekmez.

---

## Güvenli indirme bağlantıları

- Resmi proje: [github.com/Hamitp/kanban](https://github.com/Hamitp/kanban)
- En güncel Windows sürümü: [github.com/Hamitp/kanban/releases/latest](https://github.com/Hamitp/kanban/releases/latest)
- Kurulum rehberi: [docs/KURULUM_REHBERI.md](https://github.com/Hamitp/kanban/blob/main/docs/KURULUM_REHBERI.md)
- Hata ve öneriler: [github.com/Hamitp/kanban/issues](https://github.com/Hamitp/kanban/issues)

