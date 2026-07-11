import type { AppData, KanbanBoard, MindMap } from "./types";

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
  title = "Yeni Kanban Board",
): KanbanBoard {
  const columnIds = Array.from({ length: 4 }, () => newId());
  const now = iso();
  return {
    id: newId(),
    kind: "board",
    projectId,
    title,
    description: "İşleri yakala, önceliklendir ve sakin bir akışta tamamla.",
    archived: false,
    createdAt: now,
    updatedAt: now,
    tasks: {},
    columns: [
      {
        id: columnIds[0],
        title: "Toplam İş Listesi",
        color: "#8b7cf6",
        role: "backlog",
        taskIds: [],
      },
      {
        id: columnIds[1],
        title: "İş Listesi",
        color: "#5d9cec",
        role: "planned",
        taskIds: [],
      },
      {
        id: columnIds[2],
        title: "Üzerinde Çalışılanlar",
        color: "#f2a55f",
        role: "active",
        taskIds: [],
      },
      {
        id: columnIds[3],
        title: "Tamamlananlar",
        color: "#65af87",
        role: "done",
        taskIds: [],
      },
    ],
  };
}

export function createMindMap(
  projectId: string,
  title = "Yeni Mind Map",
): MindMap {
  const now = iso();
  return {
    id: newId(),
    kind: "mindmap",
    projectId,
    title,
    description: "Fikirleri görünür hale getir ve aralarındaki bağı keşfet.",
    archived: false,
    createdAt: now,
    updatedAt: now,
    nodes: [
      {
        id: newId(),
        title: "Ana fikir",
        note: "Haritanızın merkez noktası",
        x: 620,
        y: 340,
        color: "violet",
      },
    ],
  };
}

export function createSeedData(): AppData {
  const now = iso();
  const projectOne = {
    id: newId(),
    name: "Kanban Uygulaması",
    description: "Yerel ve zarif çalışma alanı",
    color: "#6f63d9",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  const projectTwo = {
    id: newId(),
    name: "Kişisel Sistem",
    description: "Haftalık plan ve gelişim alanı",
    color: "#d27a55",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const board = createBoard(projectOne.id, "Ürün Yol Haritası");
  const [backlog, planned, active, done] = board.columns;
  const taskIds = Array.from({ length: 7 }, () => newId());
  board.tasks = {
    [taskIds[0]]: {
      id: taskIds[0],
      title: "Çevrimdışı veri mimarisini kur",
      description: "IndexedDB, otomatik kayıt ve dışa aktarma akışını tamamla.",
      priority: "high",
      labelIds: ["label-product"],
      assigneeIds: ["member-hamit"],
      dueDate: iso(2).slice(0, 10),
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[1]]: {
      id: taskIds[1],
      title: "Mind map etkileşimlerini tasarla",
      description: "Node ekleme, taşıma ve dal yapısının temel davranışları.",
      priority: "medium",
      labelIds: ["label-design"],
      assigneeIds: ["member-hamit", "member-ayse"],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[2]]: {
      id: taskIds[2],
      title: "Paydaşlardan görsel geri bildirim al",
      description: "İlk prototip için kısa değerlendirme oturumu.",
      priority: "high",
      labelIds: ["label-waiting"],
      assigneeIds: ["member-mert"],
      waitingReason: "Müşteriden toplantı tarihi bekleniyor",
      dueDate: iso(5).slice(0, 10),
      workSessions: [{ startedAt: iso(-3) }],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[3]]: {
      id: taskIds[3],
      title: "Tema renklerini erişilebilirlik açısından kontrol et",
      description: "Dört temada metin ve durum renklerinin kontrastını doğrula.",
      priority: "medium",
      labelIds: ["label-design"],
      assigneeIds: ["member-ayse"],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[4]]: {
      id: taskIds[4],
      title: "İlk kullanıcı akışını yaz",
      description: "Proje oluşturma ve ilk kartı ekleme adımlarını sadeleştir.",
      priority: "low",
      labelIds: ["label-quick"],
      assigneeIds: ["member-hamit"],
      createdAt: now,
      updatedAt: now,
    },
    [taskIds[5]]: {
      id: taskIds[5],
      title: "Proje kapsamını netleştir",
      description: "Kanban, mind map ve arşiv ihtiyaçları belirlendi.",
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
      title: "GitHub deposunu hazırla",
      description: "Açık depo ve MIT lisansı tamamlandı.",
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

  const personalBoard = createBoard(projectTwo.id, "Haftalık Akış");
  const map = createMindMap(projectOne.id, "Ürün Vizyonu");
  const root = map.nodes[0];
  map.nodes.push(
    {
      id: newId(),
      title: "Sakin odak",
      note: "Gürültüsüz ve motive edici arayüz",
      x: 330,
      y: 180,
      color: "coral",
      parentId: root.id,
    },
    {
      id: newId(),
      title: "Yerel güven",
      note: "Çevrimdışı çalışma ve kolay yedek",
      x: 930,
      y: 190,
      color: "sage",
      parentId: root.id,
    },
    {
      id: newId(),
      title: "Düşünceden işe",
      note: "Mind map ile Kanban arasında doğal geçiş",
      x: 930,
      y: 520,
      color: "blue",
      parentId: root.id,
    },
  );

  return {
    version: 1,
    workspaceName: "Hamit'in Çalışma Alanı",
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
      { id: "label-waiting", name: "Müşteri bekleniyor", color: "#d88932" },
      { id: "label-blocked", name: "Engellendi", color: "#ca5d65" },
      { id: "label-product", name: "Ürün", color: "#6d61d4" },
      { id: "label-design", name: "Tasarım", color: "#cc6887" },
      { id: "label-quick", name: "Hızlı kazanım", color: "#4f9b79" },
    ],
    lastOpened: { kind: "board", id: board.id },
    updatedAt: now,
  };
}
