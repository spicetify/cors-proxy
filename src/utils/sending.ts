import type { H3Event, EventHandlerRequest } from "h3";

export async function sendJson(ops: {
	event: H3Event<EventHandlerRequest>;
	data: Record<string, unknown>;
	status?: number;
}) {
	setResponseStatus(ops.event, ops.status ?? 200);
	appendCorsHeaders(ops.event, {
		origin: (origin: string) => {
			return origin === "https://xpui.app.spotify.com";
		},
	});
	await send(ops.event, JSON.stringify(ops.data, null, 2), "application/json");
}
