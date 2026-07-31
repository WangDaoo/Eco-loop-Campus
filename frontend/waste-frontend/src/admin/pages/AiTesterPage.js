import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { getBinGroup, getWasteLabel } from "../data/wasteConfig";
import { listBins, savePredictionRecord, sourceText } from "../services/supabaseStore";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const formatPercent = value => `${Math.round(Number(value || 0) * 100)}%`;

export default function AiTesterPage() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const [source, setSource] = useState(null);
  const [bins, setBins] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const qrBinId = useMemo(() => new URLSearchParams(location.search).get("binId") || "", [location.search]);
  const selectedBin = useMemo(() => bins.find(bin => bin.id === qrBinId) || null, [bins, qrBinId]);

  useEffect(() => {
    if (!qrBinId) return undefined;
    let active = true;
    listBins().then(response => {
      if (!active) return;
      setBins(response.data);
      setSource(response.source);
    });
    return () => {
      active = false;
    };
  }, [qrBinId]);

  const runPrediction = async (blob, sourceType = "upload") => {
    const formData = new FormData();
    formData.append("file", blob);
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/predict`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const prediction = response.data || {};
      const className = typeof prediction.class === "string" ? prediction.class.trim() : "";
      if (prediction.error) {
        setResult(null);
        setToastTone("danger");
        setToast(prediction.error);
        return;
      }
      if (!className) {
        setResult(null);
        setToastTone("danger");
        setToast("Backend trả kết quả không hợp lệ");
        return;
      }
      const confidence = Number(prediction.confidence);
      if (!Number.isFinite(confidence)) {
        setResult(null);
        setToastTone("danger");
        setToast("Backend trả kết quả không hợp lệ");
        return;
      }
      const record = await savePredictionRecord({
        class: className,
        confidence,
        source: sourceType,
        timestamp: new Date().toISOString(),
        status: "pending",
        binId: qrBinId || undefined,
        imageName: blob.name || "capture.jpg",
      });
      setResult(record.data);
      setSource(record.source);
      setToastTone("success");
      setToast(`Đã lưu lượt kiểm thử AI (${sourceText(record.source)})`);
    } catch {
      setResult(null);
      setToastTone("danger");
      setToast("Không gọi được backend /predict");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = event => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setToastTone("danger");
      setToast("Trình duyệt không hỗ trợ camera");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setToast("");
    } catch {
      streamRef.current = null;
      setCameraOn(false);
      setToastTone("danger");
      setToast("Không mở được camera. Kiểm tra quyền camera hoặc thiết bị.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const captureCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) runPrediction(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }), "camera");
    }, "image/jpeg");
  };

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Backend hiện tại: {API_URL}</span>
          <h1>Kiểm thử AI</h1>
        </div>
        {source && <span className={`eg-source-pill ${source === "local" ? "is-local" : ""}`}>{sourceText(source)}</span>}
      </div>

      {qrBinId && (
        <section className="eg-card eg-ai-bin-card" aria-label="Trạm QR đang quét">
          <div>
            <span className="eg-section-kicker">Đang quét cho trạm</span>
            <h2>{selectedBin?.name || qrBinId}</h2>
            <p>{selectedBin?.location || "Chưa tìm thấy thông tin trạm trong dữ liệu thùng."}</p>
          </div>
          {selectedBin && <StatusBadge group={selectedBin.binGroup}>{selectedBin.binGroup}</StatusBadge>}
        </section>
      )}

      <div className="eg-two-col">
        <section className="eg-card">
          <div className="eg-card-head">
            <div>
              <h2>Tải ảnh kiểm thử</h2>
              <p>Gửi ảnh vào model hiện tại và lưu vào hàng chờ duyệt.</p>
            </div>
          </div>
          <label className="eg-file-input">
            Chọn ảnh kiểm thử
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {preview && <img className="eg-preview-image" src={preview} alt="Ảnh kiểm thử" />}
          <button type="button" className="eg-primary-btn" onClick={() => file && runPrediction(file, "upload")} disabled={!file || loading}>
            {loading ? "Đang nhận diện" : "Nhận diện thử"}
          </button>
        </section>

        <section className="eg-card">
          <div className="eg-card-head">
            <div>
              <h2>Camera kiểm thử</h2>
              <p>Dùng webcam để chụp nhanh mẫu rác trong khuôn viên.</p>
            </div>
          </div>
          <video ref={videoRef} className="eg-camera" autoPlay muted playsInline />
          <canvas ref={canvasRef} hidden />
          <div className="eg-button-row">
            <button type="button" className="eg-secondary-btn" onClick={cameraOn ? stopCamera : startCamera}>{cameraOn ? "Tắt camera" : "Mở camera"}</button>
            <button type="button" className="eg-primary-btn" onClick={captureCamera} disabled={!cameraOn || loading}>Chụp kiểm thử</button>
          </div>
        </section>
      </div>

      {result && (
        <section className="eg-card eg-result-card">
          <div>
            <span>Kết quả</span>
            <h2>{getWasteLabel(result.class)}</h2>
          </div>
          <StatusBadge group={getBinGroup(result.class)}>{getBinGroup(result.class)}</StatusBadge>
          <strong>{formatPercent(result.confidence)}</strong>
          <StatusBadge status={result.status} />
        </section>
      )}

      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
