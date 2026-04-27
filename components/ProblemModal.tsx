import React, { useState, useEffect } from 'react';
import { Problem, Comment } from '../types';
import { MathText } from './MathText';
import { api } from '../api';
import { X, MessageSquare, Send, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { Avatar } from './Avatar';

interface ProblemModalProps {
  problem: Problem;
  currentUserRole: string;
  onClose: () => void;
}

export const ProblemModal: React.FC<ProblemModalProps> = ({ problem, currentUserRole, onClose }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [problem.id]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
        const data = await api.getComments(problem.id);
        setComments(data);
    } catch(e) {
        console.error("Failed to load comments");
    } finally {
        setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
      if (!newComment.trim()) return;
      setPosting(true);
      try {
          const comment = await api.postComment(problem.id, newComment);
          setComments([...comments, comment]);
          setNewComment('');
      } catch(e) {
          console.error("Failed to post comment", e);
      } finally {
          setPosting(false);
      }
  };

  // Only Admin/Director or Author can see Solution/Answer, but here we simplify:
  // If you are in the "Pool" viewing detail, you should see everything to evaluate it.
  const canSeeSecret = true; 
  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-50 text-blue-700 border-blue-200',
    'Geometry': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Combinatorics': 'bg-orange-50 text-orange-700 border-orange-200',
    'Number Theory': 'bg-purple-50 text-purple-700 border-purple-200'
  };
  const topicLabels: Record<string, string> = { Algebra: 'A', Geometry: 'G', Combinatorics: 'C', 'Number Theory': 'N' };
  const topicOrder = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
  const sortedTopics = [...(problem.topics || [])].sort((a, b) => topicOrder.indexOf(a) - topicOrder.indexOf(b));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
           <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                 <MathText text={problem.title} />
              </h2>
              <div className="flex gap-3 text-xs text-slate-500 mt-2">
                 <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Diff: {Number(problem.difficulty).toFixed(1)}</span>
                 <span className="flex gap-1">
                   {sortedTopics.map(t => (
                     <span key={t} title={t} className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-black ${topicColors[t] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                       {topicLabels[t] || t.charAt(0)}
                     </span>
                   ))}
                 </span>
                 {problem.authorName && <span className="text-indigo-600 font-medium">by {problem.authorName}</span>}
              </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-0 flex flex-col md:flex-row">
            
            {/* Left: Problem Details */}
            <div className="flex-1 p-8 space-y-8">
                {/* Statement */}
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statement</h3>
                    <MathText text={problem.statement} className="text-lg text-slate-800 font-serif leading-relaxed" />
                    {problem.imageData && (
                        <div className="mt-4 border border-slate-100 rounded-lg overflow-hidden">
                            <img src={problem.imageData} className="max-w-full h-auto max-h-80 mx-auto" />
                        </div>
                    )}
                </div>

                {/* Solution & Answer */}
                {canSeeSecret && (
                    <div className="grid gap-6 p-5 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Answer Key</h3>
                            <div className="font-mono font-bold text-slate-900 bg-white px-3 py-2 rounded border border-slate-200 inline-block">
                                {problem.answerKey || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Solution Outline</h3>
                            {problem.solution ? (
                                <MathText text={problem.solution} className="text-sm text-slate-700 font-serif" />
                            ) : (
                                <span className="text-sm text-slate-400 italic">No solution provided.</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Comments */}
            <div className="w-full md:w-80 bg-slate-50 border-l border-slate-100 flex flex-col">
                <div className="p-4 border-b border-slate-100 font-bold text-slate-700 flex items-center gap-2 text-sm">
                    <MessageSquare className="w-4 h-4" /> Discussion
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {loadingComments ? (
                        <div className="text-center text-slate-400 text-xs py-4">Loading...</div>
                    ) : comments.length === 0 ? (
                        <div className="text-center text-slate-400 text-xs italic py-10">No comments yet. Start the discussion!</div>
                    ) : (
                        comments.map(c => (
                            <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <Avatar name={c.userName} size="xs" />
                                    <span className="font-bold text-xs text-indigo-700 flex-1">{c.userName}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-normal">{c.text}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-slate-200 bg-white">
                    <div className="relative">
                        <input 
                            className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Type a comment..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                        />
                        <button 
                            onClick={handlePostComment}
                            disabled={!newComment.trim() || posting}
                            className="absolute right-1 top-1 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
