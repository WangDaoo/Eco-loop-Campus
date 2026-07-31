import { isOpenFeedback } from "../data/feedbackConfig";

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function statusCode(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function labelCode(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("vi-VN") : "";
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function formatDayLabel(dateKey) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

function inDateRange(value, filters) {
  const current = dateOnly(value);
  const dateFrom = dateOnly(filters.dateFrom);
  const dateTo = dateOnly(filters.dateTo);
  const hasDateFilter = Boolean(dateFrom || dateTo);
  if (!current) return !hasDateFilter;
  if (dateFrom && current < dateFrom) return false;
  if (dateTo && current > dateTo) return false;
  return true;
}

function binMatches(bin, filters) {
  if (!bin) return false;
  if (filters.building && labelCode(bin.building) !== labelCode(filters.building)) return false;
  if (filters.binGroup && labelCode(bin.binGroup) !== labelCode(filters.binGroup)) return false;
  return true;
}

function getLinkedBinId(item) {
  return item.binId || item.bin_id || "";
}

export function filterReportData(data, filters = {}) {
  const allBins = rows(data.bins);
  const hasBinFilter = Boolean(filters.building || filters.binGroup);
  const bins = hasBinFilter ? allBins.filter(bin => binMatches(bin, filters)) : allBins;
  const binIds = new Set(bins.map(bin => bin.id));
  const matchBin = item => !hasBinFilter || binIds.has(getLinkedBinId(item));

  return {
    predictions: rows(data.predictions).filter(item => inDateRange(item.timestamp, filters) && matchBin(item)),
    pointHistory: rows(data.pointHistory).filter(item => inDateRange(item.timestamp || item.createdAt, filters) && matchBin(item)),
    feedback: rows(data.feedback).filter(item => inDateRange(item.timestamp, filters) && matchBin(item)),
    bins,
  };
}

export function buildReportSummary(data) {
  return {
    totalScans: (data.predictions || []).length,
    totalPoints: (data.pointHistory || []).reduce((sum, item) => sum + safeNumber(item.points), 0),
    openFeedback: (data.feedback || []).filter(isOpenFeedback).length,
    fullBins: (data.bins || []).filter(bin => statusCode(bin.status) === "full" || safeNumber(bin.capacity) >= 85).length,
  };
}

export function makeDailyReportData(data) {
  const dayMap = new Map();
  const ensure = value => {
    const date = dateOnly(value);
    if (!date) return null;
    if (!dayMap.has(date)) dayMap.set(date, { scans: 0, points: 0, feedback: 0 });
    return dayMap.get(date);
  };

  (data.predictions || []).forEach(item => {
    const row = ensure(item.timestamp);
    if (row) row.scans += 1;
  });
  (data.pointHistory || []).forEach(item => {
    const row = ensure(item.timestamp || item.createdAt);
    if (row) row.points += safeNumber(item.points);
  });
  (data.feedback || []).forEach(item => {
    const row = ensure(item.timestamp);
    if (row) row.feedback += 1;
  });

  const keys = Array.from(dayMap.keys()).sort();
  return {
    labels: keys.map(formatDayLabel),
    datasets: [
      { label: "Lượt quét", data: keys.map(key => dayMap.get(key).scans), borderColor: "#4680ff", backgroundColor: "rgba(70,128,255,0.12)", tension: 0.35, fill: true },
      { label: "Ecopoint", data: keys.map(key => dayMap.get(key).points), borderColor: "#2ca87f", backgroundColor: "rgba(44,168,127,0.12)", tension: 0.35, fill: true },
      { label: "Phản hồi", data: keys.map(key => dayMap.get(key).feedback), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)", tension: 0.35, fill: true },
    ],
  };
}

export function makeReportCsvRows(data) {
  const scanRows = (data.predictions || []).map(item => ({ loai: "scan", ma: item.id, nhom: item.binGroup, trang_thai: item.status, diem: "", thoi_gian: item.timestamp }));
  const pointRows = (data.pointHistory || []).map(item => ({ loai: "point", ma: item.id, nhom: item.binGroup, trang_thai: item.action, diem: item.points, thoi_gian: item.timestamp || item.createdAt }));
  const feedbackRows = (data.feedback || []).map(item => ({ loai: "feedback", ma: item.id, nhom: item.category, trang_thai: item.status, diem: "", thoi_gian: item.timestamp }));
  const binRows = (data.bins || []).map(item => ({ loai: "bin", ma: item.id, nhom: item.binGroup, trang_thai: item.status, diem: "", thoi_gian: `${safeNumber(item.capacity)}%` }));
  return [...scanRows, ...pointRows, ...feedbackRows, ...binRows];
}
