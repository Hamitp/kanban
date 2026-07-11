# Akış

Akış; birden fazla projeyi Kanban boardlar ve mind mapler aracılığıyla yöneten, yerel ve çevrimdışı öncelikli kişisel çalışma alanıdır.

## Özellikler

- Proje altında birden fazla Kanban board ve mind map
- Özelleştirilebilir sütunlar ve sürükle-bırak görev akışı
- Etiketler, bekleme/engel nedeni, son tarih ve çoklu kişi ataması
- Görev çalışma süresi ve proje ilerleme analitiği
- Mind map üzerinde fikir ekleme, taşıma, renklendirme ve otomatik düzen
- Arşivleme, geri getirme ve başka projeye bağımsız kopyalama
- Dört tema ve cihaz üzerinde otomatik kayıt
- JSON yedekleme / geri yükleme ve çevrimdışı uygulama kabuğu

## Yerelde çalıştırma

Node.js 22.13 veya daha yeni bir sürümle:

```bash
npm install
npm run dev
```

Ardından `http://localhost:3000` adresini açın. Üretim kontrolü için `npm run build` kullanılır.

Veriler tarayıcının IndexedDB alanında saklanır. Düzenli olarak **Ayarlar → Yedekleme** bölümünden dışa aktarma yapılması önerilir.

## Lisans

MIT
