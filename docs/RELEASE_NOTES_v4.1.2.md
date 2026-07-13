# Akış v4.1.2 - Etiket yönetimi

Bu küçük düzeltme sürümü, Kanban görevlerinde oluşturulan etiketlerin daha sonra güvenli biçimde silinebilmesini sağlar.

- Görev ayrıntılarındaki her kayıtlı etiketin yanında erişilebilir bir silme düğmesi bulunur.
- Kullanılan bir etiket silinmeden önce etkilenecek görev sayısı açıkça gösterilir.
- Onay verildiğinde yalnızca etiket ve görevlerdeki etiket bağlantıları kaldırılır; görevler korunur.
- Silme işleminden vazgeçildiğinde hiçbir veri değiştirilmez.
- Henüz görevle birlikte kaydedilmemiş yeni bir etiket doğrudan formdan kaldırılabilir.
- Türkçe ve İngilizce uyarılar ile sonuç bildirimleri desteklenir.
- Mevcut çalışma alanları ve kayıt dosyalarıyla tam uyumludur; veri dönüşümü gerekmez.

## English

This patch release adds safe deletion for labels created in Kanban tasks.

- Every saved label in Task Details now has an accessible delete button.
- Before deleting a label in use, Akış clearly reports how many tasks will be affected.
- Confirmation removes only the label and its references; tasks are preserved.
- Cancelling leaves all data unchanged.
- A newly drafted label can be removed before the task is saved.
- Confirmation and result messages are available in Turkish and English.
- Existing workspaces and save files remain fully compatible; no data migration is required.
