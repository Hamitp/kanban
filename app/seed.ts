import type { AppData, KanbanBoard, Language, MindMap, Project } from "./types";

const text = (language: Language, tr: string, en: string) => language === "tr" ? tr : en;

const iso = (days = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createBoard(
  projectId: string,
  title?: string,
  language: Language = "tr",
): KanbanBoard {
  const columnIds = Array.from({ length: 4 }, () => newId());
  const now = iso();
  return {
    id: newId(),
    kind: "board",
    projectId,
    title: title ?? text(language, "Yeni Kanban Board", "New Kanban Board"),
    description: text(language, "İşleri yakala, önceliklendir ve sakin bir akışta tamamla.", "Capture, prioritize and complete work in a calm flow."),
    zoom: 1,
    archived: false,
    createdAt: now,
    updatedAt: now,
    tasks: {},
    columns: [
      {
        id: columnIds[0],
        title: text(language, "Toplam İş Listesi", "Backlog"),
        color: "#8b7cf6",
        role: "backlog",
        taskIds: [],
      },
      {
        id: columnIds[1],
        title: text(language, "İş Listesi", "Prioritized"),
        color: "#5d9cec",
        role: "planned",
        taskIds: [],
      },
      {
        id: columnIds[2],
        title: text(language, "Üzerinde Çalışılanlar", "In Progress"),
        color: "#f2a55f",
        role: "active",
        taskIds: [],
      },
      {
        id: columnIds[3],
        title: text(language, "Tamamlananlar", "Completed"),
        color: "#65af87",
        role: "done",
        taskIds: [],
      },
    ],
  };
}

export function createMindMap(
  projectId: string,
  title?: string,
  language: Language = "tr",
): MindMap {
  const now = iso();
  return {
    id: newId(),
    kind: "mindmap",
    projectId,
    title: title ?? text(language, "Yeni Zihin Haritası", "New Mind Map"),
    description: text(language, "Fikirleri görünür hale getir ve aralarındaki bağı keşfet.", "Make ideas visible and discover the connections between them."),
    zoom: 1,
    archived: false,
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: newId(),
        title: text(language, "Ana fikir", "Main idea"),
        note: text(language, "Haritanızın merkez noktası", "The center of your map"),
        x: 620,
        y: 340,
        color: "violet",
      },
    ],
  };
}

export function createSeedData(language: Language = "tr"): AppData {
  const now = iso();
  const projectOne: Project = {
    id: newId(),
    name: text(language, "Kanban Uygulaması", "Kanban Application"),
    description: text(language, "Yerel ve zarif çalışma alanı", "A refined local workspace"),
    color: "#6f63d9",
    clientName: text(language, "Örnek Müşteri", "Sample Client"),
    status: "active",
    finance: {
      currency: "TRY",
      agreedAmountKurus: 25_000_000,
      payments: [
        {
          id: newId(),
          amountKurus: 7_500_000,
          receivedOn: iso(-12).slice(0, 10),
          note: text(language, "Başlangıç ödemesi", "Initial payment"),
          createdAt: iso(-12),
          updatedAt: iso(-12),
        },
      ],
    },
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  const projectTwo: Project = {
    id: newId(),
    name: text(language, "Kişisel Sistem", "Personal System"),
    description: text(language, "Haftalık plan ve gelişim alanı", "Weekly planning and growth space"),
    color: "#d27a55",
    status: "active",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const board = createBoard(projectOne.id, text(language, "Ürün Yol Haritası", "Product Roadmap"), language);
  const [backlog, planned, active, done] = board.columns;
  const taskIds = Array.from({ length: 7 }, () => newId());
  board.tasks = {
    [taskIds[0]]: {
      id: taskIds[0],
      title: text(language, "Çevrimdışı veri mimarisini kur", "Build the offline data architecture"),
      description: text(language, "IndexedDB, otomatik kayıt ve dışa aktarma akışını tamamla.", "Complete IndexedDB, automatic saving and export flows."),
      priority: "high",
      labelIds: ["label-product"],
      assigneeIds: ["member-hamit"],
      dueDate: iso(2).slice(0, 10),
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[1]]: {
      id: taskIds[1],
      title: text(language, "Zihin haritası etkileşimlerini tasarla", "Design mind map interactions"),
      description: text(language, "Node ekleme, taşıma ve dal yapısının temel davranışları.", "Core behaviors for adding, moving and branching nodes."),
      priority: "medium",
      labelIds: ["label-design"],
      assigneeIds: ["member-hamit", "member-ayse"],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[2]]: {
      id: taskIds[2],
      title: text(language, "Paydaşlardan görsel geri bildirim al", "Collect visual feedback from stakeholders"),
      description: text(language, "İlk prototip için kısa değerlendirme oturumu.", "A short review session for the first prototype."),
      priority: "high",
      labelIds: ["label-waiting"],
      assigneeIds: ["member-mert"],
      waitingReason: text(language, "Müşteriden toplantı tarihi bekleniyor", "Waiting for the client to confirm a meeting date"),
      dueDate: iso(5).slice(0, 10),
      workSessions: [{ startedAt: iso(-3) }],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[3]]: {
      id: taskIds[3],
      title: text(language, "Tema renklerini erişilebilirlik açısından kontrol et", "Check theme colors for accessibility"),
      description: text(language, "Dört temada metin ve durum renklerinin kontrastını doğrula.", "Verify text and status color contrast across all four themes."),
      priority: "medium",
      labelIds: ["label-design"],
      assigneeIds: ["member-ayse"],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[4]]: {
      id: taskIds[4],
      title: text(language, "İlk kullanıcı akışını yaz", "Write the first user flow"),
      description: text(language, "Proje oluşturma ve ilk kartı ekleme adımlarını sadeleştir.", "Simplify project creation and adding the first card."),
      priority: "low",
      labelIds: ["label-quick"],
      assigneeIds: ["member-hamit"],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[5]]: {
      id: taskIds[5],
      title: text(language, "Proje kapsamını netleştir", "Clarify the project scope"),
      description: text(language, "Kanban panosu, zihin haritası ve arşiv ihtiyaçları belirlendi.", "Kanban board, mind map and archive requirements were defined."),
      priority: "medium",
      labelIds: ["label-product"],
      assigneeIds: ["member-hamit"],
      workSessions: [{ startedAt: iso(-4), endedAt: iso(-2) }],
      completedAt: iso(-2),
      createdAt: iso(-2),
      updatedAt: iso(-1),
    },
    [taskIds[6]]: {
      id: taskIds[6],
      title: text(language, "GitHub deposunu hazırla", "Prepare the GitHub repository"),
      description: text(language, "Açık depo ve MIT lisansı tamamlandı.", "The public repository and MIT license are ready."),
      priority: "low",
      labelIds: ["label-quick"],
      assigneeIds: ["member-hamit"],
      workSessions: [{ startedAt: iso(-2), endedAt: iso(-1) }],
      completedAt: iso(-1),
      createdAt: iso(-2),
      updatedAt: iso(-1),
    },
  };
  backlog.taskIds = [taskIds[1], taskIds[3]];
  planned.taskIds = [taskIds[0], taskIds[4]];
  active.taskIds = [taskIds[2]];
  done.taskIds = [taskIds[5], taskIds[6]];

  const personalBoard = createBoard(projectTwo.id, text(language, "Haftalık Akış", "Weekly Flow"), language);
  const map = createMindMap(projectOne.id, text(language, "Ürün Vizyonu", "Product Vision"), language);
  const root = map.nodes[0];
  map.nodes.push(
    {
      id: newId(),
      title: text(language, "Sakin odak", "Calm focus"),
      note: text(language, "Gürültüsüz ve motive edici arayüz", "A quiet and motivating interface"),
      x: 330,
      y: 180,
      color: "coral",
      parentId: root.id,
    },
    {
      id: newId(),
      title: text(language, "Yerel güven", "Local confidence"),
      note: text(language, "Çevrimdışı çalışma ve kolay yedek", "Offline work and effortless backups"),
      x: 930,
      y: 190,
      color: "sage",
      parentId: root.id,
    },
    {
      id: newId(),
      title: text(language, "Düşünceden işe", "From thought to action"),
      note: text(language, "Zihin haritası ile Kanban panosu arasında doğal geçiş", "A natural transition from mind map to Kanban board"),
      x: 930,
      y: 520,
      color: "blue",
      parentId: root.id,
    },
  );

  return {
    version: 1,
    workspaceName: text(language, "Kişisel Alanım", "Personal Workspace"),
    theme: "linen",
    projects: [projectOne, projectTwo],
    boards: [board, personalBoard],
    mindMaps: [map],
    members: [
      {
        id: "member-hamit",
        name: "Hamit Parlak",
        initials: "HP",
        color: "#6558c7",
        active: true,
      },
      {
        id: "member-ayse",
        name: "Ayşe Kaya",
        initials: "AK",
        color: "#d16d88",
        active: true,
      },
      {
        id: "member-mert",
        name: "Mert Demir",
        initials: "MD",
        color: "#4f8da8",
        active: true,
      },
    ],
    labels: [
      { id: "label-waiting", name: text(language, "Müşteri bekleniyor", "Waiting for client"), color: "#d88932" },
      { id: "label-blocked", name: text(language, "Engellendi", "Blocked"), color: "#ca5d65" },
      { id: "label-product", name: text(language, "Ürün", "Product"), color: "#6d61d4" },
      { id: "label-design", name: text(language, "Tasarım", "Design"), color: "#cc6887" },
      { id: "label-quick", name: text(language, "Hızlı kazanım", "Quick win"), color: "#4f9b79" },
    ],
    lastOpened: { kind: "board", id: board.id },
    updatedAt: now,
  };
}
