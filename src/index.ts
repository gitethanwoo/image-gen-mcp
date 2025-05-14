import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Environment variables
interface Env {
	OPENAI_API_KEY: string;
	REPLICATE_API_KEY: string;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent<Env, unknown, Record<string, unknown>> {
	server = new McpServer({
		name: "ImageGenMCP",
		version: "1.0.0",
	});
	
	constructor(ctx: any, env: Env) {
		super(ctx, env);
	}

	// Helper to fetch from Replicate
	async callReplicate(model: string, version: string, input: Record<string, any>, apiKey?: string) {
		const key = apiKey || (this.env?.REPLICATE_API_KEY as string);
		const response = await fetch(`https://api.replicate.com/v1/predictions`, {
			method: "POST",
			headers: {
				Authorization: `Token ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ version, input }),
		});
		const result = await response.json() as any;
		if (!response.ok) throw new Error(result.error || "Replicate call failed");
		return result.output;
	}

	// Helper to call OpenAI Image API
	async callOpenAIImage(input: Record<string, any>, apiKey?: string) {
		const key = apiKey || (this.env?.OPENAI_API_KEY as string);
		const response = await fetch("https://api.openai.com/v1/images/generations", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-image-1",
				response_format: "b64_json",
				...input,
			}),
		});
		const result = await response.json() as any;
		if (!response.ok) throw new Error(result.error?.message || "OpenAI call failed");
		return result.data;
	}

	async init() {
		// Tool: generate-openai
		this.server.tool(
			"generate-openai",
			{
				prompt: z.string(),
				n: z.number().min(1).max(10).optional(),
				size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
				quality: z.enum(["low", "medium", "high", "auto"]).optional(),
				style: z.enum(["vivid", "natural"]).optional(),
				background: z.enum(["transparent", "white"]).optional(),
			},
			async (params: {
				prompt: string;
				n?: number;
				size?: string;
				quality?: string;
				style?: string;
				background?: string;
			}) => {
				try {
					const result = await this.callOpenAIImage(params);
					return { content: [{ type: "text", text: JSON.stringify(result) }] };
				} catch (error: any) {
					return { content: [{ type: "text", text: `Error: ${error.message}` }] };
				}
			}
		);

		// Tool: generate-svg
		this.server.tool(
			"generate-svg",
			{
				prompt: z.string(),
				size: z.string().optional(),
				style: z.enum(["any", "engraving", "line_art", "line_circuit", "linocut"]).optional(),
			},
			async (params: { prompt: string; size?: string; style?: string }) => {
				try {
					const result = await this.callReplicate(
						"recraft-ai/recraft-v3-svg",
						"latest", // Replace with actual version in production
						params
					);
					return { content: [{ type: "text", text: JSON.stringify(result) }] };
				} catch (error: any) {
					return { content: [{ type: "text", text: `Error: ${error.message}` }] };
				}
			}
		);

		// Tool: generate-fluxdev
		this.server.tool(
			"generate-fluxdev",
			{
				prompt: z.string(),
				aspect_ratio: z.string().optional(),
				num_outputs: z.number().min(1).max(4).optional(),
				output_format: z.enum(["webp", "png", "jpg"]).optional(),
				output_quality: z.number().min(1).max(100).optional(),
				seed: z.number().optional(),
				go_fast: z.boolean().optional(),
			},
			async (params: {
				prompt: string;
				aspect_ratio?: string;
				num_outputs?: number;
				output_format?: string;
				output_quality?: number;
				seed?: number;
				go_fast?: boolean;
			}) => {
				try {
					const result = await this.callReplicate(
						"black-forest-labs/flux-dev",
						"latest", // Replace with actual version in production
						params
					);
					return { content: [{ type: "text", text: JSON.stringify(result) }] };
				} catch (error: any) {
					return { content: [{ type: "text", text: `Error: ${error.message}` }] };
				}
			}
		);

		// Tool: generate-fluxpro
		this.server.tool(
			"generate-fluxpro",
			{
				prompt: z.string(),
				aspect_ratio: z.string().optional(),
				num_outputs: z.number().min(1).max(4).optional(),
				output_format: z.enum(["webp", "png", "jpg"]).optional(),
				output_quality: z.number().min(1).max(100).optional(),
				seed: z.number().optional(),
				prompt_upsampling: z.boolean().optional(),
				disable_safety_checker: z.boolean().optional(),
			},
			async (params: {
				prompt: string;
				aspect_ratio?: string;
				num_outputs?: number;
				output_format?: string;
				output_quality?: number;
				seed?: number;
				prompt_upsampling?: boolean;
				disable_safety_checker?: boolean;
			}) => {
				try {
					const result = await this.callReplicate(
						"black-forest-labs/flux-1.1-pro",
						"latest", // Replace with actual version in production
						params
					);
					return { content: [{ type: "text", text: JSON.stringify(result) }] };
				} catch (error: any) {
					return { content: [{ type: "text", text: `Error: ${error.message}` }] };
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// Create and initialize the MCP agent before serving
			const agent = new MyMCP(ctx, env);
			// Initialize the tools by calling init() before serving the SSE endpoint
			return agent.init().then(() => {
				return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
			});
		}

		if (url.pathname === "/mcp") {
			// Create and initialize the MCP agent before serving
			const agent = new MyMCP(ctx, env);
			// Initialize the tools by calling init() before serving the MCP endpoint
			return agent.init().then(() => {
				return MyMCP.serve("/mcp").fetch(request, env, ctx);
			});
		}

		return new Response("Not found", { status: 404 });
	},
};
