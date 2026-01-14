export async function parseCSV(file: File): Promise<{ employee_id: string; name: string }[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const buffer = event.target?.result as ArrayBuffer;

            // Try UTF-8 first
            let text = new TextDecoder('utf-8').decode(buffer);

            // Heuristic check for Shift-JIS/Garbage: If it contains the replacement character (), try Shift-JIS
            if (text.includes('\uFFFD')) {
                text = new TextDecoder('shift-jis').decode(buffer);
            }

            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                resolve([]);
                return;
            }

            // Robust CSV Column Splitter (handles quotes)
            const splitCSV = (line: string) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current.trim());
                return result;
            };

            const results: { employee_id: string; name: string }[] = [];
            const headers = splitCSV(lines[0]).map(h => h.toLowerCase());

            // Index finding logic
            const idIndex = headers.findIndex(h => h.includes('id') || h.includes('社員番号') || h.includes('番号'));
            const nameIndex = headers.findIndex(h => h.includes('name') || h.includes('氏名') || h.includes('名前') || h.includes('名まえ'));

            if (idIndex === -1 || nameIndex === -1) {
                reject(new Error('CSVの1行目（ヘッダー）に「ID」と「名前」の両方が含まれている必要があります。'));
                return;
            }

            for (let i = 1; i < lines.length; i++) {
                const cols = splitCSV(lines[i]);
                const id = cols[idIndex]?.replace(/^"|"$/g, '');
                const name = cols[nameIndex]?.replace(/^"|"$/g, '');

                if (id && name) {
                    results.push({ employee_id: id, name: name });
                }
            }
            resolve(results);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}
