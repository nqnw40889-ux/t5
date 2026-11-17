import type { PredictionResult } from './types';

export interface HistoryEntry {
  id: string;
  time: number;
  mode: 'manual' | 'csv';
  total: number;
  failures: number;
  score?: number;
  sampleName?: string;
  exactThreshold?: number;
  result?: PredictionResult;
}

export function downloadFile(contents: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(rows: Array<Array<string | number>>, filename: string) {
  const contents = rows.map(row => row.map(value => {
    if (typeof value === 'number') return String(value);
    // Keep user-supplied filenames and identifiers as text in spreadsheets.
    const escaped = /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + escaped.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  downloadFile('\uFEFF' + contents, 'text/csv;charset=utf-8', filename);
}
