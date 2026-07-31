import React, { useState } from "react";

function Upload() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (event) => {
    setSelectedImage(event.target.files[0]);
  };

  // API endpoint - use environment variable if provided
  const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

  const handleUpload = async () => {
    if (!selectedImage) {
      alert("Vui lòng chọn ảnh trước!");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedImage);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);

    } catch (error) {
      console.error("Lỗi tải ảnh:", error);
    }
  };

  const wasteLabels = {
    battery: "Pin",
    biological: "Rác hữu cơ",
    cardboard: "Bìa carton",
    clothes: "Quần áo",
    glass: "Thủy tinh",
    metal: "Kim loại",
    paper: "Giấy",
    plastic: "Nhựa",
    shoes: "Giày dép",
    trash: "Rác thải khác",
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>Phân loại rác</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      <button onClick={handleUpload}>Tải ảnh</button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Kết quả nhận diện:</h3>
          <p><strong>Loại rác:</strong> {wasteLabels[result.class] || result.class}</p>
          <p><strong>Độ tin cậy:</strong> {(result.confidence * 100).toFixed(2)}%</p>
        </div>
      )}
    </div>
  );
}

export default Upload;
