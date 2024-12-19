import { join } from "node:path";
import pkg from "./package.json";

//https://nitro.unjs.io/config
export default defineNitroConfig({
	noPublicDir: true,
	srcDir: "./src",
	runtimeConfig: {
		version: pkg.version,
	},
	alias: {
		"@": join(__dirname, "src"),
	},
	compatibilityDate: "2024-12-19",
});
