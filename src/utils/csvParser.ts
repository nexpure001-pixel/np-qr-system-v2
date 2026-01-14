export async function parseCSV(file: File): Promise<Record<string, string>[]> {
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

            const headers = splitCSV(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
            const results: Record<string, string>[] = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = splitCSV(lines[i]);
                const row: Record<string, string> = {};

                // Map columns to headers
                headers.forEach((header, index) => {
                    row[header] = cols[index]?.replace(/^"|"$/g, '') || '';
                });

                // Only add if at least one column has content
                if (Object.values(row).some(v => v)) {
                    results.push(row);
                }
            }
            resolve(results);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}
