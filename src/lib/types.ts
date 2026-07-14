export type Role = "student" | "teacher" | "admin";

export type Level = "HSK1" | "HSK2" | "HSK3" | "HSK4" | "HSK5" | "HSK6";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  classIds?: string[];
}

export interface ClassRoom {
  id: string;
  name: string;
  level: Level;
  schedule: string;
  teacherId: string;
  studentIds: string[];
  cover: string;
  description?: string;
  progress: number;
}

export interface Vocab {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  example?: { zh: string; pinyin: string; vi: string };
  audio?: string;
  level: Level;
  tags?: string[];
}

export interface Slide {
  id: string;
  title: string;
  thumb: string;
  content?: string;
}

export interface Lesson {
  id: string;
  classId: string;
  unit: number;
  title: string;
  titleZh: string;
  date: string;
  slides: Slide[];
  vocabIds: string[];
  summary: string;
  slideEmbedUrl?: string;
}

export type QuizQuestion =
  | {
      id: string;
      kind: "multiple-choice";
      prompt: string;
      hanzi?: string;
      options: string[];
      answer: number; // index
      explanation?: string;
    }
  | {
      id: string;
      kind: "fill-blank";
      prompt: string;     // câu có ___ chỗ trống
      promptZh?: string;
      answer: string;     // chuỗi đáp án
      hint?: string;
    }
  | {
      id: string;
      kind: "type-pinyin";
      hanzi: string;
      meaning: string;
      answer: string;     // pinyin có dấu, eg: "nǐ hǎo"
    }
  | {
      id: string;
      kind: "listen-choose";
      audio: string;
      options: string[];  // hanzi options
      answer: number;
    }
  | {
      id: string;
      kind: "sentence-order";
      tokens: string[];   // shuffled
      answer: string[];   // correct order
      translation: string;
    }
  | {
      id: string;
      kind: "match-pairs";
      pairs: { left: string; right: string }[];
    };

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  classId: string;
  lessonId?: string;
  questions: QuizQuestion[];
  durationMin: number;
}

export interface Homework {
  id: string;
  classId: string;
  title: string;
  description?: string;
  type: "flashcard" | "quiz" | "writing" | "listening" | "mixed";
  dueDate: string;
  quizId?: string;
  vocabIds?: string[];
  status?: "assigned" | "in-progress" | "submitted" | "graded";
  score?: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  description?: string;
  classId?: string;
  vocabIds: string[];
  cover: string;
}
