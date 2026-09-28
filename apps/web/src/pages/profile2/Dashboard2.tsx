import React, { useState, useMemo, useEffect } from 'react';
import { categoryColors, categoryNumbers } from '../../styles/theme';

const DASHBOARD_COLOR = categoryColors.dashboard
const DASHBOARD_NUM = categoryNumbers.dashboard

type Idea = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

type Project = {
  id: number;
  title: string;
  status: 'todo' | 'doing' | 'done';
}

const STORAGE_KEYS = {
  ideas: 'loyo-dashboard2-ideas',
  projects: 'loyo-dashboard2-projects',
  progress: 'loyo-dashboard2-progress'
}

export default function Dashboard2() {
  // --- LoYo OS progress 0-60, 12 splněno ---
  const [completedIds, setCompletedIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.progress);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [1,2,3,4,5,6,7,8,9,10,11,12];
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(completedIds)); } catch {}
  }, [completedIds]);

  const toggleSquare = (id: number) => {
    setCompletedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const overallDone = completedIds.length;
  const overallTotal = 60;
  const overallProgress = Math.round((overallDone/overallTotal)*100);

  // --- Nápady ---
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ideas);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      { id: 1, title: 'Přidat coding notes do P2', content: 'Propojit ja/coding s dashboard2', createdAt: new Date().toISOString() },
      { id: 2, title: 'RAG pro agenty', content: 'RAG/agents/{id} struktura', createdAt: new Date().toISOString() }
    ];
  });
  const [ideaName, setIdeaName] = useState('');
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.ideas, JSON.stringify(ideas)); } catch {}
  }, [ideas]);

  useEffect(() => {
    const sel = ideas.find(i => i.id === selectedIdeaId);
    if (sel) {
      setEditTitle(sel.title);
      setEditContent(sel.content);
    }
  }, [selectedIdeaId, ideas]);

  const handleAddIdea = () => {
    const t = ideaName.trim();
    if (!t) return;
    const newIdea: Idea = { id: Date.now(), title: t, content: '', createdAt: new Date().toISOString() };
    setIdeas(prev => [newIdea, ...prev]);
    setIdeaName('');
    setSelectedIdeaId(newIdea.id);
  };

  const handleSaveIdea = () => {
    if (selectedIdeaId === null) return;
    setIdeas(prev => prev.map(i => i.id === selectedIdeaId ? { ...i, title: editTitle.trim() || 'Bez názvu', content: editContent } : i));
  };

  const handleDeleteIdea = (id: number) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
    if (selectedIdeaId === id) setSelectedIdeaId(null);
  };

  const selectedIdea = ideas.find(i => i.id === selectedIdeaId);

  // --- Rozdělané projekty ---
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.projects);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      { id: 101, title: 'LoYo OS v6.0 - profil přepínání', status: 'doing' },
      { id: 102, title: 'Dashboard2 + codingNotes', status: 'doing' },
      { id: 103, title: 'RAG složka', status: 'todo' }
    ];
  });
  const [newProjectTitle, setNewProjectTitle] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects)); } catch {}
  }, [projects]);

  const handleAddProject = () => {
    const t = newProjectTitle.trim() || `Projekt ${projects.length + 1}`;
    const p: Project = { id: Date.now(), title: t, status: 'doing' };
    setProjects(prev => [p, ...prev]);
    setNewProjectTitle('');
  };

  return (
    <div className="min-h-full bg-[#ededed] text-black p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEVÝ SLOUPEC - LoYo OS Progress */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#040b8d] border-2 border-black p-5 text-white border-l-4" style={{ borderLeftColor: DASHBOARD_COLOR }}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white text-black">{DASHBOARD_NUM}-DASH2</span>
              <span className="w-2 h-2 rounded-full" style={{ background: DASHBOARD_COLOR }} />
              <span className="text-[11px] tracking-widest opacity-60">LOYO OS PROGRESS • {DASHBOARD_COLOR}</span>
            </div>
            <h2 className="font-black text-lg mt-2 tracking-tight">LoYo OS progress : {overallDone} / {overallTotal} • {overallProgress}%</h2>
            <div className="mt-3 w-full h-2 bg-[#dbdbdb] border border-white">
              <div className="h-full bg-[#CDA24D] transition-all" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>

          <div className="bg-[#dbdbdb] border-2 border-black p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-xs tracking-widest">0 - 60 • ČTVEREČKY • KLIK = SPLNĚNO</h3>
              <span className="text-[10px] font-bold bg-black text-white px-2 py-1">{overallDone} / 60 HOTOVO</span>
            </div>
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: 60 }, (_, i) => {
                const id = i + 1;
                const done = completedIds.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSquare(id)}
                    className={`aspect-square border-2 border-black flex items-center justify-center text-[10px] font-black transition-all
                      ${done ? 'bg-[#040b8d] text-white hover:bg-black' : 'bg-white hover:bg-[#CDA24D] text-black'}`}
                    title={`#${id} ${done ? 'hotovo' : 'todo'}`}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 bg-black text-[#ededed] p-2 text-[10px] font-mono flex gap-4">
              <span>MODRÁ = HOTOVO (12 z 60)</span>
              <span>BÍLÁ = TODO</span>
              <span className="ml-auto">KLIK přepíná stav</span>
            </div>
          </div>
        </div>

        {/* PRAVÝ SLOUPEC - Nápady + Rozdělané projekty */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* NÁPADY */}
          <div className="bg-white border-2 border-black p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-xs tracking-[0.2em]">NÁPADY • {ideas.length}</h3>
              <span className="text-[10px] opacity-50">NÁZEV + OK = PŘIDAT</span>
            </div>
            
            {/* Input řádek */}
            <div className="flex gap-2 mb-4">
              <input
                value={ideaName}
                onChange={e => setIdeaName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddIdea()}
                placeholder="Název nápadu..."
                className="flex-1 bg-[#ededed] border-2 border-black px-3 py-2 text-xs outline-none focus:bg-white"
              />
              <button
                onClick={handleAddIdea}
                className="bg-black text-white px-5 py-2 text-xs font-black tracking-widest border-2 border-black hover:bg-[#040b8d]"
              >
                OK
              </button>
            </div>

            {/* Seznam */}
            <div className="max-h-[260px] overflow-auto border border-black/10 divide-y divide-black/10 bg-[#F8F6F1]">
              {ideas.length === 0 ? (
                <div className="p-6 text-center text-xs opacity-40">Žádné nápady - přidej první</div>
              ) : ideas.map(idea => {
                const active = idea.id === selectedIdeaId;
                return (
                  <div
                    key={idea.id}
                    onClick={() => setSelectedIdeaId(idea.id)}
                    className={`p-3 cursor-pointer flex justify-between gap-2 border-l-4 ${active ? 'bg-black text-white' : 'bg-white hover:bg-[#ededed]'}`}
                    style={{ borderLeftColor: active ? '#CDA24D' : DASHBOARD_COLOR }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{idea.title}</div>
                      <div className={`text-[10px] truncate ${active ? 'text-white/60' : 'opacity-60'}`}>{idea.content.slice(0,60) || 'bez popisu'}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteIdea(idea.id); }}
                      className={`text-[10px] px-2 py-1 h-fit ${active ? 'bg-white text-black' : 'bg-black text-white'}`}
                    >
                      X
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Detail + editace */}
            {selectedIdea && (
              <div className="mt-4 bg-[#ededed] border-2 border-black p-3 space-y-3">
                <div className="text-[10px] font-black tracking-widest opacity-60">DETAIL • EDITACE</div>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-white border border-black px-3 py-2 text-xs font-bold outline-none"
                  placeholder="Název"
                />
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="Popis nápadu, poznámky, co s tím..."
                  className="w-full bg-white border border-black px-3 py-2 text-xs min-h-[100px] outline-none resize-none font-mono"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveIdea}
                    className="bg-[#040b8d] text-white px-6 py-2 text-xs font-black tracking-widest border-2 border-black hover:bg-black"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ROZDĚLANÉ PROJEKTY */}
          <div className="bg-[#dbdbdb] border-2 border-black p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-black text-xs tracking-[0.2em]">ROZDĚLANÉ PROJEKTY • {projects.length}</h3>
              <button
                onClick={handleAddProject}
                className="bg-black text-white w-7 h-7 flex items-center justify-center text-sm font-black border-2 border-black hover:bg-[#040b8d]"
                title="Přidat projekt"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                value={newProjectTitle}
                onChange={e => setNewProjectTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddProject()}
                placeholder="Nový projekt..."
                className="flex-1 bg-white border border-black px-3 py-2 text-xs outline-none"
              />
              <button onClick={handleAddProject} className="bg-[#CDA24D] border-2 border-black px-3 text-xs font-black">+</button>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-auto">
              {projects.map(p => (
                <div key={p.id} className="bg-white border-2 border-black p-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-xs">#{p.id.toString().slice(-4)} {p.title}</div>
                    <div className="text-[10px] mt-1 flex gap-2">
                      <span className={`px-2 py-0.5 border border-black font-bold ${p.status==='doing' ? 'bg-[#CDA24D]' : p.status==='done' ? 'bg-black text-white' : 'bg-white'}`}>{p.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setProjects(prev => prev.map(x=>x.id===p.id?{...x, status: x.status==='doing'?'done':'doing'}:x))} className="text-[10px] px-2 py-1 bg-[#ededed] border border-black">TOGGLE</button>
                    <button onClick={() => setProjects(prev => prev.filter(x=>x.id!==p.id))} className="text-[10px] px-2 py-1 bg-[#ac0001] text-white border border-black">X</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
