"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, ScanFace, Crosshair } from "lucide-react";
import { eyeRoll, TiltGesture, TILT_SELECT_ANGLE, type TiltSide } from "@/lib/head-tilt";

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

export type TiltMotion = { side: TiltSide | null; progress: number; angle: number };

export function HeadTiltCamera({ active, answered, paused = false, round, onChoose, onMotion }: {
  active: boolean;
  answered: boolean;
  round: number;
  onChoose: (side: TiltSide) => void;
  paused?: boolean;
  onMotion?: (motion: TiltMotion) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gesture = useRef(new TiltGesture());
  const current = useRef({ answered, paused, onChoose, onMotion });
  current.current = { answered, paused, onChoose, onMotion };
  const offset = useRef(0);
  const rawAngle = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("Nhìn thẳng vào camera để bắt đầu.");
  const [progress, setProgress] = useState(0);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    gesture.current.reset();
    setProgress(0);
    current.current.onMotion?.({ side: null, progress: 0, angle: 0 });
  }, [round, paused]);

  // Classroom overlays stay mounted when hidden: explicitly stop the stream.
  useEffect(() => {
    if (!active) setEnabled(false);
  }, [active]);

  useEffect(() => {
    if (enabled && active) return;
    setLoading(false); setAngle(0); setProgress(0);
    gesture.current.reset();
    current.current.onMotion?.({ side: null, progress: 0, angle: 0 });
  }, [enabled, active]);

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
    offset.current = 0;
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
            // Limit synchronous inference to 20 fps and only process new frames.
            if (video.readyState >= 2 && now - lastRun >= 50 && video.currentTime !== lastTime) {
              lastRun = now;
              lastTime = video.currentTime;
              const faces = detector.detectForVideo(video, now).faceLandmarks;
              const face = faces.length === 1 ? faces[0] : null;
              rawAngle.current = face ? eyeRoll(face[33], face[263], video.videoWidth, video.videoHeight) : null;
              const angle = rawAngle.current === null ? null : rawAngle.current - offset.current;
              const result = gesture.current.update(angle, now, current.current.answered || current.current.paused);
              setAngle(angle ?? 0);
              current.current.onMotion?.({ side: result.side, progress: result.progress, angle: angle ?? 0 });
              setProgress(result.progress);
              setHint(current.current.paused ? "Đang tạm dừng"
                : current.current.answered ? "Đã chọn! Đưa đầu về giữa nhé."
                : faces.length > 1 ? "Chỉ một người đứng trước camera nhé."
                : !face ? "Chưa thấy khuôn mặt. Đứng gần hơn và kiểm tra ánh sáng."
                : result.side ? `Giữ nghiêng ${result.side === "left" ? "trái" : "phải"}… ${Math.round(result.progress * 100)}%`
                : result.ready ? "Sẵn sàng! Nghiêng trái hoặc phải để chọn."
                : "Đưa đầu về giữa để sẵn sàng.");
              if (result.choose) current.current.onChoose(result.choose);
            }
            frame = requestAnimationFrame(detect);
          } catch (error) { fail(error); }
        };
        frame = requestAnimationFrame(detect);
      } catch (error) { fail(error); }
    }
    void start();
    return () => {
      cancelled = true; dispose();
      rawAngle.current = null;
      current.current.onMotion?.({ side: null, progress: 0, angle: 0 });
    };
  }, [enabled, active]);

  return (
    <div className="tilt-camera">
      <div className={`tilt-camera-ring ${progress > 0 ? "tilt-camera-tracking" : ""}`} style={{ "--hold": `${progress * 360}deg` } as React.CSSProperties}>
        <div className="tilt-camera-inner">
        <video ref={videoRef} muted playsInline autoPlay aria-label="Camera người chơi, hình ảnh phản chiếu như gương"
          className={`tilt-camera-video ${enabled && active ? "" : "hidden"}`} />
        {(!enabled || loading) && <div className="tilt-camera-placeholder"><ScanFace size={46} strokeWidth={1} /><span>{loading ? "Đang mở camera…" : "Bạn ở đây"}</span>{!enabled && <button onClick={() => setEnabled(true)} disabled={!active}><Camera size={14} /> Bật camera</button>}</div>}
        {enabled && !loading && <span className="tilt-angle">{Math.round(angle)}° / {TILT_SELECT_ANGLE}°</span>}
        </div>
      </div>
      <p role="status" className="tilt-camera-hint">{enabled ? loading ? "Đang tải nhận diện…" : hint : "Bật camera hoặc bấm đáp án"}</p>
      <div className="tilt-angle-meter"><span>←</span><div><i /><b style={{ left: `${50 - Math.max(-30, Math.min(30, angle)) / 30 * 50}%` }} /></div><span>→</span></div>
      <div role="progressbar" aria-label="Giữ nghiêng để chọn" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="tilt-hold-label">GIỮ ĐẦU {Math.round(progress * 100)}%</div>
      {enabled && <div className="tilt-camera-tools"><button onClick={() => {
        if (rawAngle.current !== null) offset.current = rawAngle.current;
        gesture.current.reset(); setProgress(0); setAngle(0);
        current.current.onMotion?.({ side: null, progress: 0, angle: 0 });
      }} disabled={loading || paused || answered || rawAngle.current === null} title="Nhìn thẳng rồi bấm để lấy vị trí đầu ở giữa"><Crosshair size={13} /> Hiệu chỉnh</button><button onClick={() => setEnabled(false)}><CameraOff size={13} /> Tắt camera</button></div>}
      {error && <p role="alert" className="tilt-camera-error">{error}</p>}
      <span className="tilt-camera-privacy">Camera riêng tư · xử lý trên thiết bị</span>
    </div>
  );
}
