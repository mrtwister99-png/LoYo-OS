import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";

export function createServer() {
  const server = new Server({ name: "loyo-tools", version: "1.0.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t: any) => t.definition || t)
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
    const tool: any = tools.find((t: any) => (t.definition?.name || t.name) === req.params.name);
    if (!tool) throw new Error("Tool not found");
    if (tool.enabled === false) throw new Error("Tool disabled");
    const exec = tool.execute || tool.handler;
    const result = await exec(req.params.arguments || {});
    return { content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result) }] };
  });

  return server;
}