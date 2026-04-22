export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Wrapper de fetch que:
 * - Verifica res.ok e lança ApiError com mensagem legível em caso de falha
 * - Faz parse de JSON
 * - Aceita AbortSignal para cancelamento
 */
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const data = await res.json();
      message = data.error ?? data.message ?? message;
    } catch {
      // ignora erro de parse no corpo de erro
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
