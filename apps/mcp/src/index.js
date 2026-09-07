import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
async function main() {
    const server = createServer();
    await server.connect(new StdioServerTransport());
    console.error("LOYO MCP running on stdio");
}
main().catch(console.error);
//# sourceMappingURL=index.js.map