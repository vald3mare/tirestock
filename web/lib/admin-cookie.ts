// Имя куки сессии админки — в отдельном модуле без серверных импортов,
// чтобы его мог использовать middleware (edge-runtime, без next/headers).
export const SESSION_COOKIE = "admin_session";
