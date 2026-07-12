"use client";

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import type { CurrencyCode, Language } from "./types";

type TranslationValues = Record<string, string | number>;
type Translator = (source: string, values?: TranslationValues) => string;

const english: Record<string, string> = {
  "Akış hazırlanıyor": "Getting Flow ready",
  "Çalışma alanınız yerelden açılıyor...": "Opening your workspace locally...",
  "Genel Bakış": "Overview",
  "Projeler": "Projects",
  "Kanban Panoları": "Kanban Boards",
  "Zihin Haritaları": "Mind Maps",
  "İçgörüler": "Insights",
  "Arşiv": "Archive",
  "Ayarlar": "Settings",
  "Yerel çalışma alanı": "Local workspace",
  "ÇALIŞMA ALANI": "WORKSPACE",
  "Çalışma alanları": "Workspaces",
  "Yeni çalışma alanı": "New workspace",
  "Ana menü": "Main navigation",
  "Yeni proje": "New project",
  "Menüyü daralt": "Collapse menu",
  "Menüyü genişlet": "Expand menu",
  "Çalışma alanını değiştir": "Switch workspace",
  "Genel Bakışa git": "Go to Overview",
  "Çalışma alanında ara": "Search workspace",
  "Arama sonuçları": "Search results",
  "Aramayı kapat": "Close search",
  "Proje, görev veya fikir arayın": "Search for a project, task or idea",
  "Eşleşen sonuç bulunamadı.": "No matching results found.",
  "Kaydediliyor": "Saving",
  "Kaydedilemedi · yeniden deneniyor": "Could not save · retrying",
  "Save klasörüne kaydedildi": "Saved to the Save folder",
  "Yerelde kayıtlı": "Saved locally",
  "Save klasörü": "Save folder",
  "Geri al": "Undo",
  "Yinele": "Redo",
  "Akış profili": "Flow profile",
  "Proje": "Project",
  "Kanban panosu": "Kanban board",
  "Zihin haritası": "Mind map",
  "Görev": "Task",
  "Yeni Kanban panosu": "New Kanban board",
  "Yeni zihin haritası": "New mind map",
  "Yeni fikir": "New idea",
  "Proje bulunamadı": "Project not found",
  "Bu proje kaldırılmış veya arşivlenmiş olabilir.": "This project may have been removed or archived.",
  "Projelere dön": "Back to projects",
  "Kanban panosu bulunamadı": "Kanban board not found",
  "Zihin haritası bulunamadı": "Mind map not found",
  "Kanban panolarına dön": "Back to Kanban boards",
  "Zihin haritalarına dön": "Back to mind maps",
  "Bu çalışma silinmiş, arşivlenmiş veya artık erişilemeyen bir bağlantıdan açılmış olabilir.": "This item may have been deleted, archived or opened from a link that is no longer available.",
  "Bütün çalışma alanlarınız tek bakışta.": "See all your work at a glance.",
  "Henüz proje yok": "No projects yet",
  "İlk projenizi oluşturduğunuzda Kanban panolarınızı ve zihin haritalarınızı burada düzenleyebilirsiniz.": "Create your first project to organize Kanban boards and mind maps here.",
  "Kanban panolarınız": "Your Kanban boards",
  "Zihin haritalarınız": "Your mind maps",
  "Önceliklerinizi akışa dönüştüren çalışma yüzeyleri.": "Work surfaces that turn priorities into flow.",
  "Düşünceleriniz arasındaki bağları görünür kılın.": "Make the connections between your thoughts visible.",
  "Yeni Kanban panosu oluştur": "Create a new Kanban board",
  "Yeni zihin haritası oluştur": "Create a new mind map",
  "Henüz Kanban panosu yok": "No Kanban boards yet",
  "Henüz zihin haritası yok": "No mind maps yet",
  "Bir proje oluşturup ilk görev akışınızı kurabilirsiniz.": "Create a project and build your first task flow.",
  "Bir proje oluşturup düşüncelerinizi dallandırmaya başlayabilirsiniz.": "Create a project and start branching out your ideas.",
  "Çoğalt": "Duplicate",
  "Arşivle": "Archive",
  "Boş bir çalışma yüzeyiyle başlayın": "Start with a blank work surface",
  "GÜVENLİ SAKLAMA": "SAFE KEEPING",
  "Tamamlanan veya şimdilik görünmemesi gereken çalışmalar burada korunur.": "Completed work and items you do not need to see right now are kept here.",
  "Arşiv, silmek değildir.": "Archiving is not deleting.",
  "Her şeyi içeriği ve düzeniyle geri getirebilirsiniz.": "You can restore everything with its content and layout intact.",
  "Geri getir": "Restore",
  "Kalıcı sil": "Delete permanently",
  "Arşiv boş": "Archive is empty",
  "Arşivlediğiniz proje ve çalışmalar burada görünecek.": "Archived projects and work will appear here.",
  "TERCİHLER": "PREFERENCES",
  "Çalışma alanınızı size ait hissettiren ayrıntılar.": "Details that make the workspace feel like yours.",
  "Kişisel ve iş içeriklerinizi birbirinden tamamen ayrı tutun.": "Keep personal and work content completely separate.",
  "aktif": "active",
  "arşivde": "archived",
  "Arşivlendi": "Archived",
  "Şu anda açık": "Currently open",
  "Aç": "Open",
  "Adlandır": "Rename",
  "Çalışma alanı": "Workspace",
  "Profiliniz selamlamada ve avatarınızda; çalışma alanı adı ise tüm projelerinizin üzerinde görünür.": "Your profile appears in greetings and your avatar; the workspace name appears above all projects.",
  "Profil adı": "Profile name",
  "Yalnız bu cihazdaki kişisel selamlama için kullanılır.": "Used only for your personal greeting on this device.",
  "Çalışma alanı adı": "Workspace name",
  "Kaydet": "Save",
  "Tema": "Theme",
  "Odak biçiminize uygun görünümü seçin.": "Choose the look that suits your way of focusing.",
  "Kişiler": "People",
  "Görev atamak için yerel kişi dizininiz.": "Your local directory for assigning tasks.",
  "aktif kişi": "active people",
  "Kişi ekle": "Add person",
  "Aktif": "Active",
  "Pasif · geçmiş atamalar korunur": "Inactive · past assignments are preserved",
  "Pasifleştir": "Deactivate",
  "Etkinleştir": "Activate",
  "Sil": "Delete",
  "Otomatik kayıt": "Automatic saving",
  "Hiçbir işlem yapmanız gerekmez. Akış bütün değişiklikleri dosyaya ve yedeklere kendisi yazar.": "You do not need to do anything. Flow writes every change to the file and backups automatically.",
  "Save klasörüne otomatik kaydediliyor": "Saving automatically to the Save folder",
  "Otomatik güvenlik kopyaları": "Automatic safety backups",
  "Her saat değişiklik varsa yeni bir kopya oluşturulur; son 60 sağlam yedek korunur.": "When changes exist, a new copy is created every hour; the latest 60 valid backups are kept.",
  "Save klasörünü aç": "Open Save folder",
  "Yedekleme": "Backup",
  "Tarayıcı sürümünde taşınabilir bir dosya alabilirsiniz.": "You can create a portable file in the browser version.",
  "Çalışma alanını dışa aktar": "Export workspace",
  "Tüm proje, görev, kişi ve zihin haritası verilerini taşınabilir JSON dosyasına kaydeder.": "Saves all project, task, person and mind map data to a portable JSON file.",
  "Yedek indir": "Download backup",
  "Yedekten geri yükle": "Restore from backup",
  "Daha önce alınan bir Akış yedeğini bu cihazda açar.": "Opens a previously created Flow backup on this device.",
  "Dosya seç": "Choose file",
  "Dil ve bölge": "Language and region",
  "Uygulama dili": "Application language",
  "Yeni proje varsayılan para birimi": "Default currency for new projects",
  "Bu yalnızca yeni projelerde başlangıç seçimini belirler; mevcut projeleri değiştirmez.": "This only sets the initial selection for new projects; it does not change existing projects.",
  "Türkçe": "Turkish",
  "İngilizce": "English",
  "Proje bilgilerini düzenle": "Edit project details",
  "Hedefi, müşteriyi ve finansal çerçeveyi tek yerde tanımlayın. Finans alanları isteğe bağlıdır.": "Define the goal, client and financial framework in one place. Financial fields are optional.",
  "Proje adı": "Project name",
  "Müşteri / kurum": "Client / organization",
  "İsteğe bağlı": "Optional",
  "Kısa açıklama": "Short description",
  "Bu projede neyi başarmak istiyorsunuz?": "What do you want to achieve in this project?",
  "Müşteriyle anlaşılan tutar": "Agreed amount with client",
  "Para birimi": "Currency",
  "Kişisel veya ücretsiz projelerde boş bırakabilirsiniz.": "You may leave this blank for personal or unpaid projects.",
  "Tahsilat bulunan projede para birimi değiştirilemez.": "The currency cannot be changed after a payment has been recorded.",
  "Proje rengi": "Project color",
  "Vazgeç": "Cancel",
  "Değişiklikleri kaydet": "Save changes",
  "Projeyi oluştur": "Create project",
  "Tahsilatı düzenle": "Edit payment",
  "Tahsilat ekle": "Add payment",
  "Kalan alacak": "Outstanding receivable",
  "Tutar": "Amount",
  "Tahsil tarihi": "Payment date",
  "Not": "Note",
  "Tahsilatı güncelle": "Update payment",
  "Tahsilatı kaydet": "Save payment",
  "Her çalışma bir projeye bağlıdır.": "Every item belongs to a project.",
  "Önce bir proje oluşturun": "Create a project first",
  "Yeni proje oluştur": "Create new project",
  "Varsayılan dört sütunla başlayın, sonra dilediğiniz gibi değiştirin.": "Start with four default columns, then customize them as you like.",
  "Ana fikri merkeze koyun ve dalları büyütün.": "Place the main idea at the center and grow the branches.",
  "Ad": "Name",
  "Oluştur": "Create",
  "Bağımsız bir kopya oluştur": "Create an independent copy",
  "Kaynak çalışma değişmeden yeni bir altlık hazırlayın.": "Create a new foundation without changing the source item.",
  "Hedef proje": "Target project",
  "Tüm içerikle": "With all content",
  "Yalnız yapı": "Structure only",
  "Kopyayı oluştur": "Create copy",
  "Çalışma alanına kişi ekle": "Add person to workspace",
  "Bu kişi yerel görev atamalarında kullanılacak.": "This person will be used for local task assignments.",
  "Ad soyad": "Full name",
  "Avatar rengi": "Avatar color",
  "Kişiyi ekle": "Add person",
  "Çalışma alanını yeniden adlandır": "Rename workspace",
  "Yeni ad yalnızca bu çalışma alanını etkiler.": "The new name affects only this workspace.",
  "Projeleri, finansı, kişileri ve aramaları tamamen ayrı yeni bir alan oluşturun.": "Create a completely separate space for projects, finances, people and searches.",
  "Alan rengi": "Workspace color",
  "Tamamen yerel ve ayrı": "Entirely local and separate",
  "Bu alanda yalnızca burada oluşturduğunuz proje, finans, kişi ve çalışmalar görünür.": "Only projects, finances, people and work created here are visible in this workspace.",
  "Adı kaydet": "Save name",
  "Çalışma alanını oluştur": "Create workspace",
  "Pencereyi kapat": "Close window",
  "Keten": "Linen",
  "Aydınlık ve sakin": "Light and calm",
  "Gece": "Night",
  "Derin odak": "Deep focus",
  "Kum": "Sand",
  "Sıcak ve doğal": "Warm and natural",
  "Orman": "Forest",
  "Dingin ve koyu": "Calm and dark",
};

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function createTranslator(language: Language): Translator {
  return (source, values) => interpolate(language === "en" ? english[source] ?? source : source, values);
}

interface I18nContextValue {
  language: Language;
  locale: "tr-TR" | "en-GB";
  t: Translator;
}

const I18nContext = createContext<I18nContextValue>({
  language: "tr",
  locale: "tr-TR",
  t: createTranslator("tr"),
});

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: language === "tr" ? "tr-TR" : "en-GB",
    t: createTranslator(language),
  }), [language]);
  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}

export function currencyName(currency: CurrencyCode, language: Language): string {
  const names: Record<Language, Record<CurrencyCode, string>> = {
    tr: { TRY: "Türk lirası", USD: "Amerikan doları", EUR: "Euro", GBP: "İngiliz sterlini" },
    en: { TRY: "Turkish lira", USD: "US dollar", EUR: "Euro", GBP: "British pound" },
  };
  return names[language][currency];
}

export function languageName(language: Language, displayLanguage: Language): string {
  return displayLanguage === "tr"
    ? language === "tr" ? "Türkçe" : "İngilizce"
    : language === "tr" ? "Turkish" : "English";
}

export const englishTranslations = english;
