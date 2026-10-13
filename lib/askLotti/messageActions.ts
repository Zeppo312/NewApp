import type { StoredChatMessage } from './chatStore';

/** Older servers returned these failure texts as successful answers. */
export const isUnavailableLottiAnswer = (text: string): boolean =>
  /keine verlässliche Antwort formulieren|cannot form a reliable answer|no puedo formular una respuesta fiable|Die konkreten Ergebnisse findest du in den Karten unten|Los resultados concretos aparecen en las tarjetas|The concrete results (?:are shown|appear) in the cards|Die Datengrundlage siehst du unten|La base de datos aparece abajo|The data basis is shown below/i.test(text);

export const canImportLottiMessage = (message: StoredChatMessage): boolean =>
  message.role === 'lotti' && message.id !== 'intro' && Boolean(message.disclaimer) &&
  !message.isError && !message.retryQuestion && !isUnavailableLottiAnswer(message.text);

export const retryQuestionForMessage = (
  message: StoredChatMessage,
  messages: StoredChatMessage[],
): string | undefined => {
  if (message.retryQuestion) return message.retryQuestion;
  if (!message.isError && !isUnavailableLottiAnswer(message.text)) return undefined;
  const index = messages.findIndex((item) => item.id === message.id);
  if (index < 0) return undefined;
  return messages.slice(0, index).reverse().find((item) => item.role === 'user')?.text;
};
