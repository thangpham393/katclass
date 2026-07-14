"use client";

import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { User } from "./types";

/**
 * Lấy hồ sơ người dùng từ Firestore (users/{uid}).
 * Nếu chưa có (vd đăng nhập Google lần đầu) thì tạo mới với role mặc định "student".
 */
export async function ensureUserProfile(fbUser: FirebaseUser): Promise<User> {
  const ref = doc(db, "users", fbUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    return {
      id: fbUser.uid,
      name: data.name ?? fbUser.displayName ?? fbUser.email ?? "Người dùng",
      email: data.email ?? fbUser.email ?? "",
      role: data.role ?? "student",
      avatar: data.avatar ?? fbUser.photoURL ?? undefined,
      classIds: data.classIds ?? [],
    };
  }

  const profile: User = {
    id: fbUser.uid,
    name: fbUser.displayName ?? fbUser.email?.split("@")[0] ?? "Người dùng",
    email: fbUser.email ?? "",
    role: "student",
    avatar: fbUser.photoURL ?? undefined,
    classIds: [],
  };
  await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  return profile;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return ensureUserProfile(cred.user);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return ensureUserProfile(cred.user);
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

/** Trang chủ tương ứng với từng vai trò. */
export function homeForRole(role: User["role"]): string {
  return role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
}

/** Diễn giải lỗi Firebase Auth sang tiếng Việt dễ hiểu. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email hoặc mật khẩu không đúng.";
    case "auth/invalid-email":
      return "Email không hợp lệ.";
    case "auth/too-many-requests":
      return "Bạn thử sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Bạn đã đóng cửa sổ đăng nhập Google.";
    case "auth/unauthorized-domain":
      return "Tên miền này chưa được cấp phép trong Firebase (Authorized domains).";
    case "auth/network-request-failed":
      return "Lỗi mạng. Kiểm tra kết nối rồi thử lại.";
    default:
      return "Đăng nhập thất bại. Vui lòng thử lại.";
  }
}
