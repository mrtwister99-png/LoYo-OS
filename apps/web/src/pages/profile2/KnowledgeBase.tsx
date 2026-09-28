import { useState, useEffect } from 'react'

type KBItem = { 
  id: number; 
  title: string; 
  content: string; 
  category: 'code'|'idea'|'snippet'|'docs'; 
  tags: string;
  createdAt: string 
}

const KEY = 'loyo-knowledgebase'

export default function KnowledgeBase() {
  const [items, setItems] = useState<KBItem[]>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch {}
    return [
      { id: 1, title: 'React useEffect cleanup', content: 'Vždy vracet cleanup funkci v useEffect pro zrušení listenerů', category: 'code', tags: 'react, hooks', createdAt: new Date().toISOString() },
      { id: 2, title: 'Tauri IPC', content: 'Jak volat Rust z frontendu přes invoke()', category: 'docs', tags: 'tauri, rust', createdAt: new Date().toISOString() }
    ]
  })
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<KBItem['category']>('code')
  const [tags, setTags] = useState('')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<'all'|KBItem['category']>('all')
  const [selectedId, setSelectedId] = useState<number|null>(null)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch {} }, [items])

  const add = () => {
    const t = title.trim()
    if (!t) return
    const item: KBItem = { id: Date.now(), title: t, content, category, tags, createdAt: new Date().toISOString() }
    setItems(p => [item, ...p])
    setTitle(''); setContent(''); setTags('')
  }

  const filtered = items.filter(i => {
    const matchSearch = search ? (i.title.toLowerCase().includes(search.toLowerCase()) || i.content.toLowerCase().includes(search.toLowerCase()) || i.tags.toLowerCase().includes(search.toLowerCase())) : true
    const matchCat = filterCat === 'all' ? true : i.category === filterCat
    return matchSearch && matchCat
  })

  const selected = items.find(i => i.id === selectedId)

  return (
    <div className="min-h-full bg-[#f5f5f0] p-4 md:p-6" style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }}>
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT - LIST */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border-[3px] border-black p-5 shadow-[6px_6px_0px_#000] rounded-[16px]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono font-black px-2 py-1 rounded-full bg-[#a136ff] text-white border-2 border-black">KB</span>
              <div className="h-[2px] w-12 bg-black"></div>
              <span className="text-[10px] tracking-[0.3em] font-black opacity-40">KNOWLEDGE BASE</span>
            </div>
            <h1 className="font-black text-xl tracking-tight">KNOWLEDGE BASE • {items.length}</h1>
            <p className="text-xs opacity-60 mt-1">Tvoje vlastní databáze znalostí, snippetů a poznámek</p>
          </div>

          <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_#000] rounded-[12px] space-y-3">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Hledat v KB..." className="w-full bg-[#f5f5f0] border-2 border-black px-3 py-2.5 text-xs rounded-[10px] font-bold outline-none" />
            <div className="flex gap-2">
              {(['all','code','snippet','idea','docs'] as const).map(c => (
                <button key={c} onClick={()=>setFilterCat(c as any)} className={`text-[10px] px-2.5 py-1 border-2 border-black font-black rounded-full ${filterCat===c?'bg-[#a136ff] text-white':'bg-white'}`}>{c.toUpperCase()}</button>
              ))}
            </div>
          </div>

          <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_#000] rounded-[12px] space-y-3">
            <div className="text-[10px] font-black tracking-widest opacity-60">+ NOVÝ ZÁZNAM</div>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Název..." className="w-full bg-[#f5f5f0] border-2 border-black px-3 py-2 text-xs rounded-[8px] font-bold" />
            <div className="flex gap-2">
              <select value={category} onChange={e=>setCategory(e.target.value as any)} className="flex-1 border-2 border-black px-2 py-2 text-xs bg-white rounded-[8px] font-black">
                <option value="code">CODE</option>
                <option value="snippet">SNIPPET</option>
                <option value="idea">IDEA</option>
                <option value="docs">DOCS</option>
              </select>
              <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="tagy..." className="flex-1 bg-[#f5f5f0] border-2 border-black px-2 py-2 text-xs rounded-[8px]" />
            </div>
            <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Obsah, kód, poznámka..." className="w-full bg-[#f5f5f0] border-2 border-black p-2 text-xs min-h-[80px] rounded-[8px] font-mono" />
            <button onClick={add} className="w-full bg-black text-white py-2.5 font-black border-2 border-black rounded-[10px] shadow-[3px_3px_0px_#000]">+ PŘIDAT DO KB</button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-auto">
            {filtered.map(item => (
              <div key={item.id} onClick={()=>setSelectedId(item.id)} className={`border-[3px] border-black p-3 rounded-[12px] cursor-pointer shadow-[3px_3px_0px_#000] transition-all ${selectedId===item.id?'bg-black text-white translate-x-[-1px] translate-y-[-1px] shadow-[4px_4px_0px_#000]':'bg-white hover:translate-x-[-1px] hover:translate-y-[-1px]'}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-xs truncate">{item.title}</div>
                    <div className="text-[10px] opacity-60 mt-1 truncate">{item.content.slice(0,60)}</div>
                    <div className="flex gap-1 mt-2">
                      <span className={`text-[8px] px-2 py-0.5 rounded-full border-2 border-black font-black ${item.category==='code'?'bg-[#040b8d] text-white':item.category==='snippet'?'bg-[#d9ff00] text-black':item.category==='idea'?'bg-[#CDA24D] text-black':'bg-white text-black'}`}>{item.category.toUpperCase()}</span>
                      {item.tags && <span className="text-[8px] opacity-50">{item.tags}</span>}
                    </div>
                  </div>
                  <button onClick={(e)=>{ e.stopPropagation(); setItems(p=>p.filter(x=>x.id!==item.id)) }} className="w-6 h-6 bg-[#ac0001] text-white border-2 border-black rounded-full font-black text-[10px]">X</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT - DETAIL */}
        <div className="lg:col-span-7">
          <div className="bg-white border-[3px] border-black p-6 shadow-[6px_6px_0px_#000] rounded-[16px] min-h-[600px]">
            {selected ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-1 rounded-full border-2 border-black font-black ${selected.category==='code'?'bg-[#040b8d] text-white':selected.category==='snippet'?'bg-[#d9ff00] text-black':selected.category==='idea'?'bg-[#CDA24D] text-black':'bg-white text-black'}`}>{selected.category.toUpperCase()}</span>
                      <span className="text-[10px] font-mono opacity-60">{new Date(selected.createdAt).toLocaleString('cs-CZ')}</span>
                    </div>
                    <h2 className="font-black text-xl mt-3">{selected.title}</h2>
                    {selected.tags && <div className="text-[10px] opacity-50 mt-1">#{selected.tags}</div>}
                  </div>
                </div>
                <div className="bg-[#f5f5f0] border-2 border-black p-4 rounded-[12px] min-h-[300px] whitespace-pre-wrap font-mono text-sm">{selected.content || 'bez obsahu'}</div>
                <div className="flex gap-2">
                  <button onClick={()=>{ navigator.clipboard.writeText(selected.content) }} className="bg-[#040b8d] text-white px-4 py-2 border-2 border-black rounded-[10px] text-xs font-black shadow-[2px_2px_0px_#000]">COPY</button>
                  <button onClick={()=>setItems(p=>p.filter(x=>x.id!==selected.id))} className="bg-[#ac0001] text-white px-4 py-2 border-2 border-black rounded-[10px] text-xs font-black">SMAZAT</button>
                </div>
              </div>
            ) : (
              <div className="h-[500px] flex flex-col items-center justify-center opacity-30">
                <div className="text-6xl mb-4">📚</div>
                <div className="font-black text-sm">Vyber záznam vlevo</div>
                <div className="text-xs mt-2">nebo přidej nový přes +</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
