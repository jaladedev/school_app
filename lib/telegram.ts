import { logger } from "@/lib/logger";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sends a Telegram message to a chat. Best effort: a missing bot token, a missing
 * chat id, a Telegram outage, or a slow response never throws, so a notification
 * problem can't stop the action that triggered it. Returns whether it was sent.
 *
 * TELEGRAM_BOT_TOKEN is optional and read directly, like RESEND_API_KEY.
 */
export async function sendTelegramMessage(
  chatId: string | null | undefined,
  lines: string[]
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = chatId?.trim();
  if (!token || !chat) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: lines.map(escapeHtml).join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Never log the URL: it contains the bot token.
      logger.warn("sendTelegramMessage: Telegram refused the message", { status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("sendTelegramMessage: request failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
