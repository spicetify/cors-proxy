import { Elysia } from "elysia";

new Elysia()
	.all("*", async context => {
		const { request } = context;
		const { headers } = request;
		if (!isValidOrigin(headers.get("origin") as string)) {
			return new Response(JSON.stringify({ message: "Unsupported origin" }), {
				status: 403,
				headers: createHeaders()
			});
		}

		if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: createHeaders() });

		if (request.method === "HEAD") return MethodNotAllowed(request);

		// @ts-expect-error
		const cleanedHeaders = filterSupportedHeaders(Object.fromEntries(headers)) as Record<string, string>;

		let url: URL;
		try {
			url = new URL(request.url);
		} catch {
			return new Response(JSON.stringify({ message: "Invalid URL has been provided" }), {
				status: 400,
				headers: createHeaders()
			});
		}
		const { pathname: path, searchParams: params } = url;
		const query = Object.fromEntries(params.entries());

		const targetURL = createTargetURL(path, query as Record<string, string>);
		if (!targetURL) {
			return new Response(JSON.stringify({ message: "Invalid URL has been provided" }), {
				status: 400,
				headers: createHeaders()
			});
		}

		const requestOptions = createRequestOptions(cleanedHeaders, request.method, request.body, targetURL.hostname.toString());

		try {
			const response = await fetch(targetURL.toString(), requestOptions);
			const json = await response.json();

			const responseHeaders: Record<string, string> = {};
			// @ts-ignore
			for (const [key, value] of response.headers.entries()) {
				responseHeaders[key] = value;
			}

			const headers = cleanHeaders(responseHeaders);

			return new Response(JSON.stringify(json), {
				status: response.status,
				headers: {
					...headers,
					...createHeaders()
				}
			});
		} catch (e) {
			console.log(e);
			return new Response(JSON.stringify({ message: e }), { status: 500 });
		}
	})
	.listen(3000);

function isValidOrigin(origin: string | undefined) {
	return origin === "https://xpui.app.spotify.com";
}

function filterSupportedHeaders(headers: Record<string, string>): Record<string, string> {
	const supportedHeaders = ["content-type", "authorization", "accept", "cors-cookie", "origin", "x-requested-with", "cors-cookie"];
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
		origin: hostname
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

	const requestAll = {
		method: method,
		headers: {
			...headers,
			...customHeaders
		},
		timeout: 5000,
		cf: {
			cacheTtl: 60,
			cacheEverything: true
		}
	};

	// @ts-expect-error
	if (body) requestAll.body = JSON.stringify(body);

	return requestAll;
}

async function MethodNotAllowed(request: Request) {
	return new Response(JSON.stringify({ message: `Method ${request.method} is not allowed` }), {
		status: 405,
		headers: {
			Allow: "GET, POST, POST, PUT, DELETE, PATCH",
			...createHeaders()
		}
	});
}
