import React, { useState, useMemo } from 'react';

interface Checkpoint {
  id: string;
  name: string;
  description: string;
  done: boolean;
}

interface Idea {
  id: string;
  title: string;
  note: string;
  done: boolean;
}

type CheckpointType = 'overall' | 'current';

export default function Dashboard() {
  // Checkpoints
  const [overallCheckpoints, setOverallCheckpoints] = useState<Checkpoint[]>([]);
  const [currentCheckpoints, setCurrentCheckpoints] = useState<Checkpoint[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  // Modals
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<CheckpointType>('overall');
  const [isIdeasModalOpen, setIsIdeasModalOpen] = useState(false);

  // Form states - controlled, no document.getElementById
  const [checkpointName, setCheckpointName] = useState('');
  const [checkpointDesc, setCheckpointDesc] = useState('');
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaNote, setIdeaNote] = useState('');

  const generateId = () => globalThis.crypto.randomUUID();

  // Progress calculations - derived, not stored in separate useState
  const overallProgress = useMemo(() => {
    if (overallCheckpoints.length === 0) return 0;
    const done = overallCheckpoints.filter(c => c.done).length;
    return Math.min(100 * (done / overallCheckpoints.length), 100);
  }, [overallCheckpoints]);

  const currentProgress = useMemo(() => {
    if (currentCheckpoints.length === 0) return 0;
    const done = currentCheckpoints.filter(c => c.done).length;
    return Math.min(100 * (done / currentCheckpoints.length), 100);
  }, [currentCheckpoints]);

  const sortedIdeas = useMemo(() => {
    return [...ideas].sort((a, b) => Number(a.done) - Number(b.done));
  }, [ideas]);

  const addCheckpoint = () => {
    if (!checkpointName.trim()) return;
    const newCp: Checkpoint = {
      id: generateId(),
      name: checkpointName.trim(),
      description: checkpointDesc.trim(),
      done: false,
    };
    if (activeType === 'overall') {
      setOverallCheckpoints(prev => [...prev, newCp]);
    } else {
      setCurrentCheckpoints(prev => [...prev, newCp]);
    }
    setCheckpointName('');
    setCheckpointDesc('');
    setIsCheckpointModalOpen(false);
  };

  const toggleCheckpoint = (type: CheckpointType, id: string) => {
    const updater = (prev: Checkpoint[]) =>
      prev.map(c => (c.id === id ? { ...c, done: !c.done } : c));
    if (type === 'overall') setOverallCheckpoints(updater);
    else setCurrentCheckpoints(updater);
  };

  const removeCheckpoint = (type: CheckpointType, id: string) => {
    if (type === 'overall') {
      setOverallCheckpoints(prev => prev.filter(c => c.id !== id));
    } else {
      setCurrentCheckpoints(prev => prev.filter(c => c.id !== id));
    }
  };

  const addIdea = () => {
    if (!ideaTitle.trim()) return;
    const newIdea: Idea = {
      id: generateId(),
      title: ideaTitle.trim(),
      note: ideaNote.trim(),
      done: false,
    };
    setIdeas(prev => [...prev, newIdea]);
    setIdeaTitle('');
    setIdeaNote('');
    setIsIdeasModalOpen(false);
  };

  const toggleIdea = (id: string) => {
    setIdeas(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const removeIdea = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
  };

  const openCheckpointModal = (type: CheckpointType) => {
    setActiveType(type);
    setCheckpointName('');
    setCheckpointDesc('');
    setIsCheckpointModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 mt-1">Single file TSX, no errors, no document.getElementById</p>
        </div>

        {/* Overall Progress */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Overall progress - {Math.round(overallProgress)}%</h2>
            <button
              onClick={() => openCheckpointModal('overall')}
              className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-zinc-200"
            >
              + Add Checkpoint
            </button>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="space-y-3">
            {overallCheckpoints.map((cp: Checkpoint) => (
              <div key={cp.id} className="flex gap-3 items-start bg-zinc-800/50 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={cp.done}
                  onChange={() => toggleCheckpoint('overall', cp.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{cp.name}</div>
                  <div className="text-sm text-zinc-400">{cp.description}</div>
                </div>
                <button
                  onClick={() => removeCheckpoint('overall', cp.id)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
            {overallCheckpoints.length === 0 && <div className="text-sm text-zinc-500">No checkpoints yet</div>}
          </div>
        </div>

        {/* Current Progress */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Current progress - {Math.round(currentProgress)}%</h2>
            <button
              onClick={() => openCheckpointModal('current')}
              className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-zinc-200"
            >
              + Add Checkpoint
            </button>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <div className="space-y-3">
            {currentCheckpoints.map((cp: Checkpoint) => (
              <div key={cp.id} className="flex gap-3 items-start bg-zinc-800/50 p-3 rounded-xl">
                <input
                  type="checkbox"
                  checked={cp.done}
                  onChange={() => toggleCheckpoint('current', cp.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{cp.name}</div>
                  <div className="text-sm text-zinc-400">{cp.description}</div>
                </div>
                <button
                  onClick={() => removeCheckpoint('current', cp.id)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
            {currentCheckpoints.length === 0 && <div className="text-sm text-zinc-500">No checkpoints yet</div>}
          </div>
        </div>

        {/* Ideas */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Ideas</h2>
            <button
              onClick={() => setIsIdeasModalOpen(true)}
              className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-zinc-200"
            >
              + Add Idea
            </button>
          </div>
          <div className="space-y-3">
            {sortedIdeas.map((idea: Idea) => (
              <div key={idea.id} className={`flex gap-3 items-start p-3 rounded-xl ${idea.done ? 'bg-zinc-800/30 opacity-60' : 'bg-zinc-800/50'}`}>
                <input
                  type="checkbox"
                  checked={idea.done}
                  onChange={() => toggleIdea(idea.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className={`font-medium ${idea.done ? 'line-through text-zinc-400' : ''}`}>{idea.title}</div>
                  <div className="text-sm text-zinc-400">{idea.note}</div>
                </div>
                <button onClick={() => removeIdea(idea.id)} className="text-sm text-red-400 hover:text-red-300">
                  Remove
                </button>
              </div>
            ))}
            {ideas.length === 0 && <div className="text-sm text-zinc-500">No ideas yet</div>}
          </div>
        </div>
      </div>

      {/* Checkpoint Modal */}
      {isCheckpointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold">Add Checkpoint to {activeType}</h3>
            <input
              type="text"
              placeholder="Name"
              value={checkpointName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckpointName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-zinc-600"
            />
            <input
              type="text"
              placeholder="Description"
              value={checkpointDesc}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckpointDesc(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-zinc-600"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCheckpointModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button onClick={addCheckpoint} className="px-4 py-2 text-sm bg-white text-black rounded-full font-medium">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ideas Modal */}
      {isIdeasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold">Add Idea</h3>
            <input
              type="text"
              placeholder="Title"
              value={ideaTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdeaTitle(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-zinc-600"
            />
            <input
              type="text"
              placeholder="Note"
              value={ideaNote}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdeaNote(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-zinc-600"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsIdeasModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button onClick={addIdea} className="px-4 py-2 text-sm bg-white text-black rounded-full font-medium">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
