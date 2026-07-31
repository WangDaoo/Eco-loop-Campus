import { ArrowsOutCardinal, CheckCircle, Crosshair, Minus, Plus, SlidersHorizontal, Trash, XCircle } from "@phosphor-icons/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import proj4 from "proj4";
import { useEffect, useMemo, useRef, useState } from "react";
import { isOpenFeedback } from "../data/feedbackConfig";
import { BIN_GROUPS, STATUS_LABELS, getGroupColor } from "../data/wasteConfig";
import StatusBadge from "./StatusBadge";

const CAMPUS_FRAME = {
  minX: 609973.5284937217,
  minY: 2315979.1727699493,
  maxX: 610853.1673639194,
  maxY: 2316582.0362756485,
};

proj4.defs("EPSG:32648", "+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs");

const geoJsonLayers = [
  { id: "buildings", label: "Tòa nhà", countLabel: "233 tòa nhà", fileName: "buildings", url: "/assets/geojson/buildings.geojson", color: "#64748b", fillColor: "#cbd5e1", weight: 1.4, fillOpacity: 0.76 },
  { id: "roads", label: "Đường sá", countLabel: "64 tuyến đường", fileName: "roads", url: "/assets/geojson/roads.geojson", color: "#3b82f6", weight: 3, opacity: 0.9 },
  { id: "contours", label: "Địa hình", countLabel: "15 đường đồng mức", fileName: "contours", url: "/assets/geojson/contours.geojson", color: "#94a3b8", weight: 1, dashArray: "4, 4" },
  { id: "frame", label: "Ranh giới", countLabel: "1 khung campus", fileName: "frame", url: "/assets/geojson/frame.geojson", color: "#0f172a", weight: 2.5, fillOpacity: 0 },
  { id: "green", label: "Mảng xanh", countLabel: "0 mảng xanh", fileName: "green", url: "/assets/geojson/green_areas.geojson", color: "#22c55e", fillColor: "#86efac", weight: 1, fillOpacity: 0.45 },
  { id: "trees", label: "Cây xanh", countLabel: "0 cây", fileName: "trees", url: "/assets/geojson/trees.geojson", color: "#16a34a", fillColor: "#bbf7d0", weight: 1, fillOpacity: 0.55 },
  { id: "railways", label: "Đường sắt", countLabel: "0 tuyến", fileName: "railways", url: "/assets/geojson/railways.geojson", color: "#a855f7", weight: 2, dashArray: "8, 5" },
];

function utmToLatLng(coords) {
  const converted = proj4("EPSG:32648", "EPSG:4326", [coords[0], coords[1]]);
  return L.latLng(converted[1], converted[0]);
}

function stationToLatLng(station) {
  const x = CAMPUS_FRAME.minX + ((CAMPUS_FRAME.maxX - CAMPUS_FRAME.minX) * station.x) / 100;
  const y = CAMPUS_FRAME.maxY - ((CAMPUS_FRAME.maxY - CAMPUS_FRAME.minY) * station.y) / 100;
  return utmToLatLng([x, y]);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value)));
}

function roundedPercent(value) {
  return Math.round(clampPercent(value) * 10) / 10;
}

function readPercent(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundedPercent(parsed) : fallback;
}

function latLngToStationPosition(latLng) {
  const converted = proj4("EPSG:4326", "EPSG:32648", [latLng.lng, latLng.lat]);
  const x = ((converted[0] - CAMPUS_FRAME.minX) / (CAMPUS_FRAME.maxX - CAMPUS_FRAME.minX)) * 100;
  const y = ((CAMPUS_FRAME.maxY - converted[1]) / (CAMPUS_FRAME.maxY - CAMPUS_FRAME.minY)) * 100;
  return { x: roundedPercent(x), y: roundedPercent(y) };
}

function positionsDiffer(a, b) {
  if (!a || !b) return false;
  return roundedPercent(a.x) !== roundedPercent(b.x) || roundedPercent(a.y) !== roundedPercent(b.y);
}

function movePosition(position, dx, dy) {
  return {
    x: roundedPercent((position?.x || 0) + dx),
    y: roundedPercent((position?.y || 0) + dy),
  };
}

const fixedPositions = {
  A1: { x: 30, y: 78, label: "Nhà A1", zone: "Khu mô phỏng - cổng chính" },
  Canteen: { x: 54, y: 72, label: "Căn tin", zone: "Khu mô phỏng - dịch vụ" },
  Library: { x: 39, y: 86, label: "Thư viện", zone: "Khu mô phỏng - học tập" },
};

const fallbackPositions = [
  { x: 43, y: 73, label: "Sân trung tâm", zone: "Khu mô phỏng - trung tâm" },
  { x: 50, y: 82, label: "Nhà học", zone: "Khu mô phỏng - lớp học" },
  { x: 65, y: 64, label: "Khu thể thao", zone: "Khu mô phỏng - hoạt động" },
  { x: 33, y: 92, label: "Văn phòng", zone: "Khu mô phỏng - hành chính" },
];

const gisLegend = [
  { id: "buildings", label: "Tòa nhà", className: "is-building" },
  { id: "roads", label: "Đường sá", className: "is-road" },
  { id: "green", label: "Mảng xanh", className: "is-green" },
  { id: "contours", label: "Địa hình", className: "is-contour" },
  { id: "frame", label: "Ranh giới campus", className: "is-frame" },
];

function getStationPosition(bin, index) {
  const base = fixedPositions[bin.building] || fallbackPositions[index % fallbackPositions.length];
  return {
    ...base,
    x: readPercent(bin.mapX ?? bin.map_x, base.x),
    y: readPercent(bin.mapY ?? bin.map_y, base.y),
  };
}

function capacityTone(capacity) {
  if (capacity >= 80) return "cao";
  if (capacity >= 55) return "trung bình";
  return "ổn định";
}

function countOpenFeedbackByBin(feedback) {
  return feedback.filter(isOpenFeedback).reduce((acc, item) => {
    if (!item.binId) return acc;
    acc[item.binId] = (acc[item.binId] || 0) + 1;
    return acc;
  }, {});
}

function appendTooltipLine(container, tagName, text) {
  const element = document.createElement(tagName);
  element.textContent = text;
  container.appendChild(element);
}

function createStationTooltip(station, statusText) {
  const tooltip = document.createElement("div");
  tooltip.className = "eg-station-tooltip-content";
  appendTooltipLine(tooltip, "strong", station.name);
  appendTooltipLine(tooltip, "span", station.zone);
  appendTooltipLine(tooltip, "span", station.location);
  appendTooltipLine(tooltip, "span", `${station.binGroup} - ${statusText}`);
  appendTooltipLine(tooltip, "span", `Sức chứa ${station.capacity}% - ${capacityTone(station.capacity)}`);
  if (station.openFeedbackCount) appendTooltipLine(tooltip, "span", `${station.openFeedbackCount} phản hồi mở`);
  appendTooltipLine(tooltip, "span", `QR: ${station.qrCode}`);
  return tooltip;
}

function addStationMarkers(layerGroup, stations, options = {}) {
  const { editingStationId, onDraftPosition, onSelect, selectedStationId } = options;
  stations.forEach(station => {
    const statusText = STATUS_LABELS[station.status] || station.status;
    const marker = L.marker(stationToLatLng(station), {
      alt: `Điểm thùng ${station.name}, ${station.location}, ${station.binGroup}, ${statusText}${station.openFeedbackCount ? `, ${station.openFeedbackCount} phản hồi mở` : ""}`,
      draggable: editingStationId === station.id,
      keyboard: true,
      title: `${station.name} - ${station.binGroup} - ${statusText}${station.openFeedbackCount ? ` - ${station.openFeedbackCount} phản hồi mở` : ""}`,
      icon: L.divIcon({
        className: "eg-leaflet-station-marker",
        html: `<span class="eg-leaflet-station-pin${station.openFeedbackCount ? " has-feedback" : ""}${selectedStationId === station.id ? " is-selected" : ""}${editingStationId === station.id ? " is-editing" : ""}" style="--group-color: ${getGroupColor(station.binGroup)}"></span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      }),
    }).bindTooltip(createStationTooltip(station, statusText), {
      className: "eg-leaflet-station-tooltip",
      direction: "top",
      offset: [0, -18],
      opacity: 1,
      sticky: true,
    });

    marker.on("click", () => onSelect?.(station.id));
    marker.on("dragstart", () => onSelect?.(station.id));
    marker.on("dragend", event => onDraftPosition?.(station.id, latLngToStationPosition(event.target.getLatLng())));
    marker.addTo(layerGroup);
  });
}

export default function CampusMap({ bins = [], feedback = [], onUpdateBinPosition }) {
  const [enabledLayers, setEnabledLayers] = useState(() => new Set(["buildings", "roads", "contours", "frame"]));
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [editingPosition, setEditingPosition] = useState(false);
  const [draftPosition, setDraftPosition] = useState(null);
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionError, setPositionError] = useState("");
  const mapElementRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletLayerGroupRef = useRef(null);
  const latestBoundsRef = useRef(null);
  const openFeedbackByBin = useMemo(() => countOpenFeedbackByBin(feedback), [feedback]);
  const stations = useMemo(() => bins.map((bin, index) => ({
    ...bin,
    capacity: readPercent(bin.capacity, 0),
    ...getStationPosition(bin, index),
    openFeedbackCount: openFeedbackByBin[bin.id] || 0,
  })), [bins, openFeedbackByBin]);
  const effectiveSelectedStationId = selectedStationId || stations.find(station => station.openFeedbackCount > 0)?.id || stations[0]?.id || null;
  const selectedStation = useMemo(() => stations.find(station => station.id === effectiveSelectedStationId) || null, [effectiveSelectedStationId, stations]);
  const visibleStations = useMemo(() => stations.map(station => (
    station.id === effectiveSelectedStationId && draftPosition ? { ...station, ...draftPosition } : station
  )), [draftPosition, effectiveSelectedStationId, stations]);
  const selectedFeedback = useMemo(() => feedback.filter(item => item.binId === selectedStation?.id), [feedback, selectedStation]);
  const openSelectedFeedbackCount = selectedFeedback.filter(isOpenFeedback).length;
  const hasPositionChanges = positionsDiffer(selectedStation, draftPosition);
  const activeCount = stations.filter(station => station.status === "active").length;
  const maintenanceCount = stations.filter(station => station.status === "maintenance").length;
  const openFeedbackCount = stations.reduce((sum, station) => sum + station.openFeedbackCount, 0);

  useEffect(() => {
    if (!stations.length) {
      setSelectedStationId(null);
      setDraftPosition(null);
      return;
    }
    if (!selectedStationId || !stations.some(station => station.id === selectedStationId)) {
      const firstStationWithFeedback = stations.find(station => station.openFeedbackCount > 0);
      const nextStation = firstStationWithFeedback || stations[0];
      setSelectedStationId(nextStation.id);
      setDraftPosition({ x: nextStation.x, y: nextStation.y });
      setEditingPosition(false);
      setPositionError("");
    }
  }, [selectedStationId, stations]);

  useEffect(() => {
    if (!selectedStation || editingPosition) return;
    setDraftPosition({ x: selectedStation.x, y: selectedStation.y });
  }, [editingPosition, selectedStation]);

  useEffect(() => {
    if (!mapElementRef.current || leafletMapRef.current) return undefined;

    const map = L.map(mapElementRef.current, {
      center: [20.942, 106.059],
      zoom: 16,
      minZoom: 15,
      maxZoom: 22,
      zoomControl: false,
      zoomAnimation: true,
      fadeAnimation: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 22,
      attribution: "CartoDB, OpenStreetMap, TopoExport",
    }).addTo(map);

    const layerGroup = L.featureGroup().addTo(map);
    leafletMapRef.current = map;
    leafletLayerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      leafletMapRef.current = null;
      leafletLayerGroupRef.current = null;
      latestBoundsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletMapRef.current;
    const layerGroup = leafletLayerGroupRef.current;
    if (!map || !layerGroup) return undefined;

    let cancelled = false;
    layerGroup.clearLayers();

    const fitVisibleLayers = () => {
      const bounds = layerGroup.getBounds();
      if (bounds.isValid()) {
        latestBoundsRef.current = bounds;
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18, animate: true });
      }
    };

    const renderStationFallback = () => {
      addStationMarkers(layerGroup, visibleStations, {
        editingStationId: editingPosition ? effectiveSelectedStationId : null,
        onDraftPosition: (stationId, position) => {
          setSelectedStationId(stationId);
          setDraftPosition(position);
        },
        onSelect: setSelectedStationId,
        selectedStationId: effectiveSelectedStationId,
      });
      fitVisibleLayers();
    };

    const visibleLayerConfigs = geoJsonLayers.filter(layer => enabledLayers.has(layer.id));
    if (typeof window === "undefined" || typeof window.fetch !== "function") {
      renderStationFallback();
      return undefined;
    }

    Promise.all(visibleLayerConfigs.map(layer => window.fetch(layer.url).then(response => {
      if (!response.ok) throw new Error(`Không tải được ${layer.url}`);
      return response.json().then(data => ({ layer, data }));
    }))).then(results => {
      if (cancelled) return;

      results.forEach(({ layer, data }) => {
        L.geoJSON(data, {
          coordsToLatLng: utmToLatLng,
          style: () => ({
            color: layer.color,
            weight: layer.weight,
            opacity: layer.opacity ?? 1,
            fillColor: layer.fillColor,
            fillOpacity: layer.fillOpacity ?? 0,
            dashArray: layer.dashArray,
          }),
          pointToLayer: (feature, latLng) => L.circleMarker(latLng, {
            radius: 4,
            color: layer.color,
            fillColor: layer.fillColor || layer.color,
            fillOpacity: 0.75,
            weight: 1,
          }),
          onEachFeature: (feature, featureLayer) => {
            const properties = feature.properties || {};
            if (properties.height) featureLayer.bindTooltip(`Tòa nhà cao ${properties.height}m`);
            if (properties.elevation) featureLayer.bindTooltip(`Cao độ ${properties.elevation}m`);
          },
        }).addTo(layerGroup);
      });

      addStationMarkers(layerGroup, visibleStations, {
        editingStationId: editingPosition ? effectiveSelectedStationId : null,
        onDraftPosition: (stationId, position) => {
          setSelectedStationId(stationId);
          setDraftPosition(position);
        },
        onSelect: setSelectedStationId,
        selectedStationId: effectiveSelectedStationId,
      });
      fitVisibleLayers();
    }).catch(error => {
      if (cancelled) return;
      renderStationFallback();
    });

    return () => {
      cancelled = true;
    };
  }, [editingPosition, effectiveSelectedStationId, enabledLayers, visibleStations]);

  const zoomIn = () => {
    leafletMapRef.current?.zoomIn(1, { animate: true });
  };

  const zoomOut = () => {
    leafletMapRef.current?.zoomOut(1, { animate: true });
  };

  const resetView = () => {
    if (latestBoundsRef.current?.isValid()) {
      leafletMapRef.current?.fitBounds(latestBoundsRef.current, { padding: [28, 28], maxZoom: 18, animate: true });
    }
  };

  const toggleLayer = layerId => {
    setEnabledLayers(current => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  const selectStation = station => {
    setSelectedStationId(station.id);
    setDraftPosition({ x: station.x, y: station.y });
    setEditingPosition(false);
    setPositionError("");
  };

  const startPositionEdit = () => {
    if (!selectedStation) return;
    setDraftPosition({ x: selectedStation.x, y: selectedStation.y });
    setEditingPosition(true);
    setPositionError("");
  };

  const moveDraftPosition = (dx, dy) => {
    if (!selectedStation) return;
    setEditingPosition(true);
    setDraftPosition(current => movePosition(current || selectedStation, dx, dy));
  };

  const cancelPositionEdit = () => {
    if (!selectedStation) return;
    setDraftPosition({ x: selectedStation.x, y: selectedStation.y });
    setEditingPosition(false);
    setPositionError("");
  };

  const confirmPositionEdit = async () => {
    if (!selectedStation || !draftPosition || !onUpdateBinPosition) return;
    setSavingPosition(true);
    setPositionError("");
    try {
      const updatedStation = await onUpdateBinPosition(selectedStation, { mapX: draftPosition.x, mapY: draftPosition.y });
      setDraftPosition({
        x: readPercent(updatedStation?.mapX ?? draftPosition.x, draftPosition.x),
        y: readPercent(updatedStation?.mapY ?? draftPosition.y, draftPosition.y),
      });
      setEditingPosition(false);
    } catch (error) {
      setPositionError("Không lưu được vị trí. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setSavingPosition(false);
    }
  };

  return (
    <section className="eg-card eg-campus-card eg-gis-panel" aria-labelledby="campus-map-title">
      <div className="eg-card-head compact eg-gis-intro">
        <div>
          <span className="eg-section-kicker">Giám sát vị trí</span>
          <h2 id="campus-map-title">Bản đồ GIS campus</h2>
        </div>
        <span className="eg-map-count"><Trash size={16} weight="duotone" aria-hidden="true" /> {stations.length} điểm</span>
      </div>

      <div className="eg-gis-map-frame">
        <div className="eg-gis-map-head">
          <h3>Dữ liệu Quy hoạch Khuôn viên</h3>
          <div className="eg-gis-map-actions">
            <div className="eg-gis-layer-legend" aria-label="Chú giải lớp GIS">
              {gisLegend.map(item => (
                <span key={item.id} className={item.className}>
                  <i aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="eg-layer-drawer-toggle"
              aria-expanded={layerPanelOpen}
              aria-controls="gis-layer-panel"
              aria-label={layerPanelOpen ? "Ẩn lớp bản đồ" : "Hiện lớp bản đồ"}
              onClick={() => setLayerPanelOpen(current => !current)}
            >
              <SlidersHorizontal size={17} weight="bold" aria-hidden="true" />
              <span>{layerPanelOpen ? "Ẩn lớp" : "Lớp bản đồ"}</span>
            </button>
          </div>
        </div>

        {layerPanelOpen && (
          <div id="gis-layer-panel" className="eg-map-layer-toggle" aria-label="Bảng bật tắt lớp GIS">
            <span>Lớp hiển thị</span>
            {geoJsonLayers.map(layer => (
              <button
                key={layer.id}
                type="button"
                aria-label={`Lớp ${layer.label.toLowerCase()}`}
                aria-pressed={enabledLayers.has(layer.id)}
                disabled={layer.countLabel.startsWith("0")}
                onClick={() => toggleLayer(layer.id)}
              >
                {layer.label}
              </button>
            ))}
          </div>
        )}

      <div className="eg-campus-map">
        <div className="eg-map-controls" aria-label="Điều khiển bản đồ">
          <button type="button" aria-label="Phóng to bản đồ" onClick={zoomIn}><Plus size={16} weight="bold" aria-hidden="true" /></button>
          <button type="button" aria-label="Thu nhỏ bản đồ" onClick={zoomOut}><Minus size={16} weight="bold" aria-hidden="true" /></button>
        </div>

        <button type="button" className="eg-map-reset" aria-label="Căn giữa campus" onClick={resetView}>
          <Crosshair size={17} weight="bold" aria-hidden="true" />
          <span>Căn giữa</span>
        </button>

        <div className="eg-leaflet-shell">
          <div ref={mapElementRef} className="eg-leaflet-map" role="application" aria-label="Bản đồ GIS khuôn viên trường" />
        </div>
      </div>
      </div>

      <div className="eg-map-detail-grid" aria-label="Chi tiết điểm đặt thùng rác">
        <div className="eg-map-station-list" aria-label="Danh sách điểm đặt thùng rác">
          {stations.map(station => {
            const statusText = STATUS_LABELS[station.status] || station.status;
            return (
              <button
                key={station.id}
                type="button"
                className={station.id === effectiveSelectedStationId ? "is-selected" : ""}
                aria-label={`Chọn thùng ${station.id}`}
                aria-pressed={station.id === effectiveSelectedStationId}
                onClick={() => selectStation(station)}
              >
                <span style={{ "--group-color": getGroupColor(station.binGroup) }} />
                <strong>{station.name}</strong>
                <small>{statusText}{station.openFeedbackCount ? ` - ${station.openFeedbackCount} cảnh báo` : ""}</small>
              </button>
            );
          })}
        </div>

        <article className="eg-map-detail-panel" aria-live="polite">
          {selectedStation ? (
            <>
              <div className="eg-map-detail-head">
                <div>
                  <span className="eg-section-kicker">Điểm đang chọn</span>
                  <h3>{selectedStation.name}</h3>
                </div>
                <StatusBadge group={selectedStation.binGroup}>{selectedStation.binGroup}</StatusBadge>
              </div>

              <dl className="eg-map-detail-list">
                <div><dt>Vị trí</dt><dd>{selectedStation.location}</dd></div>
                <div><dt>Khu vực</dt><dd>{selectedStation.zone}</dd></div>
                <div><dt>Trạng thái</dt><dd>{STATUS_LABELS[selectedStation.status] || selectedStation.status}</dd></div>
                <div><dt>Mức đầy</dt><dd>Sức chứa {selectedStation.capacity}% - {capacityTone(selectedStation.capacity)}</dd></div>
                <div><dt>Mã QR</dt><dd>{selectedStation.qrCode}</dd></div>
                <div><dt>Phản hồi</dt><dd>{openSelectedFeedbackCount} phản hồi mở</dd></div>
              </dl>

              <div className="eg-map-position-box">
                <div>
                  <span>Tọa độ mô phỏng</span>
                  <strong>X {roundedPercent(draftPosition?.x ?? selectedStation.x)}% · Y {roundedPercent(draftPosition?.y ?? selectedStation.y)}%</strong>
                </div>
                {hasPositionChanges && <span className="eg-position-dirty">Có thay đổi vị trí</span>}
              </div>

              <div className="eg-map-position-actions" aria-label="Chỉnh vị trí điểm thùng">
                {!editingPosition ? (
                  <button type="button" className="eg-secondary-btn" onClick={startPositionEdit}>
                    <ArrowsOutCardinal size={16} weight="bold" aria-hidden="true" />
                    Chỉnh vị trí
                  </button>
                ) : (
                  <>
                    <button type="button" className="eg-secondary-btn" aria-label="Di chuyển sang trái" onClick={() => moveDraftPosition(-5, 0)}>Trái</button>
                    <button type="button" className="eg-secondary-btn" aria-label="Di chuyển lên trên" onClick={() => moveDraftPosition(0, -5)}>Lên</button>
                    <button type="button" className="eg-secondary-btn" aria-label="Di chuyển xuống dưới" onClick={() => moveDraftPosition(0, 5)}>Xuống</button>
                    <button type="button" className="eg-secondary-btn" aria-label="Di chuyển sang phải" onClick={() => moveDraftPosition(5, 0)}>Phải</button>
                    <button type="button" className="eg-primary-btn" aria-label="Xác nhận vị trí" disabled={savingPosition || !hasPositionChanges} onClick={confirmPositionEdit}>
                      <CheckCircle size={16} weight="bold" aria-hidden="true" />
                      {savingPosition ? "Đang lưu..." : "Xác nhận vị trí"}
                    </button>
                    <button type="button" className="eg-secondary-btn" aria-label="Hủy thay đổi vị trí" disabled={savingPosition} onClick={cancelPositionEdit}>
                      <XCircle size={16} weight="bold" aria-hidden="true" />
                      Hủy
                    </button>
                  </>
                )}
              </div>
              {positionError && <p className="eg-inline-error">{positionError}</p>}

              <div className="eg-map-feedback-list">
                <span>Phản hồi liên quan</span>
                {selectedFeedback.length ? selectedFeedback.map(item => (
                  <p key={item.id}>{item.message}</p>
                )) : <p>Chưa có phản hồi cho điểm này.</p>}
              </div>
            </>
          ) : <p>Chưa có điểm thùng để hiển thị.</p>}
        </article>
      </div>

      <div className="eg-map-summary" aria-label="Tóm tắt trạng thái bản đồ">
        <span>{activeCount} điểm hoạt động</span>
        <span>{maintenanceCount} điểm cần kiểm tra</span>
        <span className={openFeedbackCount ? "is-warning" : ""}>{openFeedbackCount} phản hồi cần xử lý</span>
      </div>
      <div className="eg-map-legend" aria-label="Chú giải nhóm thùng">
        {BIN_GROUPS.map(group => <span key={group.id} style={{ "--group-color": group.color }}>{group.label}</span>)}
      </div>
    </section>
  );
}
