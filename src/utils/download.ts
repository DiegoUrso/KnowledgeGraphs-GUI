import JSZip from 'jszip';

export default function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");

    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}

export async function createZipFile(files: File[], zipFileName: string): Promise<File> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file);
  }

  return zip.generateAsync({ type: "blob" }).then((blob) => new File([blob], zipFileName, { type: "application/zip" }));
}