# Akış v4.2.0 - Kişi bazlı iş yükü analizi

Bu sürüm, **İçgörüler > Kişi bazlı görev yükü** kartına iki tamamlayıcı kapasite görünümü ekler:

- **Görev sayısı:** Her aktif kişinin üzerindeki tamamlanmamış görev adedini gösterir ve mevcut varsayılan davranışı korur.
- **İş yükü puanı:** Görevlerin `1, 2, 3, 5, 8 veya 13` puanlık tahminlerini kişi bazında toplar. Eski kayıtlardaki eksik veya geçersiz puanlar güvenli biçimde `1` kabul edilir.
- Seçilen ölçüte göre kişi sırası, çubuk uzunluğu ve değer etiketi birlikte güncellenir. Eşitliklerde ad sırası kullanılır.
- Havuz, önceliklendirilmiş ve aktif sütunlardaki görevler hesaba katılır; tamamlanan görevler hariç tutulur.
- Yalnız aktif kişiler, aktif ve arşivlenmemiş projeler ile arşivlenmemiş Kanban panoları kapasiteye dahil edilir. Tamamlanmış, teslim edilmiş veya arşivlenmiş projeler dışarıda kalır.
- Birden fazla kişiye atanmış ortak görev, görev adedi ve tam iş yükü puanıyla her atanan kişiye ayrı ayrı yazılır.
- Ölçüt seçimi yalnız açık ekran oturumu için geçerlidir; kayıt dosyasına yeni alan eklenmez.
- Türkçe ve İngilizce metinler, klavye odağı, ekran okuyucu etiketleri ve dar ekran yerleşimi desteklenir.
- Mevcut `Save` dosyalarıyla tam uyumludur; veri dönüşümü gerekmez.
- Geliştirme bağımlılıklarındaki `brace-expansion` güvenlik bildirimi giderilmiştir.

## English

This release adds two complementary capacity views to **Insights > Workload by person**:

- **Task count:** Shows each active member's unfinished task count and remains the default view.
- **Effort points:** Totals the `1, 2, 3, 5, 8 or 13` point estimates assigned to each member. Missing or invalid values in legacy records safely count as `1`.
- Person order, bar length, and value labels update together for the selected metric. Ties are sorted by name.
- Tasks in backlog, prioritized, and active columns are included; completed tasks are excluded.
- Capacity includes only active members, active non-archived projects, and non-archived Kanban boards. Completed, delivered, or archived projects are excluded.
- A shared task contributes its full task count and full effort points to every assignee.
- The metric choice lasts only for the current screen session; no field is added to the saved data.
- Turkish and English copy, keyboard focus, screen-reader labels, and narrow-screen layouts are supported.
- Existing `Save` files remain fully compatible; no data migration is required.
- The `brace-expansion` advisory in development dependencies has been resolved.
