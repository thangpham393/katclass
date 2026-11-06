"use client";

import { useEffect, useMemo, useRef } from "react";
import { CheckCircle2, CloudOff, Loader2, MonitorOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Quyền của slide trong khung: chạy JS, mở popup, form, hộp thoại, toàn màn
 * hình — nhưng KHÔNG có allow-same-origin, nên slide (do bất kỳ giáo viên nào
 * tải lên) không đọc được phiên đăng nhập, cookie hay dữ liệu của app.
 * Đổi lại localStorage trong slide sẽ không dùng được.
 */
const SANDBOX = "allow-scripts allow-popups allow-forms allow-modals allow-pointer-lock allow-presentation";
const ALLOW = "fullscreen; autoplay; clipboard-write; microphone; camera";

export type HtmlSaveState = "saving" | "saved" | "reused" | "error" | "stored";

/** Phím chuyển trang mà bút viết chuyển tiếp vào slide (lúc bút bật, slide không giữ phím). */
export const SLIDE_NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", " ", "Home", "End"];

/**
 * Script gắn vào cuối slide lúc chiếu (file trong kho giữ nguyên). Slide chạy
 * sandbox khác origin nên app không đọc được nó đang ở trang nào — script này
 * tự đoán trang hiện tại rồi báo ra ngoài để bút viết giữ nét riêng cho từng
 * trang, nhận phím chuyển trang app chuyển vào khi đang cầm bút, và chặn
 * Ctrl+P (in trang) để báo app bật bút.
 * Thứ tự đoán: Reveal.js → #hash → phần tử to nhất mang lớp active/current/…
 * → nhóm anh em mà chỉ một phần tử đang hiện.
 */
function slideBridge(deck: string) {
  const d = JSON.stringify(deck).replace(/</g, "\\u003c");
  return `<script>(function(){
var DECK=${d},last=null,t1=0,t2=0;
function big(el){var r=el.getBoundingClientRect();return r.width*r.height>=0.3*innerWidth*innerHeight;}
function shown(el){if(!big(el))return false;var c=getComputedStyle(el);return c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity>0.05;}
function idx(el){return Array.prototype.indexOf.call(el.parentElement.children,el);}
function key(){
try{if(window.Reveal&&Reveal.getIndices){var i=Reveal.getIndices();return 'r'+i.h+'.'+(i.v||0);}}catch(e){}
if(location.hash.length>1)return location.hash;
var best=null,n=2,a=document.querySelectorAll('.active,.current,.present,.is-active,.show,[aria-current]');
for(var k=0;k<a.length;k++){var p=a[k].parentElement;if(p&&p.children.length>n&&big(a[k])){best=a[k];n=p.children.length;}}
if(best)return 'a'+idx(best);
var all=document.body?document.body.getElementsByTagName('*'):[];best=null;n=2;
for(var j=0;j<all.length;j++){var ch=all[j].children;if(ch.length<=n)continue;var on=null,c2=0;
for(var m=0;m<ch.length&&c2<2;m++)if(shown(ch[m])){on=ch[m];c2++;}
if(c2===1){best=on;n=ch.length;}}
return best?'v'+idx(best):'0';}
function check(){var k=key();if(k!==last){last=k;parent.postMessage({__kat:'slide',deck:DECK,key:k},'*');}}
function soon(){clearTimeout(t1);clearTimeout(t2);t1=setTimeout(check,60);t2=setTimeout(check,600);}
['keydown','keyup','click','touchend','wheel','hashchange'].forEach(function(e){addEventListener(e,soon,true);});
addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&(e.key==='p'||e.key==='P')){e.preventDefault();e.stopPropagation();parent.postMessage({__kat:'pen'},'*');}},true);
addEventListener('message',function(e){var m=e.data;if(!m||m.__kat!=='key')return;
var o={key:m.key,code:m.code,bubbles:true,cancelable:true};var el=document.activeElement||document.body;
el.dispatchEvent(new KeyboardEvent('keydown',o));el.dispatchEvent(new KeyboardEvent('keyup',o));soon();});
addEventListener('load',soon);soon();
})();</script>`;
}

/** Mở cửa sổ riêng để kéo sang máy chiếu — slide vẫn chạy trong khung sandbox. */
export function presentHtmlSlide(name: string, html: string) {
  const w = window.open("", "kat-present-html", "width=1280,height=760");
  if (!w) return;
  w.document.title = name;
  w.document.body.style.cssText = "margin:0;background:#000;overflow:hidden";
  w.document.body.innerHTML = "";
  const frame = w.document.createElement("iframe");
  frame.setAttribute("sandbox", SANDBOX);
  frame.setAttribute("allow", ALLOW);
  frame.allowFullscreen = true;
  frame.style.cssText = "border:0;width:100vw;height:100vh;display:block";
  frame.srcdoc = html;
  w.document.body.appendChild(frame);
  frame.addEventListener("load", () => frame.focus());
  w.focus();
}

/**
 * Chiếu slide HTML một file. Bấm vào slide (hoặc vừa mở xong) là khung nhận
 * phím, nên phím ← → / bút trình chiếu điều khiển thẳng slide.
 */
export function HtmlSlideStage({
  name,
  html,
  save,
  saveProgress,
  showChrome,
  autoFocus = true,
  onClose,
}: {
  name: string;
  html: string;
  save: HtmlSaveState;
  saveProgress?: number;
  /** false ở chế độ trình chiếu: ẩn chip tên/đóng. */
  showChrome: boolean;
  /** false ở khung xem trước: không giành con trỏ khỏi trang. */
  autoFocus?: boolean;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(() => html + slideBridge(`${name}:${html.length}`), [html, name]);

  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(() => frameRef.current?.focus(), 300);
    return () => window.clearTimeout(t);
  }, [html, autoFocus]);

  const saveNote = {
    saving: {
      icon: Loader2,
      text: `Đang lưu vào kho${saveProgress != null ? ` ${saveProgress}%` : "…"}`,
      cls: "animate-spin",
    },
    saved: { icon: CheckCircle2, text: "Đã lưu vào kho — GV khác dùng được", cls: "text-classroom-success" },
    reused: { icon: CheckCircle2, text: "Đã có trong kho", cls: "text-classroom-success" },
    stored: { icon: CheckCircle2, text: "Từ kho slide", cls: "text-classroom-success" },
    error: { icon: CloudOff, text: "Chưa lưu được vào kho (vẫn chiếu bình thường)", cls: "text-classroom-warning" },
  }[save];
  const SaveIcon = saveNote.icon;

  return (
    <div className="relative h-full w-full bg-white">
      <iframe
        ref={frameRef}
        key={html.length + name}
        srcDoc={srcDoc}
        sandbox={SANDBOX}
        allow={ALLOW}
        allowFullScreen
        onLoad={() => autoFocus && frameRef.current?.focus()}
        className="h-full w-full border-0"
        title={name}
      />
      {showChrome && (
        <div className="group absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-xl border border-classroom-border bg-classroom-background/90 px-2 py-1 text-xs text-classroom-secondary opacity-60 shadow-soft backdrop-blur transition-opacity hover:opacity-100">
          <span className="max-w-[14rem] truncate font-semibold text-classroom-foreground">{name}</span>
          <span className="flex items-center gap-1" title={saveNote.text}>
            <SaveIcon className={cn("h-3.5 w-3.5", saveNote.cls)} />
            <span className={cn(save === "saving" ? "inline" : "hidden group-hover:inline")}>{saveNote.text}</span>
          </span>
          <button
            onClick={() => presentHtmlSlide(name, html)}
            className="grid h-6 w-6 place-items-center rounded-md bg-classroom-muted hover:bg-classroom-hover"
            title="Mở cửa sổ riêng để kéo sang máy chiếu"
          >
            <MonitorOff className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md bg-classroom-muted hover:bg-classroom-hover"
            title="Đóng slide HTML"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
