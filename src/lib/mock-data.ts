import type {
  ClassRoom,
  FlashcardDeck,
  Homework,
  Lesson,
  Quiz,
  User,
  Vocab,
} from "./types";

export const users: User[] = [
  {
    id: "u-1",
    name: "Nguyễn Minh An",
    email: "an.nguyen@classhub.vn",
    role: "student",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=minhan",
    classIds: ["c-1", "c-2"],
  },
  {
    id: "u-2",
    name: "Trần Thu Hà",
    email: "ha.tran@classhub.vn",
    role: "teacher",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=thuha",
    classIds: ["c-1", "c-2", "c-3"],
  },
  {
    id: "u-3",
    name: "Lê Hoàng Quân",
    email: "admin@classhub.vn",
    role: "admin",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=hoangquan",
  },
  { id: "s-2", name: "Phạm Thuỳ Linh", email: "linh.pham@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=thuylinh", classIds: ["c-1", "c-2"] },
  { id: "s-3", name: "Đỗ Quang Huy", email: "huy.do@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=quanghuy", classIds: ["c-1", "c-2"] },
  { id: "s-4", name: "Vũ Phương Anh", email: "anh.vu@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=phuonganh", classIds: ["c-1"] },
  { id: "s-5", name: "Hoàng Đức Mạnh", email: "manh.hoang@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=ducmanh", classIds: ["c-1"] },
  { id: "s-6", name: "Bùi Mai Chi", email: "chi.bui@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=maichi", classIds: ["c-1"] },
  { id: "s-7", name: "Lý Tuấn Khang", email: "khang.ly@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=tuankhang", classIds: ["c-1"] },
  { id: "s-8", name: "Ngô Hà My", email: "my.ngo@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=hamy", classIds: ["c-1"] },
  { id: "s-9", name: "Trịnh Bảo Long", email: "long.trinh@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=baolong", classIds: ["c-2"] },
  { id: "s-10", name: "Đặng Khánh Vy", email: "vy.dang@classhub.vn", role: "student", avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=khanhvy", classIds: ["c-2"] },
];

export interface ClassStudentStat {
  userId: string;
  classId: string;
  homeworkDone: number;
  homeworkTotal: number;
  vocabLearned: number;
  quizAvg: number;
  streak: number;
}

export const classStudentStats: ClassStudentStat[] = [
  { userId: "u-1", classId: "c-1", homeworkDone: 11, homeworkTotal: 12, vocabLearned: 142, quizAvg: 92, streak: 14 },
  { userId: "s-2", classId: "c-1", homeworkDone: 12, homeworkTotal: 12, vocabLearned: 158, quizAvg: 95, streak: 21 },
  { userId: "s-3", classId: "c-1", homeworkDone: 10, homeworkTotal: 12, vocabLearned: 128, quizAvg: 84, streak: 8 },
  { userId: "s-4", classId: "c-1", homeworkDone: 9, homeworkTotal: 12, vocabLearned: 117, quizAvg: 79, streak: 5 },
  { userId: "s-5", classId: "c-1", homeworkDone: 8, homeworkTotal: 12, vocabLearned: 102, quizAvg: 75, streak: 3 },
  { userId: "s-6", classId: "c-1", homeworkDone: 12, homeworkTotal: 12, vocabLearned: 149, quizAvg: 88, streak: 17 },
  { userId: "s-7", classId: "c-1", homeworkDone: 7, homeworkTotal: 12, vocabLearned: 88, quizAvg: 71, streak: 2 },
  { userId: "s-8", classId: "c-1", homeworkDone: 11, homeworkTotal: 12, vocabLearned: 135, quizAvg: 90, streak: 12 },
  { userId: "u-1", classId: "c-2", homeworkDone: 6, homeworkTotal: 9, vocabLearned: 72, quizAvg: 81, streak: 6 },
  { userId: "s-2", classId: "c-2", homeworkDone: 8, homeworkTotal: 9, vocabLearned: 95, quizAvg: 89, streak: 11 },
  { userId: "s-3", classId: "c-2", homeworkDone: 7, homeworkTotal: 9, vocabLearned: 81, quizAvg: 83, streak: 7 },
  { userId: "s-9", classId: "c-2", homeworkDone: 9, homeworkTotal: 9, vocabLearned: 108, quizAvg: 93, streak: 19 },
  { userId: "s-10", classId: "c-2", homeworkDone: 5, homeworkTotal: 9, vocabLearned: 64, quizAvg: 74, streak: 4 },
];

export const classes: ClassRoom[] = [
  {
    id: "c-1",
    name: "HSK 2 — Lớp Mai Hoa",
    level: "HSK2",
    schedule: "T2-T4-T6 · 18:30 - 20:00",
    teacherId: "u-2",
    studentIds: ["u-1", "s-2", "s-3", "s-4", "s-5", "s-6", "s-7", "s-8"],
    cover:
      "https://images.unsplash.com/photo-1545987796-200677ee1011?w=900&q=80",
    description: "Lớp giao tiếp HSK 2 — chuyên đề hội thoại & viết Hán tự cơ bản.",
    progress: 62,
  },
  {
    id: "c-2",
    name: "HSK 3 — Lớp Trúc Lâm",
    level: "HSK3",
    schedule: "T3-T5 · 19:00 - 21:00",
    teacherId: "u-2",
    studentIds: ["u-1", "s-2", "s-3", "s-9", "s-10"],
    cover:
      "https://images.unsplash.com/photo-1623091410901-00e2d268901f?w=900&q=80",
    description: "HSK 3 chuyên sâu, luyện đề kết hợp ngữ pháp.",
    progress: 38,
  },
  {
    id: "c-3",
    name: "HSK 1 — Lớp Tân Mầm Non",
    level: "HSK1",
    schedule: "T7-CN · 09:00 - 10:30",
    teacherId: "u-2",
    studentIds: ["s-11", "s-12", "s-13", "s-14"],
    cover:
      "https://images.unsplash.com/photo-1571786256017-aee7a0c009b6?w=900&q=80",
    description: "Khóa nhập môn, làm quen Pinyin + 150 Hán tự đầu tiên.",
    progress: 85,
  },
];

export const vocab: Vocab[] = [
  {
    id: "v-1",
    hanzi: "你好",
    pinyin: "nǐ hǎo",
    meaning: "Xin chào",
    example: { zh: "你好，老师！", pinyin: "Nǐ hǎo, lǎoshī!", vi: "Xin chào thầy/cô!" },
    level: "HSK1",
    tags: ["chào hỏi"],
  },
  {
    id: "v-2",
    hanzi: "谢谢",
    pinyin: "xiè xie",
    meaning: "Cảm ơn",
    example: { zh: "谢谢你的帮助。", pinyin: "Xièxie nǐ de bāngzhù.", vi: "Cảm ơn sự giúp đỡ của bạn." },
    level: "HSK1",
    tags: ["lịch sự"],
  },
  {
    id: "v-3",
    hanzi: "学习",
    pinyin: "xué xí",
    meaning: "Học tập",
    example: { zh: "我喜欢学习中文。", pinyin: "Wǒ xǐhuān xuéxí Zhōngwén.", vi: "Tôi thích học tiếng Trung." },
    level: "HSK2",
    tags: ["động từ"],
  },
  {
    id: "v-4",
    hanzi: "朋友",
    pinyin: "péng you",
    meaning: "Bạn bè",
    example: { zh: "他是我最好的朋友。", pinyin: "Tā shì wǒ zuì hǎo de péngyou.", vi: "Anh ấy là bạn thân nhất của tôi." },
    level: "HSK2",
    tags: ["danh từ"],
  },
  {
    id: "v-5",
    hanzi: "工作",
    pinyin: "gōng zuò",
    meaning: "Công việc / làm việc",
    example: { zh: "我在公司工作。", pinyin: "Wǒ zài gōngsī gōngzuò.", vi: "Tôi làm việc ở công ty." },
    level: "HSK2",
    tags: ["danh từ", "động từ"],
  },
  {
    id: "v-6",
    hanzi: "时间",
    pinyin: "shí jiān",
    meaning: "Thời gian",
    example: { zh: "你有时间吗？", pinyin: "Nǐ yǒu shíjiān ma?", vi: "Bạn có thời gian không?" },
    level: "HSK2",
    tags: ["danh từ"],
  },
  {
    id: "v-7",
    hanzi: "旅行",
    pinyin: "lǚ xíng",
    meaning: "Du lịch",
    example: { zh: "我喜欢去中国旅行。", pinyin: "Wǒ xǐhuān qù Zhōngguó lǚxíng.", vi: "Tôi thích đi du lịch Trung Quốc." },
    level: "HSK3",
    tags: ["động từ"],
  },
  {
    id: "v-8",
    hanzi: "健康",
    pinyin: "jiàn kāng",
    meaning: "Sức khỏe",
    example: { zh: "祝你身体健康。", pinyin: "Zhù nǐ shēntǐ jiànkāng.", vi: "Chúc bạn sức khỏe dồi dào." },
    level: "HSK3",
    tags: ["tính từ"],
  },
  {
    id: "v-9",
    hanzi: "美丽",
    pinyin: "měi lì",
    meaning: "Xinh đẹp",
    example: { zh: "这里风景很美丽。", pinyin: "Zhèlǐ fēngjǐng hěn měilì.", vi: "Phong cảnh ở đây rất đẹp." },
    level: "HSK3",
    tags: ["tính từ"],
  },
  {
    id: "v-10",
    hanzi: "重要",
    pinyin: "zhòng yào",
    meaning: "Quan trọng",
    example: { zh: "这件事很重要。", pinyin: "Zhè jiàn shì hěn zhòngyào.", vi: "Việc này rất quan trọng." },
    level: "HSK3",
    tags: ["tính từ"],
  },
  {
    id: "v-11",
    hanzi: "再见",
    pinyin: "zài jiàn",
    meaning: "Tạm biệt",
    example: { zh: "再见，明天见！", pinyin: "Zàijiàn, míngtiān jiàn!", vi: "Tạm biệt, hẹn ngày mai!" },
    level: "HSK1",
    tags: ["chào hỏi"],
  },
  {
    id: "v-12",
    hanzi: "老师",
    pinyin: "lǎo shī",
    meaning: "Giáo viên",
    example: { zh: "她是中文老师。", pinyin: "Tā shì Zhōngwén lǎoshī.", vi: "Cô ấy là giáo viên tiếng Trung." },
    level: "HSK1",
    tags: ["danh từ"],
  },
];

export const lessons: Lesson[] = [
  {
    id: "l-1",
    classId: "c-1",
    unit: 5,
    title: "Bài 5 — Sở thích và thói quen",
    titleZh: "我的爱好",
    date: "2026-05-12",
    summary:
      "Học cách giới thiệu sở thích bằng cấu trúc 喜欢 / 不喜欢 và kết hợp với các động từ thường ngày.",
    slideEmbedUrl:
      "https://docs.google.com/presentation/d/13Etab4Z8NspSUaVWFfVk8klZ4NSM2BEZ/embed?start=false&loop=false&delayms=5000",
    slides: [
      { id: "s-1", title: "Khởi động — Hỏi nhau cuối tuần làm gì?", thumb: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80" },
      { id: "s-2", title: "Từ vựng mới (10 từ)", thumb: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80" },
      { id: "s-3", title: "Ngữ pháp: 喜欢 + Verb/Noun", thumb: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=600&q=80" },
      { id: "s-4", title: "Luyện đọc đoạn hội thoại", thumb: "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=600&q=80" },
      { id: "s-5", title: "Bài tập viết Hán tự", thumb: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80" },
    ],
    vocabIds: ["v-3", "v-4", "v-5", "v-6", "v-12"],
  },
  {
    id: "l-2",
    classId: "c-1",
    unit: 6,
    title: "Bài 6 — Đi du lịch",
    titleZh: "去旅行",
    date: "2026-05-19",
    summary:
      "Mẫu câu rủ rê, đề xuất kế hoạch và mô tả địa điểm. Trọng tâm: 去 + nơi + V.",
    slideEmbedUrl:
      "https://docs.google.com/presentation/d/13Etab4Z8NspSUaVWFfVk8klZ4NSM2BEZ/embed?start=false&loop=false&delayms=5000",
    slides: [
      { id: "s-1", title: "Bản đồ Trung Quốc — các thành phố nổi tiếng", thumb: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=80" },
      { id: "s-2", title: "Từ vựng & cụm từ chỉ địa điểm", thumb: "https://images.unsplash.com/photo-1525874684015-58379d421a52?w=600&q=80" },
      { id: "s-3", title: "Hội thoại: Đặt khách sạn", thumb: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80" },
    ],
    vocabIds: ["v-7", "v-9", "v-10"],
  },
];

export const quizzes: Quiz[] = [
  {
    id: "q-1",
    title: "Bài 5 — Kiểm tra từ vựng",
    description: "Tổng hợp 6 dạng câu hỏi xoay vòng từ vựng bài 5.",
    classId: "c-1",
    lessonId: "l-1",
    durationMin: 12,
    questions: [
      {
        id: "qq-1",
        kind: "multiple-choice",
        prompt: "「学习」có nghĩa là gì?",
        hanzi: "学习",
        options: ["Làm việc", "Học tập", "Vui chơi", "Nghỉ ngơi"],
        answer: 1,
        explanation: "学习 (xuéxí) = học tập, gồm 学 (học) + 习 (luyện tập).",
      },
      {
        id: "qq-2",
        kind: "type-pinyin",
        hanzi: "朋友",
        meaning: "Bạn bè",
        answer: "péng you",
      },
      {
        id: "qq-3",
        kind: "fill-blank",
        prompt: "我喜欢和___一起去看电影。",
        promptZh: "我喜欢和___一起去看电影。",
        answer: "朋友",
        hint: "péng you — Bạn bè",
      },
      {
        id: "qq-4",
        kind: "listen-choose",
        audio: "shijian",
        options: ["时间", "工作", "朋友", "老师"],
        answer: 0,
      },
      {
        id: "qq-5",
        kind: "sentence-order",
        tokens: ["我", "在", "公司", "工作"],
        answer: ["我", "在", "公司", "工作"],
        translation: "Tôi làm việc tại công ty.",
      },
      {
        id: "qq-6",
        kind: "match-pairs",
        pairs: [
          { left: "学习", right: "Học tập" },
          { left: "工作", right: "Làm việc" },
          { left: "朋友", right: "Bạn bè" },
          { left: "时间", right: "Thời gian" },
        ],
      },
    ],
  },
];

export const decks: FlashcardDeck[] = [
  {
    id: "d-1",
    name: "HSK 2 · Bài 5 — Sở thích",
    description: "5 từ trọng tâm trong bài 5",
    classId: "c-1",
    vocabIds: ["v-3", "v-4", "v-5", "v-6", "v-12"],
    cover: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&q=80",
  },
  {
    id: "d-2",
    name: "HSK 3 · Du lịch & cuộc sống",
    description: "10 từ HSK3 chủ đề du lịch",
    classId: "c-2",
    vocabIds: ["v-7", "v-8", "v-9", "v-10"],
    cover: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=900&q=80",
  },
  {
    id: "d-3",
    name: "Khởi đầu — Chào hỏi cơ bản",
    description: "Từ vựng HSK1 cho người mới",
    classId: "c-3",
    vocabIds: ["v-1", "v-2", "v-11", "v-12"],
    cover: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=900&q=80",
  },
];

export const homeworks: Homework[] = [
  {
    id: "h-1",
    classId: "c-1",
    title: "Ôn tập từ vựng Bài 5",
    description: "Hoàn thành flashcard và làm quiz để chốt từ vựng bài hôm nay.",
    type: "mixed",
    dueDate: "2026-05-22",
    quizId: "q-1",
    vocabIds: ["v-3", "v-4", "v-5", "v-6", "v-12"],
    status: "in-progress",
  },
  {
    id: "h-2",
    classId: "c-1",
    title: "Luyện viết 10 Hán tự",
    description: "Tập viết các Hán tự đã học trong bài 5 — chú ý thứ tự nét.",
    type: "writing",
    dueDate: "2026-05-25",
    status: "assigned",
  },
  {
    id: "h-3",
    classId: "c-2",
    title: "Nghe hội thoại — Đặt phòng khách sạn",
    description: "Nghe 3 đoạn audio và làm bài trắc nghiệm.",
    type: "listening",
    dueDate: "2026-05-21",
    status: "assigned",
  },
  {
    id: "h-4",
    classId: "c-1",
    title: "Tổng ôn cuối tuần",
    type: "quiz",
    dueDate: "2026-05-18",
    quizId: "q-1",
    status: "graded",
    score: 92,
  },
];

// Helpers
export function getUser(id: string) {
  return users.find((u) => u.id === id);
}
export function getVocab(id: string) {
  return vocab.find((v) => v.id === id);
}
export function getVocabByIds(ids: string[]) {
  return ids.map((id) => vocab.find((v) => v.id === id)!).filter(Boolean);
}
export function getClass(id: string) {
  return classes.find((c) => c.id === id);
}
export function getLesson(id: string) {
  return lessons.find((l) => l.id === id);
}
export function getQuiz(id: string) {
  return quizzes.find((q) => q.id === id);
}
export function getDeck(id: string) {
  return decks.find((d) => d.id === id);
}
export function getHomework(id: string) {
  return homeworks.find((h) => h.id === id);
}
