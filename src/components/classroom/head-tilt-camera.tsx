"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eyeRoll, TiltGesture, type TiltSide } from "@/lib/head-tilt";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Chưa được phép dùng camera. Hãy cho phép camera trong trình duyệt rồi thử lại.";
    if (error.name === "NotFoundError") return "Không tìm thấy camera. Bạn vẫn có thể bấm đáp án.";
    if (error.name === "NotReadableError") return "Không mở được camera. Hãy kiểm tra ứng dụng khác đang dùng camera rồi thử lại.";
  }
  return "Không tải được nhận diện khuôn mặt hoặc camera. Kiểm tra mạng rồi thử lại, hoặc bấm đáp án để chơi.";
}

export function HeadTiltCamera({ active, answered, round, onChoose }: {
  active: boolean;
  answered: boolean;
  round: number;
  onChoose: (side: TiltSide) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gesture = useRef(new TiltGesture());
  const current = useRef({ answered, onChoose });
  current.current = { answered, onChoose };
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("Nhìn thẳng vào camera để bắt đầu.");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    gesture.current.reset();
    setProgress(0);
  }, [round]);

  // Classroom overlays stay mounted when hidden: explicitly stop the stream.
  useEffect(() => {
    if (!active) setEnabled(false);
  }, [active]);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) setEnabled(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  useEffect(() => {
    if (!enabled || !active) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let detector: FaceLandmarker | null = null;
    let frame = 0;
    let lastTime = -1;
    let lastRun = 0;
    const video = videoRef.current;
    gesture.current.reset();
    setLoading(true);
    setError("");
    setProgress(0);

    function dispose() {
      cancelAnimationFrame(frame);
      if (video && video.srcObject === stream) video.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      detector?.close();
      detector = null;
    }

    function fail(error: unknown) {
      dispose();
      if (cancelled) return;
      setError(cameraError(error));
      setLoading(false);
      setEnabled(false);
    }

    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          setError("Camera cần kết nối HTTPS hoặc localhost. Bạn vẫn có thể bấm đáp án để chơi.");
          setLoading(false);
          setEnabled(false);
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { dispose(); return; }
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener("ended", () => {
            if (!cancelled) fail(new DOMException("Camera stopped", "NotReadableError"));
          }, { once: true });
        });
        const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
        if (cancelled) { dispose(); return; }
        const files = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) { dispose(); return; }
        detector = await FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 2,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (cancelled || !video) { dispose(); return; }
        video.srcObject = stream;
        await video.play();
        if (cancelled) { dispose(); return; }
        setLoading(false);

        const detect = (now: number) => {
          if (cancelled || !detector) return;
          try {
            // Limit synchronous inference to 12 fps and only process new frames.
            if (video.readyState >= 2 && now - lastRun >= 80 && video.currentTime !== lastTime) {
              lastRun = now;
              lastTime = video.currentTime;
              const faces = detector.detectForVideo(video, now).faceLandmarks;
              const face = faces.length === 1 ? faces[0] : null;
              const angle = face ? eyeRoll(face[33], face[263], video.videoWidth, video.videoHeight) : null;
              const result = gesture.current.update(angle, now, current.current.answered);
              setProgress(result.progress);
              setHint(current.current.answered ? "Đã chọn! Bấm Câu tiếp theo để chơi tiếp."
                : faces.length > 1 ? "Chỉ một người đứng trước camera nhé."
                : !face ? "Chưa thấy khuôn mặt. Đứng gần hơn và kiểm tra ánh sáng."
                : result.side ? `Giữ nghiêng ${result.side === "left" ? "trái" : "phải"}… ${Math.round(result.progress * 100)}%`
                : result.ready ? "Sẵn sàng! Nghiêng trái hoặc phải để chọn."
                : "Đưa đầu về giữa, nhìn thẳng một chút để sẵn sàng.");
              if (result.choose) current.current.onChoose(result.choose);
            }
            frame = requestAnimationFrame(detect);
          } catch (error) { fail(error); }
        };
        frame = requestAnimationFrame(detect);
      } catch (error) { fail(error); }
    }
    void start();
    return () => { cancelled = true; dispose(); };
  }, [enabled, active]);

  return (
    <div className="w-full max-w-3xl rounded-xl border border-classroom-border bg-classroom-muted p-3">
      <div className="flex flex-wrap items-center gap-3">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Camera người chơi, hình ảnh phản chiếu như gương"
          className={`h-24 w-32 shrink-0 -scale-x-100 rounded-lg bg-black object-cover ${enabled && active ? "" : "hidden"}`} />
        <div className="min-w-0 flex-1 text-sm text-classroom-secondary">
          <p>Nghiêng về phía đáp án trên màn hình, giữ khoảng 1 giây để chọn.</p>
          <p className="mt-1 text-xs text-classroom-muted-foreground">Camera xử lý trên thiết bị, không lưu hoặc gửi hình ảnh. Có thể bấm hai đáp án để chơi.</p>
          {enabled && <p role="status" className="mt-2 font-semibold">{loading ? "Đang tải nhận diện và mở camera…" : hint}</p>}
          {error && <p role="alert" className="mt-2 text-classroom-warning">{error}</p>}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEnabled((value) => !value)} disabled={!active}>
          {enabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {enabled ? "Tắt camera" : "Bật camera"}
        </Button>
      </div>
      {enabled && <div role="progressbar" aria-label="Giữ nghiêng để chọn" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mt-2 h-2 overflow-hidden rounded-full bg-classroom-border">
        <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
      </div>}
    </div>
  );
}
