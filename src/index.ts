import { Elysia } from "elysia";

new Elysia()
	.get("/", () => {
		return responseHelper(JSON.stringify({ message: "Proxy is working as expected" }), 200);
	})
	.all("*", async context => {
		const { request } = context;
		const { headers } = request;
		if (!isValidOrigin(headers.get("origin") as string)) return responseHelper(JSON.stringify({ message: "Unsupported origin" }), 403);

		if (request.method === "OPTIONS") return responseHelper(null, 200);
		if (request.method === "HEAD") return MethodNotAllowed(request);

		const cleanedHeaders = filterSupportedHeaders(Object.fromEntries(headers)) as Record<string, string>;

		let url: URL;
		try {
			url = new URL(request.url);
		} catch {
			return responseHelper(JSON.stringify({ message: "Invalid URL has been provided" }), 400);
		}

		const { pathname: path, searchParams: params } = url;
		const query = Object.fromEntries(params.entries());

		const targetURL = createTargetURL(path, query as Record<string, string>);
		if (!targetURL) return responseHelper(JSON.stringify({ message: "Invalid URL has been provided" }), 400);
		if (targetURL.hostname.toString() === "genius.com")
			return responseHelper(JSON.stringify({ message: "Genius has been disabled from the cors-proxy." }), 403);
		if (targetURL.hostname.toString() === "localhost" || targetURL.hostname.toString() === "127.0.0.1" || targetURL.hostname.toString() === "[::1]")
			return responseHelper(JSON.stringify({ message: "localhost URLs cannot be fetched" }), 403);

		const requestOptions = createRequestOptions(cleanedHeaders, request.method, request.body, targetURL.hostname.toString());

		try {
			// @ts-expect-error
			const response = await fetch(targetURL.toString(), requestOptions);
			const responseHeaders: Record<string, string> = {};
			for (const [key, value] of response.headers.entries()) {
				responseHeaders[key] = value;
			}
			const headers = cleanHeaders(responseHeaders);

			const file = Bun.file("amount.txt");
			const text = await file.text();
			const num = parseInt(Number.isNaN(text) ? "0" : text);
			const next = num + 1;
			Bun.write("amount.txt", next.toString());

			return responseHelper(response.body, response.status, headers);
		} catch (e) {
			console.log(e);
			return responseHelper(JSON.stringify({ message: e }), 500);
		}
	})
	.listen(process.env.PORT || 3000);

function isValidOrigin(origin: string | undefined) {
	return origin === "https://xpui.app.spotify.com";
}

function filterSupportedHeaders(headers: Record<string, string>): Record<string, string> {
	const supportedHeaders = ["content-type", "authorization", "accept", "cors-cookie", "origin", "x-requested-with"];
	const filteredHeaders: Record<string, string> = {};

	for (const key in headers) {
		if (supportedHeaders.includes(key.toLowerCase())) filteredHeaders[key] = headers[key];
	}

	return filteredHeaders;
}

function cleanHeaders(headers: Record<string, string>): Record<string, string> {
	const blacklistedHeaders = [
		"access-control-allow-headers",
		"access-control-allow-origin",
		"access-control-allow-method",
		"access-control-allow-methods",
		"date",
		"set-cookie",
		"content-encoding"
	];
	const cleanedHeaders: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (!blacklistedHeaders.includes(key.toLowerCase())) cleanedHeaders[key.toLowerCase()] = value;
	}

	return cleanedHeaders;
}

function createHeaders() {
	return {
		"Access-Control-Allow-Origin": "https://xpui.app.spotify.com",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE",
		"Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, cors-cookie"
	};
}

function createTargetURL(path: string, query: Record<string, string>) {
	let finalURL = path.substring(1);
	if (query) {
		const params = new URLSearchParams();
		for (const key in query) {
			if (Object.hasOwn(query, key)) {
				params.append(key, query[key]);
			}
		}
		finalURL += `?${params.toString()}`;
	}
	if (!finalURL.startsWith("http")) return;

	return new URL(finalURL);
}

function createRequestOptions(headers: Record<string, string>, method: string, body: unknown, hostname: string) {
	// biome-ignore lint/performance/noDelete: <explanation>
	delete headers.origin;
	// biome-ignore lint/performance/noDelete: <explanation>
	delete headers.host;

	const customHeaders: Record<string, string> = {
		"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
		origin: hostname,
		referer: hostname
	};

	if (headers["cors-cookie"]) {
		customHeaders.cookie = headers["cors-cookie"];
		// biome-ignore lint/performance/noDelete: <explanation>
		delete headers["cors-cookie"];
	}

	if (hostname.includes("musixmatch")) {
		if (customHeaders.cookie) customHeaders.cookie += ";x-mxm-token-guid=";
		else customHeaders.cookie = "x-mxm-token-guid=";
	}

	const requestOptions: { method: string; headers: Record<string, string>; timeout: number; body?: unknown } = {
		method: method,
		headers: {
			...headers,
			...customHeaders
		},
		timeout: 5000
	};

	if (body) requestOptions.body = body;

	return requestOptions;
}

async function MethodNotAllowed(request: Request) {
	return responseHelper(JSON.stringify({ message: `Method ${request.method} is not allowed` }), 405, { Allow: "GET, POST, PUT, DELETE, PATCH" });
}

function responseHelper(res: unknown, status: number, headers?: Record<string, string>) {
	// @ts-expect-error
	return new Response(res, { status, headers: { ...headers, ...createHeaders() } });
}
