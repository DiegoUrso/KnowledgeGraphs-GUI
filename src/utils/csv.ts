export default function toCsv(rows: Record<string, string>[]): string {
    if (rows.length === 0) return "";

    const headers = Object.keys(rows[0]);

    const escape = (value: string): string => {
        const escaped = value.replace(/"/g, '""');
        return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    return [
        headers.join(","),
        ...rows.map((row) =>
            headers.map((header) => escape(row[header] ?? "")).join(",")
        ),
    ].join("\r\n");
}