export default async function getGraphData() {
    const file = await pickJsonFile() as File | null;
    if (!file) {
        throw new Error("No file selected.");
    }

    const text = await file.text();
    try {
        const data = JSON.parse(text);
        return [file.name, data];
    } catch (error) {
        throw new Error("Invalid JSON file.");
    }
}

export async function getMultipleGraphData() {
    const files = await pickJsonFile(true) as File[] | null;
    if (!files || files.length === 0) {
        throw new Error("No files selected.");
    }

    const dataArray: any[][] = [];
    for (const file of files) {
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            dataArray.push([file.name, data]);
        } catch (error) {
            console.error(`Error parsing JSON from file ${file.name}:`, error);
            throw new Error(`Invalid JSON in file ${file.name}.`);
        }
    }
    return dataArray;
}

export async function pickJsonFile(multiple = false): Promise<File | File[] | null> {
    return await new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.multiple = multiple;

        if (!multiple)  input.onchange = () => resolve(input.files?.[0] ?? null);
        else input.onchange = () => resolve(input.files ? Array.from(input.files) : null);
        input.click();
    });
}