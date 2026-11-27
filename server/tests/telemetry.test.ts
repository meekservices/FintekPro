import { describe, expect, it } from "vitest";
import { TelemetryTracer, withTraceSpan } from "../telemetry";

describe("TelemetryTracer (W3C Distributed Tracing Standard)", () => {
	it("generates valid W3C 128-bit trace ID and 64-bit span ID", () => {
		const traceId = TelemetryTracer.generateTraceId();
		const spanId = TelemetryTracer.generateSpanId();

		expect(traceId).toHaveLength(32);
		expect(spanId).toHaveLength(16);
		expect(/^[0-9a-f]+$/.test(traceId)).toBe(true);
		expect(/^[0-9a-f]+$/.test(spanId)).toBe(true);
	});

	it("correctly parses incoming W3C traceparent headers", () => {
		const sampleHeader = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
		const ctx = TelemetryTracer.extractOrStartTrace(sampleHeader);

		expect(ctx.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
		expect(ctx.parentSpanId).toBe("00f067aa0ba902b7");
		expect(ctx.spanId).toHaveLength(16);
		expect(ctx.traceFlags).toBe("01");

		const formatted = TelemetryTracer.formatTraceParent(ctx);
		expect(formatted.startsWith("00-4bf92f3577b34da6a3ce929d0e0e4736-")).toBe(true);
	});

	it("executes async operation inside withTraceSpan and propagates context", async () => {
		let capturedTraceId = "";
		let capturedSpanId = "";

		const result = await withTraceSpan("test:operation", async (ctx) => {
			capturedTraceId = ctx.traceId;
			capturedSpanId = ctx.spanId;
			return "SUCCESS_VAL";
		});

		expect(result).toBe("SUCCESS_VAL");
		expect(capturedTraceId).toHaveLength(32);
		expect(capturedSpanId).toHaveLength(16);
	});
});
