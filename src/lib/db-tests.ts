"use client";
import { getSupabase } from "./supabase";
export const TEST_CATEGORY_LABELS = { lesson: "Kết thúc bài", midterm: "Giữa kỳ", final: "Cuối kỳ" };
export type TestCategory = keyof typeof TEST_CATEGORY_LABELS;
export interface TestTemplate { id: string; title: string; category: TestCategory; time_limit_minutes: number; question_ids: string[]; created_by: string; }
export async function fetchTestTemplates(): Promise<TestTemplate[]> {
  const { data, error } = await getSupabase().from("test_templates").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function saveTestTemplate(input: Omit<TestTemplate, "id"> & { id?: string }) {
  const { error } = await getSupabase().rpc("save_test_template", { template_id: input.id ?? null, template_title: input.title, template_category: input.category, minutes: input.time_limit_minutes, ids: input.question_ids });
  if (error) throw error;
}
export async function deleteTestTemplate(id: string) {
  const { error } = await getSupabase().from("test_templates").delete().eq("id", id);
  if (error) throw error;
}
