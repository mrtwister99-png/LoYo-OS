// D:\dev\loyo-os\apps\web\src\components\Builder.tsx
import { useState, useEffect } from 'react'
import AgentBuilder    from './builder/AgentBuilder'
import TeamBuilder     from './builder/TeamBuilder'
import SkillBuilder    from './builder/SkillBuilder'
import McpBuilder      from './builder/McpBuilder'
import CliBuilder      from './builder/CliBuilder'
import LoopBuilder     from './builder/LoopBuilder'
import WorkflowBuilder from './builder/WorkflowBuilder'
import RagBuilder      from './builder/RagBuilder'
import ApiBuilder      from './builder/ApiBuilder'

type BuilderType = 'agent' | 'team' | 'skill' | 'mcp' | 'cli' | 'loop' | 'workflow' | 'rag' | 'api'

const BUILDER_ITEMS: { id: BuilderType; label: string }[] = [
  { id: 'agent',    label: 'AGENT'    },
  { id: 'team',     label: 'TEAM'     },
  { id: 'skill',    label: 'SKILL'    },
  { id: 'mcp',      label: 'MCP'      },
  { id: 'cli',      label: 'CLI'      },
  { id: 'loop',     label: 'LOOP'     },
  { id: 'workflow', label: 'WORKFLOW' },
  { id: 'rag',      label: 'RAG'      },
  { id: 'api',      label: 'API'      },
]

const BUILDER_MAP: Record<BuilderType, React.ComponentType<BuilderProps>> = {
  agent:    AgentBuilder,
  team:     TeamBuilder,
  skill:    SkillBuilder,
  mcp:      McpBuilder,
  cli:      CliBuilder,
  loop:     LoopBuilder,
  workflow: WorkflowBuilder,
  rag:      RagBuilder,
  api:      ApiBuilder,
}

export interface BuilderProps {
  onComplete: (manifest: object) => void
}

type Props = {
  onManifestComplete?: (type: BuilderType, manifest: object) => void
  focused?: boolean
  externalOpen?: boolean
  onExternalClose?: () => void
}

export function Builder({ onManifestComplete, focused, externalOpen, onExternalClose }: Props) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  // Sync s externím stavem (Tab focus z Layout)
  useEffect(() => {
    if (externalOpen) setOpen(true)
  }, [externalOpen])
  const [activeBuilder, setActiveBuilder] = useState<BuilderType | null>(null)

  const closeMenu = () => {
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
      onExternalClose?.()
    }, 260)
  }

  const handleComplete = (type: BuilderType, manifest: object) => {
    onManifestComplete?.(type, manifest)
    setActiveBuilder(null)
    closeMenu()
  }

  const ActiveComponent = activeBuilder ? BUILDER_MAP[activeBuilder] : null

  return (
    <>
      {/* ── Builder trigger + dropdown — řízeno z Headeru přes externalOpen ── */}
      <div style={{ position: 'relative' }}>
        {/* Trigger tlačítko — viditelné v Header sekci */}
        <button
          onClick={() => { open ? closeMenu() : setOpen(true) }}
          title="Builder"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: open ? '#1a1a1a' : '#000000',
            color: '#ffffff',
            border: open ? '2px solid #00ff41' : '2px solid #000000',
            fontSize: 13,
            fontWeight: 900,
            fontFamily: 'monospace',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: focused
              ? '0 0 0 3px rgba(0,255,65,0.4), 0 4px 16px rgba(0,0,0,0.4)'
              : open
                ? '0 0 0 2px #00ff41, 0 4px 12px rgba(0,0,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.15s',
            letterSpacing: '0.02em',
          }}
        >
          B
        </button>

        {/* ── seznam — vyjeде dolů, zelený obrys ─────────────────── */}
        {(open || closing) && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: '#111111',
              border: '2px solid #00ff41',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(0,255,65,0.15), 0 16px 48px rgba(0,0,0,0.7)',
              minWidth: 180,
              zIndex: 60,
              animation: closing
                ? 'builderSlideUp 0.26s cubic-bezier(0.4,0,1,1) forwards'
                : 'builderSlideDown 0.38s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <div
              style={{
                padding: '10px 14px 8px',
                borderBottom: '1px solid rgba(0,255,65,0.15)',
              }}
            >
              <span style={{
                fontSize: 9,
                letterSpacing: '0.4em',
                fontWeight: 700,
                color: '#00ff41',
                fontFamily: 'monospace',
              }}>
                BUILDER
              </span>
            </div>
            {BUILDER_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveBuilder(item.id) }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontSize: 11,
                  letterSpacing: '0.25em',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: activeBuilder === item.id ? '#00ff41' : 'rgba(255,255,255,0.55)',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,255,65,0.06)'
                  e.currentTarget.style.color = '#00ff41'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.color = activeBuilder === item.id ? '#00ff41' : 'rgba(255,255,255,0.55)'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes builderSlideDown {
          from { opacity: 0; transform: translateY(-12px) scaleY(0.92); }
          to   { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes builderSlideUp {
          from { opacity: 1; transform: translateY(0) scaleY(1); }
          to   { opacity: 0; transform: translateY(-10px) scaleY(0.9); }
        }
      `}</style>

      {/* ── aktivní builder overlay ───────────────────────── */}
      {ActiveComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl"
            style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
          >
            <button
              onClick={() => { setActiveBuilder(null) }}
              className="absolute top-4 right-4 text-xl leading-none transition-opacity opacity-30 hover:opacity-80 text-white"
            >
              ✕
            </button>
            <div className="text-[10px] tracking-[0.4em] font-bold mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {activeBuilder?.toUpperCase()} BUILDER
            </div>
            <ActiveComponent
              onComplete={(manifest) => handleComplete(activeBuilder!, manifest)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Builder
