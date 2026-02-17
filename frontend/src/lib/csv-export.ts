interface CSVColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (value: any, row: T) => string;
}

/**
 * 데이터를 CSV로 내보내기
 * BOM 포함하여 한국어 Excel 호환
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string,
) {
  if (data.length === 0) return;

  const header = columns.map((col) => `"${col.label}"`).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = col.format
          ? col.format(getNestedValue(row, col.key as string), row)
          : getNestedValue(row, col.key as string);
        const str = value == null ? '' : String(value);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(','),
  );

  // BOM for Korean Excel compatibility
  const BOM = '\uFEFF';
  const csv = BOM + [header, ...rows].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
