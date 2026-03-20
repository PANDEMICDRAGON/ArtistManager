import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  BrainCircuit, 
  Megaphone, 
  Briefcase, 
  CheckCircle2, 
  Plus,
  Loader2,
  ChevronRight,
  MessageSquare,
  Music
} from 'lucide-react';
import { generateAIStrategy, chatWithManager, AIStrategy } from '../services/aiManagerService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AIManagerProps {
  project: any;
  tasks: any[];
  assets: any[];
  onAddTask: (task: { title: string; description: string; category: string }) => Promise<void>;
}

export const AIManager: React.FC<AIManagerProps> = ({ project, tasks, assets, onAddTask }) => {
  const [strategy, setStrategy] = useState<AIStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'strategy' | 'chat'>('strategy');

  const handleGenerateStrategy = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const data = await generateAIStrategy({ project, tasks, assets });
      setStrategy(data);
    } catch (error) {
      console.error("Failed to generate AI strategy", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading || !project) return;

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await chatWithManager(userMsg, { project, tasks, assets, strategy });
      setChatHistory(prev => [...prev, { role: 'ai', text: response || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("Chat failed", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (project && !strategy) {
      handleGenerateStrategy();
    }
  }, [project?.id]);

  if (!project) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center text-center space-y-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-12">
        <div className="w-20 h-20 bg-zinc-800 text-zinc-500 rounded-3xl flex items-center justify-center">
          <Music size={40} />
        </div>
        <div>
          <h3 className="text-xl font-bold">No Project Selected</h3>
          <p className="text-zinc-500 max-w-xs mx-auto">Please select a project from the sidebar to access your AI Manager's business suite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">AI Manager</h3>
            <p className="text-xs text-zinc-500 font-medium">A&R, PR & Business Suite</p>
          </div>
        </div>
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button 
            onClick={() => setActiveSection('strategy')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              activeSection === 'strategy' ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Strategy
          </button>
          <button 
            onClick={() => setActiveSection('chat')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              activeSection === 'chat' ? "bg-zinc-100 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Chat
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'strategy' ? (
          <motion.div 
            key="strategy"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {loading ? (
              <div className="col-span-full py-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-indigo-400" size={40} />
                <p className="text-zinc-500 font-medium">Analyzing project data & market trends...</p>
              </div>
            ) : strategy ? (
              <>
                <div className="lg:col-span-2 space-y-8">
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <BrainCircuit size={18} />
                      <h4 className="text-sm font-bold uppercase tracking-widest">A&R Analysis</h4>
                    </div>
                    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 leading-relaxed text-zinc-300">
                      {strategy.arFeedback}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Megaphone size={18} />
                      <h4 className="text-sm font-bold uppercase tracking-widest">PR & Marketing</h4>
                    </div>
                    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 leading-relaxed text-zinc-300">
                      {strategy.prPlan}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Briefcase size={18} />
                      <h4 className="text-sm font-bold uppercase tracking-widest">Business Strategy</h4>
                    </div>
                    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 leading-relaxed text-zinc-300">
                      {strategy.businessAdvice}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6">
                    <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">Manager's Summary</h4>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {strategy.summary}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Suggested Actions</h4>
                    <div className="space-y-3">
                      {strategy.suggestedTasks.map((task, idx) => (
                        <div 
                          key={idx}
                          className="group p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-indigo-500/50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-zinc-100">{task.title}</p>
                              <p className="text-[10px] text-zinc-500 mt-1">{task.description}</p>
                              <span className="inline-block mt-2 px-1.5 py-0.5 bg-zinc-800 text-[8px] font-bold uppercase tracking-wider rounded text-zinc-400">
                                {task.category}
                              </span>
                            </div>
                            <button 
                              onClick={() => onAddTask(task)}
                              className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-full py-24 text-center">
                <button 
                  onClick={handleGenerateStrategy}
                  className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all"
                >
                  Generate Management Strategy
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col h-[600px] bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 px-12">
                  <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center">
                    <MessageSquare size={32} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">Consult your AI Manager</h4>
                    <p className="text-sm text-zinc-500">Ask about contract terms, marketing ideas, or A&R feedback on your latest demo.</p>
                  </div>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-indigo-500 text-white rounded-tr-none" 
                      : "bg-zinc-800 text-zinc-100 rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">
                    {msg.role === 'user' ? 'You' : 'AI Manager'}
                  </span>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex items-start gap-3">
                  <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-none">
                    <Loader2 className="animate-spin text-indigo-400" size={16} />
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="p-4 bg-zinc-900 border-t border-zinc-800 flex gap-3">
              <input 
                type="text" 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask your manager anything..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button 
                type="submit"
                disabled={!chatMessage.trim() || isChatLoading}
                className="w-12 h-12 bg-indigo-500 text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 transition-all disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
