export declare const tools: Array<{
    definition: {
        name: string;
        description: string;
        inputSchema: object;
    };
    execute: (args: Record<string, unknown>) => Promise<unknown>;
}>;
