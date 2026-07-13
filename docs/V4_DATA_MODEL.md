# Akış v4.0.0 — Veri Modeli ve Geçiş Sözleşmesi

## Sürümleme

- `WorkspaceStore.version`: 3 → 4
- `AppData.version`: 1 → 2
- v2/v3 dış kapları ve v1 iç verileri okunmaya devam eder; bellekte v4/v2 biçimine normalize edilir.
- Eski para birimi, finans, çalışma alanı ve arşiv alanları değiştirilmez.

## Görev genişletmeleri

- `effortPoints`: `1 | 2 | 3 | 5 | 8 | 13`, eksikse 1.
- `transitions`: görevin kaynak/hedef sütun ve akış anlamını tarih ile kaydeden olaylar.
- `sourceLinks`: zihin düğümü, sorun veya A3 aksiyonu gibi kaynaklara güvenli bağlantılar.

Geçmiş görevlerde oluşturulma olayı `createdAt` ile üretilir. Mevcut sütunun akış anlamı için geçiş tarihi kesin bilinmiyorsa veri uydurulmaz; kayıt `inferred: true` olarak işaretlenir.

## Sorun kaydı

Sorun; proje kimliği, isteğe bağlı pano/görev bağlantısı, durum, önem, etki, kanıtlar, 5 Neden, balık kılçığı, A3, düzeltici aksiyonlar, doğrulama ve öğrenilen ders alanlarını içerir.

Bağlı pano veya görev silinirse sorun kaydı açılmaya devam eder; geçersiz bağlantı normalizasyon sırasında güvenli biçimde kaldırılır, analiz içeriği korunur.

## Zihin düğümü bağlantısı

Bağlantı yalnız görev kimliği ile değil `boardId + taskId` ile saklanır. Mevcut `linkedTaskId` alanı geçiş sırasında korunur ve mümkünse yeni bağlantıya dönüştürülür.

## Takvim olayı

Takvim olayı çalışma alanının iç verisindedir. Başlık, YYYY-MM-DD tarih, isteğe bağlı başlangıç/bitiş saati, tür, proje kimliği, not ve zaman damgaları içerir.

Görev son tarihleri ayrı takvim olayı olarak kopyalanmaz; görevlerden türetilir. Böylece görev tarihi değiştiğinde takvimde çift veya bayat kayıt oluşmaz.

## İzolasyon ve silme kuralları

- Sorun, etkinlik ve bağlantılar yalnız aktif çalışma alanının `AppData` verisindedir.
- Bir proje arşivlenince ilişkili kayıtlar korunur ve normal aktif listelerden gizlenir.
- Proje kalıcı silme özeti sorun ve takvim bağlantılarını da açıkça sayar.
- Görev silinmesi bağlı sorun/A3 kaydını silmez; yalnız geçersiz görev bağlantısını kaldırır.

## Burn-up doğruluğu

- Kapsam: planned, active ve done rollerine giren görevlerin toplamı.
- Backlog kapsam dışıdır.
- Görev sayısı modunda her görev 1; puan modunda `effortPoints` kadar ağırlıktadır.
- v4 sonrası geçişler kesin; eski veriden üretilen başlangıç noktaları yaklaşık olarak işaretlenir.
