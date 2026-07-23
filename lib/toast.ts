export type ToastTone = "success" | "error";

export function emitToast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: { message, tone },
    })
  );
}
