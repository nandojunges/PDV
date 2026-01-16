// src/services/reportText.js

export const REPORT_LINE_WIDTH = 32;
export const REPORT_SEPARATOR = "-".repeat(REPORT_LINE_WIDTH);

export const centerText = (text, width = REPORT_LINE_WIDTH) => {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const padding = Math.max(0, Math.floor((width - raw.length) / 2));
  return `${" ".repeat(padding)}${raw}`;
};

export const formatRow = (label, value, width = REPORT_LINE_WIDTH) => {
  const labelText = String(label ?? "").trim();
  const valueText = value == null ? "" : String(value).trim();
  if (!valueText) return [labelText];
  const space = width - labelText.length - valueText.length;
  if (space >= 1) {
    return [`${labelText}${" ".repeat(space)}${valueText}`];
  }
  return [labelText, valueText.padStart(width)];
};

export const formatSectionTitle = (text) => {
  const title = String(text ?? "").trim();
  if (!title) return "";
  return title.toUpperCase();
};

export const joinLines = (lines) =>
  (Array.isArray(lines) ? lines : [])
    .filter((line) => line !== undefined && line !== null && line !== "")
    .join("\n");