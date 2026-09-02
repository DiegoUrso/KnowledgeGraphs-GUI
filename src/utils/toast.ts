type ToastType = "info" | "success" | "warning" | "error";

export default function showToast(
    message: string,
    type: ToastType = "info",
    duration = 5000
) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    if (type === "error") toast.textContent = `Error: ${message}`;
    else if (type === "warning") toast.textContent = `Warning: ${message}`;
    else toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        toast.addEventListener("transitionend", () => toast.remove(), {
            once: true,
        });
    }, duration);
}