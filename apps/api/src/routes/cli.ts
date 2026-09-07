// D:\dev\loyo-os\apps\api\src\routes\cli.ts
// LOYO OS // CLI tools endpoint — čte tools/cli/* + commands.json

import { FastifyInstance } from 'fastify'
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI_DIR = resolve(__dirname, '../../../../tools/cli')
const COMMANDS_FILE = resolve(__dirname, '../../../../data/agents/Mary_Jane/commands.json')

interface CliTool
{
  id: string
  name: string
  path: string
  hasPackageJson: boolean
  hasIndex: boolean
  commands: string[]
}

async function discoverCliTools(): Promise<CliTool[]>
{
  const tools: CliTool[] = []

  try
  {
    const entries = await readdir(CLI_DIR, { withFileTypes: true })

    for (const entry of entries)
    {
      if (!entry.isDirectory()) continue

      const toolDir = join(CLI_DIR, entry.name)
      const tool: CliTool = {
        id: entry.name,
        name: entry.name,
        path: `tools/cli/${entry.name}`,
        hasPackageJson: false,
        hasIndex: false,
        commands: [],
      }

      // check package.json
      try
      {
        await stat(join(toolDir, 'package.json'))
        tool.hasPackageJson = true
      }
      catch {}

      // check index.ts
      try
      {
        await stat(join(toolDir, 'index.ts'))
        tool.hasIndex = true

        const src = await readFile(join(toolDir, 'index.ts'), 'utf-8')

        // 1. Commander.js pattern: .command('xxx')
        for (const m of src.matchAll(/\.command\(['"]([^'"]+)['"]/g))
        {
          tool.commands.push(m[1])
        }

        // 2. ruční argv pattern: subcommand === 'xxx' nebo args[0] ?? 'xxx'
        for (const m of src.matchAll(/subcommand\s*(?:===|!==)\s*['"]([^'"]+)['"]/g))
        {
          if (!tool.commands.includes(m[1])) tool.commands.push(m[1])
        }

        // 3. fallback default z args[0] ?? 'xxx'
        for (const m of src.matchAll(/args\[0\]\s*\?\?\s*['"]([^'"]+)['"]/g))
        {
          if (!tool.commands.includes(m[1])) tool.commands.push(m[1])
        }

        // 4. getArg pattern: getArg('--xxx') → extrahuj dostupné flagy
        for (const m of src.matchAll(/getArg\(['"](-{1,2}[a-zA-Z][\w-]*)['"]/g))
        {
          if (!tool.commands.includes(m[1])) tool.commands.push(m[1])
        }
      }
      catch {}

      tools.push(tool)
    }
  }
  catch {}

  return tools
}

async function getScheduledCommands(): Promise<any[]>
{
  try
  {
    const raw = await readFile(COMMANDS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return (data.commands || []).filter((c: any) => c.schedule)
  }
  catch
  {
    return []
  }
}

export default async function cliRoutes(app: FastifyInstance)
{
  // GET /api/cli — seznam CLI tools z tools/cli/*
  app.get('/cli', async () =>
  {
    const tools = await discoverCliTools()
    const scheduled = await getScheduledCommands()
    return { tools, scheduled, dir: 'tools/cli/' }
  })
}
