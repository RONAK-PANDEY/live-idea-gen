/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Zap, RefreshCw, AlertCircle, Wifi, Search, Plus, Hash, BarChart3, Settings, X, ExternalLink, Copy, Check } from 'lucide-react';
import { AppIdea, Category } from './types';
import { EXTENDED_CATEGORIES } from './categories';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const FALLBACK_IDEAS: Record<string, AppIdea[]> = {
  'Tech Gadgets': [
    { title: "Focus Smart-Ring", trend: "Wearables for ADHD/Focus", description: "A minimalist ring that tracks physiological states related to distress and vibrates softly to ground the user.", velocity: 88 },
    { title: "Local-LLM Hardware Companion", trend: "Privacy-first AI", description: "A pocket-sized device running an offline LLaMA model for secure voice queries.", velocity: 95 }
  ],
  'Startup Ideas': [
    { title: "AI Compliance Officer", trend: "Regulations growing for LLMs", description: "A micro-SaaS that tests enterprise AI deployments against EU AI Act rules and generates audit reports.", velocity: 82 },
    { title: "Automated RFP Writer", trend: "B2B Sales AI", description: "A tool that digests past successful enterprise sales materials to auto-draft complex RFP responses.", velocity: 76 }
  ],
  'Marketing Trends': [
    { title: "B2B Influencer Micro-Networks", trend: "Decline of broad B2B ads", description: "Connecting niche newsletter authors with specialized B2B software for authentic sponsorships.", velocity: 70 },
    { title: "Zero-Click Content Engine", trend: "Platform algorithm shifts", description: "Creating bite-sized value posts that don't require external links, optimizing for platform reach.", velocity: 91 }
  ]
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [ideas, setIdeas] = useState<AppIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'historical' | 'live' | 'cache' | 'fallback' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('userApiKeys');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return ['', '', ''];
  });

  const handleSaveKeys = (newKeys: string[]) => {
    setApiKeys(newKeys);
    localStorage.setItem('userApiKeys', JSON.stringify(newKeys));
    setShowSettings(false);
  };

  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);

  const handleCopy = (idea: AppIdea) => {
    const text = `${idea.title}\n\n${idea.description}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTitle(idea.title);
      setTimeout(() => setCopiedTitle(null), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const filteredCategories = useMemo(() => {
    return EXTENDED_CATEGORIES.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const exactMatch = useMemo(() => {
    return EXTENDED_CATEGORIES.some(c => c.toLowerCase() === searchQuery.toLowerCase());
  }, [searchQuery]);

  const handleGenerate = async (category: Category) => {
    if (apiKeys.filter(k => k.trim() !== '').length === 0) {
      setShowSettings(true);
      return;
    }

    setSelectedCategory(category);
    // Optimistic UI for known fallbacks
    if (FALLBACK_IDEAS[category]) {
      setIdeas(FALLBACK_IDEAS[category]);
      setDataSource('historical');
    } else {
      setIdeas([]);
      setDataSource(null);
    }
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, apiKeys: apiKeys.filter(k => k.trim() !== '') })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch live data');
      }

      setIdeas(data.data);
      // Server reports 'live', 'cache', or 'live (fallback)' when all API keys are
      // overloaded/quota-limited — normalize the latter to a distinct UI state.
      setDataSource(data.source === 'live (fallback)' ? 'fallback' : data.source);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomCategory = () => {
    if (searchQuery.trim() && !exactMatch) {
      handleGenerate(searchQuery.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Live Idea Generator</h1>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center space-x-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-10">
        
        {/* Sidebar Controls */}
        <div className="md:col-span-4 space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">1. Select Target Market</h2>
            
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search categories..."
                className="pl-10 w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white shadow-sm transition-all text-sm outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col" style={{ maxHeight: '350px' }}>
              <div className="overflow-y-auto p-2 space-y-1 flex-1 custom-scrollbar">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all ${
                      selectedCategory === cat 
                      ? 'bg-indigo-50 text-indigo-700 font-medium' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Hash className={`w-4 h-4 mr-3 ${selectedCategory === cat ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="text-sm truncate">{cat}</span>
                  </button>
                ))}
                
                {filteredCategories.length === 0 && !exactMatch && searchQuery.trim() !== '' && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-slate-500 mb-3">No matching categories found.</p>
                    <button
                      onClick={handleCustomCategory}
                      className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg flex justify-center items-center space-x-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="truncate">Add "{searchQuery}"</span>
                    </button>
                  </div>
                )}
                {filteredCategories.length === 0 && searchQuery.trim() === '' && (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No categories available.
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            disabled={!selectedCategory || loading}
            onClick={() => selectedCategory && handleGenerate(selectedCategory)}
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center space-x-2 transition-colors focus:ring-4 focus:ring-indigo-100"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Scanning Live Sources...</span>
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5" />
                <span>Generate Live Ideas</span>
              </>
            )}
          </button>
        </div>

        {/* Results Area */}
        <div className="md:col-span-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 min-h-[500px]">
            {!selectedCategory && !loading && ideas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 pt-20">
                <RefreshCw className="w-12 h-12 text-slate-200" />
                <p>Select or search a category, then scan to generate live ideas.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Header Context */}
                {selectedCategory && (
                  <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                    <div>
                      <h3 className="text-xl font-bold flex items-center space-x-2">
                        <span>{selectedCategory}</span>
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">Synthesized trends from live web data</p>
                    </div>
                    
                    {/* Status Badge */}
                    {dataSource && (
                      <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border
                        ${dataSource === 'live' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                          dataSource === 'cache' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                          dataSource === 'fallback' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'}`}
                      >
                        {dataSource === 'live' ? <Wifi className="w-3.5 h-3.5 mr-1" /> : undefined}
                        <span>
                          {dataSource === 'live' ? 'Fresh Live Synthesis' : 
                          dataSource === 'cache' ? 'Cached Result (Recent)' : 
                          dataSource === 'fallback' ? 'High AI Demand (Fallback)' :
                          'Optimistic Preview (Historical)'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start space-x-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Generation Failed</div>
                      <div>{error}</div>
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {loading && (
                  <div className={`text-white p-4 rounded-xl flex items-center justify-between animate-pulse shadow-sm ${dataSource === 'historical' ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                    <div className="flex items-center space-x-3">
                       <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                       <span className="text-sm font-medium">
                        {dataSource === 'historical' 
                          ? 'Scraping background sources and generating new ideas via AI...'
                          : `Scanning live sources for ${selectedCategory}...`}
                       </span>
                    </div>
                  </div>
                )}

                {/* Ideas Grid */}
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {ideas.map((idea, idx) => (
                      <motion.div
                        key={`${idea.title}-${idx}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: idx * 0.1 }}
                        className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all bg-white relative overflow-hidden group"
                      >
                         <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-200 group-hover:bg-indigo-500 transition-colors"></div>
                         <div className="pl-4">
                            <div className="flex items-start justify-between">
                               <div className="flex-1 pr-4">
                                 <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{idea.title}</h4>
                                 <div className="mt-1 flex items-center space-x-2">
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-500">
                                     Trend
                                   </span>
                                   <span className="text-xs font-medium text-slate-600">
                                     {idea.trend}
                                   </span>
                                 </div>
                               </div>
                               <button
                                 onClick={() => handleCopy(idea)}
                                 className="shrink-0 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100 focus:outline-none"
                                 title="Copy idea"
                               >
                                 {copiedTitle === idea.title ? (
                                   <Check className="w-5 h-5 text-emerald-500" />
                                 ) : (
                                   <Copy className="w-5 h-5" />
                                 )}
                               </button>
                            </div>
                            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                               {idea.description}
                            </p>
                            {idea.velocity !== undefined && (
                               <div className="mt-4 flex items-center">
                                 <div className="text-xs font-semibold text-slate-500 w-24">Velocity: {idea.velocity}/100</div>
                                 <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden ml-2">
                                   <div 
                                     className="h-full rounded-full bg-indigo-500" 
                                     style={{ width: `${idea.velocity}%` }}
                                   />
                                 </div>
                               </div>
                            )}
                         </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {ideas.length > 0 && ideas.some(i => i.velocity !== undefined) && (
                  <div className="mt-10 pt-8 border-t border-slate-100">
                    <h4 className="text-sm font-bold flex items-center space-x-2 text-slate-900 mb-6">
                       <BarChart3 className="w-4 h-4 text-indigo-500" />
                       <span>Trend Velocity Comparison</span>
                    </h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ideas} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis 
                            type="category" 
                            dataKey="title" 
                            width={150} 
                            tick={{ fontSize: 12, fill: '#475569' }} 
                            axisLine={false} 
                            tickLine={false} 
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                          />
                          <Bar dataKey="velocity" radius={[0, 4, 4, 0]} maxBarSize={30}>
                            {
                              ideas.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.velocity && entry.velocity >= 90 ? '#ef4444' : entry.velocity && entry.velocity >= 75 ? '#f59e0b' : '#6366f1'} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                <span>API Settings</span>
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">How to get Gemini API keys:</p>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Go to Google AI Studio.</li>
                  <li>Click <strong>Get API key</strong> in the left navigation.</li>
                  <li>Create a new API key in a new or existing project.</li>
                </ol>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 mt-3 text-blue-600 hover:text-blue-700 font-medium bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors"
                >
                  <span>Open AI Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Your Gemini API Keys</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Please provide your Gemini API key to generate ideas. You can provide up to 3 keys, and the system will automatically retry with the next key if one hits a rate limit.
                </p>
                
                <div className="space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex flex-col space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Key {index + 1}</label>
                      <input 
                        type="password"
                        value={apiKeys[index] || ''}
                        onChange={(e) => {
                          const newKeys = [...apiKeys];
                          newKeys[index] = e.target.value;
                          setApiKeys(newKeys);
                        }}
                        placeholder="AIzaSy..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => handleSaveKeys(apiKeys)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

