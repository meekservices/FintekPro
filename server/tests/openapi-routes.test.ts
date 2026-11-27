import { describe, expect, it } from "vitest";
import { FINTEKPRO_OPENAPI_SPEC } from "../routes/openapi-routes";

describe("OpenAPI 3.1 Specification (Institutional Grade)", () => {
	it("conforms to OpenAPI 3.1.0 schema specification", () => {
		expect(FINTEKPRO_OPENAPI_SPEC.openapi).toBe("3.1.0");
		expect(FINTEKPRO_OPENAPI_SPEC.info.title).toBe("FintekPro Institutional API");
		expect(FINTEKPRO_OPENAPI_SPEC.info.version).toBe("1.0.0");
	});

	it("defines critical capital markets and regulatory endpoints", () => {
		const paths = Object.keys(FINTEKPRO_OPENAPI_SPEC.paths);
		expect(paths).toContain("/api/v1/health");
		expect(paths).toContain("/api/agent/knowledge-hub/market-brief");
		expect(paths).toContain("/api/stamp-duty/calculate");
	});

	it("declares institutional security schemes", () => {
		expect(FINTEKPRO_OPENAPI_SPEC.components.securitySchemes.ApiKeyAuth).toBeDefined();
		expect(FINTEKPRO_OPENAPI_SPEC.components.securitySchemes.SessionAuth).toBeDefined();
	});
});
