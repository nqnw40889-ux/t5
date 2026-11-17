import { sensorFields } from './components/PredictionComparison';

export async function readPredictionResponse<T>(response: Response, fallback: string): Promise<T> {
  if (response.ok) return response.json();
  const error = await response.json().catch(() => null);
  throw new Error(typeof error?.detail === 'string' && response.status < 500 ? error.detail : fallback);
}

export function predictionError(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'Máy chủ phản hồi quá lâu. Dữ liệu vẫn được giữ, bạn có thể thử lại.';
  }
  if (error instanceof TypeError) return 'Không kết nối được với máy chủ dự đoán. Kiểm tra kết nối rồi thử lại.';
  return error instanceof Error ? error.message : fallback;
}

export function parseSensorValue(value: string | number) {
  const text = String(value).trim().replace(',', '.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;
}

export async function validateCsv(file: File) {
  if (!/\.csv$/.test(file.name)) throw new Error('Chọn tệp có phần mở rộng .csv.');
  const text = await file.text();
  const fields = ['Type', ...sensorFields.map(field => field.key)];
  const token = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\r|\n|$)/y;
  let columns: number[] | undefined;
  let columnCount = 0;
  let values: string[] = [];
  let line = 1;
  let recordLine = 1;
  let rowCount = 0;

  while (token.lastIndex <= text.length) {
    const offset = token.lastIndex;
    const match = token.exec(text);
    if (!match) throw new Error(`Dòng ${line}: định dạng CSV sai. Kiểm tra dấu phẩy và dấu ngoặc kép.`);
    const [, quoted, plain, separator] = match;
    values.push(quoted === undefined ? plain : quoted.replace(/""/g, '"'));
    line += (match[0].match(/\r\n|\r|\n/g) ?? []).length;
    if (separator === ',') continue;

    const blank = values.length === 1 && quoted === undefined && !plain.trim();
    if (!blank) {
      if (!columns) {
        columnCount = values.length;
        columns = fields.map(field => values.indexOf(field));
        const missing = fields.filter((_, index) => columns?.[index] === -1);
        if (missing.length) throw new Error(`Dòng ${recordLine}: thiếu cột ${missing.join(', ')}. Hãy dùng tệp CSV mẫu.`);
      } else {
        if (values.length > columnCount) throw new Error(`Dòng ${recordLine}: có nhiều ô hơn hàng tiêu đề.`);
        for (const [index, field] of fields.entries()) {
          const value = values[columns[index]]?.trim() ?? '';
          if (!value) throw new Error(`Dòng ${recordLine}: cột ${field} bị bỏ trống.`);
          if (field === 'Type' && !/^[LMH]$/i.test(value)) {
            throw new Error(`Dòng ${recordLine}: cột Type chỉ nhận L, M hoặc H.`);
          }
          if (field !== 'Type' && (value.includes(',') || !Number.isFinite(parseSensorValue(value)))) {
            throw new Error(`Dòng ${recordLine}: cột ${field} phải là số hữu hạn. Dùng dấu chấm cho phần thập phân.`);
          }
        }
        rowCount += 1;
      }
    }
    if (!separator || token.lastIndex === offset) break;
    values = [];
    recordLine = line;
  }
  if (!rowCount) throw new Error('Tệp CSV chưa có dòng dữ liệu. Hãy kiểm tra tệp hoặc tải mẫu có sẵn.');
}
