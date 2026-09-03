"use client";
/** TẠM THỜI — đo tràn ngang hàng loạt: /dev-probe?w=390&code=..&pw=..&paths=/admin,/admin/classes */
import { useEffect, useRef, useState } from "react";
import { signInWithEmail } from "@/lib/auth";
import { codeEmail, normalizeLoginCode } from "@/lib/student-login";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DevProbe() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [w, setW] = useState(390);
  const [out, setOut] = useState<string[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const width = Number(q.get("w") || 390);
    setW(width);
    const paths = (q.get("paths") || "/").split(",").filter(Boolean);
    const code = q.get("code");
    const pw = q.get("pw");
    let stop = false;

    (async () => {
      if (code && pw) {
        try {
          const email = codeEmail(normalizeLoginCode(code));
          const prof = await signInWithEmail(email, pw);
          void fetch("/api/dev-probe", { method: "POST", body: "LOGIN OK " + email + " role=" + prof.role });
        } catch (e) {
          void fetch("/api/dev-probe", { method: "POST", body: "LOGIN FAIL " + String(e) });
        }
        await sleep(1500);
      }
      void fetch("/api/dev-probe", { method: "POST", body: "=== BẮT ĐẦU QUÉT (" + paths.length + " trang, w=" + width + ") ===" });
      const lines: string[] = [];
      for (const path of paths) {
        if (stop) return;
        ref.current!.src = path;
        await sleep(4500);
        const doc = ref.current?.contentDocument;
        if (!doc) { lines.push(`${path} :: NO-DOC`); continue; }
        const vw = doc.documentElement.clientWidth;
        const bad: string[] = [];
        doc.querySelectorAll<HTMLElement>("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.right > vw + 1 || r.left < -1) {
            let p: HTMLElement | null = el.parentElement;
            let clipped = false;
            while (p) {
              const cs = doc.defaultView!.getComputedStyle(p);
              if (/hidden|clip|auto|scroll/.test(cs.overflowX)) { clipped = true; break; }
              p = p.parentElement;
            }
            if (clipped) return;
            bad.push(`${el.tagName.toLowerCase()}[${(el.className || "").toString().slice(0, 80)}]L${Math.round(r.left)}R${Math.round(r.right)}`);
          }
        });
        const txt = (doc.body.innerText || "").replace(/\s+/g, " ").slice(0, 40);
        lines.push(`${path} SW=${doc.documentElement.scrollWidth} N=${bad.length} <${txt}> ${bad.slice(0, 6).join(" ### ")}`);
        setOut([...lines]);
        void fetch("/api/dev-probe", { method: "POST", body: lines[lines.length - 1] });
        document.title = `PROBE-DONE=${lines.length}/${paths.length}`;
      }
      document.title = `PROBE-ALL-DONE`;
      void fetch("/api/dev-probe", { method: "POST", body: "=== ALL DONE ===" });
    })();
    return () => { stop = true; };
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div>
      <pre id="probe-out" style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{out.join("\n")}</pre>
      <iframe ref={ref} style={{ width: w, height: 900, border: "1px solid #ccc" }} />
    </div>
  );
}
