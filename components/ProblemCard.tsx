import React, { useState } from 'react';
import { Problem, ProblemStatus, Comment } from '../types';
import { MoreHorizontal, Calendar, ThumbsUp, Target, Pencil, CheckCircle, AlertCircle, Image as ImageIcon, MessageSquare, ChevronDown, ChevronUp, Send, RotateCcw } from 'lucide-react';
import { MathText } from './MathText';
import { Button } from './Button';
import { api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';

interface ProblemCardProps {
  problem: Problem;
  roundName?: string;
  showAuthor?: boolean;
  currentUserId: string;
  currentUserRole: string;
  onUpvote: (problemId: string) => void;
  onEdit: (problem: Problem) => void;
  onStatusChange?: (problemId: string, status: ProblemStatus) => void;
  votingPower: number;
  defaultExpanded?: boolean;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({ 
  problem, 
  roundName,
  showAuthor = false, 
  currentUserId,
  currentUserRole,
  onUpvote,
  onEdit,
  onStatusChange,
  votingPower,
  defaultExpanded = false
}) => {
  const hasVoted = problem.votedBy?.includes(currentUserId);
  const score = problem.score || 0;
  const status = problem.status || 'pending';
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'director';
  const canEdit = isAdmin || problem.authorId === currentUserId;

  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-50 text-blue-700 border-blue-200',
    'Geometry': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Combinatorics': 'bg-orange-50 text-orange-700 border-orange-200',
    'Number Theory': 'bg-purple-50 text-purple-700 border-purple-200'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200">
           <CheckCircle className="w-3 h-3" /> 
           <span>{roundName ? roundName : 'Accepted'}</span>
        </span>
      );
    }
    return null; 
  };

  const toggleExpand = async () => {
      const nextState = !isExpanded;
      setIsExpanded(nextState);
      if (nextState && comments.length === 0) {
          setLoadingComments(true);
          try {
              const c = await api.getComments(problem.id);
              setComments(c);
          } catch(e) {
              console.error(e);
          } finally {
              setLoadingComments(false);
          }
      }
  };

  const postComment = async () => {
      if (!newComment.trim()) return;
      try {
          const c = await api.postComment(problem.id, newComment);
          setComments([...comments, { ...c, userName: 'Me' }]); 
          setNewComment('');
      } catch(e) {
          console.error(e);
      }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-white rounded-xl border transition-all duration-200 relative flex flex-col shadow-sm hover:shadow-md ${status === 'accepted' ? 'border-green-200/60 ring-1 ring-green-50' : 'border-slate-200 hover:border-indigo-200'}`}
    >
      
      <div className="flex flex-row items-stretch">
        {/* Vote Sidebar - Slim & High Density */}
        <div className="flex flex-col items-center p-3 border-r border-slate-100 bg-slate-50/50 w-16 gap-1 shrink-0">
           <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onUpvote(problem.id); }}
              disabled={currentUserRole === 'guest'}
              className={`flex flex-col items-center justify-center gap-0.5 w-10 h-10 rounded-lg transition-colors ${
                 hasVoted 
                   ? 'text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100' 
                   : currentUserRole === 'guest' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm'
              }`}
           >
              <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />
           </motion.button>
           <span className={`font-bold text-sm tabular-nums tracking-tight ${score > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
              {score}
           </span>
        </div>

        <div className="flex-1 min-w-0">
            {/* Header / Meta */}
            <div className="p-4 cursor-pointer" onClick={toggleExpand}>
                <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900 leading-snug tracking-tight truncate pr-2">
                                <MathText text={problem.title} />
                            </h3>
                            <StatusBadge />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium">
                            {showAuthor ? (
                                <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                    {problem.authorName}
                                </span>
                            ) : (
                                <span className="italic flex items-center gap-1 text-slate-400">
                                    Blind
                                </span>
                            )}
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                <Target className="w-3 h-3 text-slate-400" />
                                <span className="font-bold text-slate-700">{problem.difficulty}</span>
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {new Date(problem.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                                <MessageSquare className="w-3 h-3" /> {problem.commentCount || 0}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {/* Topics */}
                        <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[150px]">
                            {problem.topics && problem.topics.slice(0, 2).map(t => (
                                <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${topicColors[t] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {t.substring(0, 3)}
                                </span>
                            ))}
                            {problem.topics && problem.topics.length > 2 && <span className="text-[9px] text-slate-400">+{problem.topics.length - 2}</span>}
                        </div>
                        
                        {/* Admin Controls */}
                        {isAdmin && onStatusChange && (
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md p-0.5 gap-0.5 ml-2" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'pending')} 
                                    className={`p-1 rounded hover:bg-white hover:shadow-sm ${status === 'pending' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}
                                >
                                    {status === 'approved' ? <RotateCcw className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                </button>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'accepted')} 
                                    className={`p-1 rounded hover:bg-white hover:shadow-sm ${status === 'accepted' ? 'bg-green-50 text-green-600' : 'text-slate-400 hover:text-green-600'}`}
                                >
                                    <CheckCircle className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        {canEdit && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors ml-1"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        )}
                         
                         <div className="pl-1 border-l border-slate-100 ml-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                         </div>
                    </div>
                </div>

                {/* Statement Preview */}
                <div className="mt-3">
                     <MathText 
                        text={problem.statement} 
                        className={`font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap ${!isExpanded && 'line-clamp-2 text-slate-600'}`} 
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Expanded Content - High Density Layout */}
      <AnimatePresence>
        {isExpanded && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-slate-100 bg-slate-50/30"
            >
                 <div className="p-5 grid gap-5">
                    {/* Image */}
                    {problem.imageData && (
                        <div className="rounded-lg overflow-hidden border border-slate-200 bg-white p-2">
                            <img src={problem.imageData} alt="Problem attachment" className="max-h-64 w-auto mx-auto object-contain" />
                        </div>
                    )}

                    {/* All Topics (if hidden above) */}
                    <div className="flex flex-wrap gap-1.5">
                        {problem.topics && problem.topics.map(t => (
                            <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${topicColors[t] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {t}
                            </span>
                        ))}
                    </div>

                     <div className="grid md:grid-cols-2 gap-4">
                         <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                             <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Solution Outline</h4>
                             {problem.solution ? (
                                 <MathText text={problem.solution} className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap font-serif" />
                             ) : (
                                 <div className="text-slate-400 italic text-xs">No solution provided.</div>
                             )}
                         </div>
                         <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 h-fit">
                             <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Answer Key</h4>
                             <div className="text-indigo-900 font-bold font-mono text-base">
                                 {problem.answerKey || <span className="text-indigo-300 font-normal italic text-xs">None</span>}
                             </div>
                         </div>
                     </div>

                     {/* Comments */}
                     <div className="pt-2">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                             <MessageSquare className="w-3 h-3" /> Discussion
                         </h4>
                         
                         <div className="space-y-3 mb-4 pl-1">
                             {loadingComments ? (
                                 <div className="text-slate-400 text-xs italic">Loading...</div>
                             ) : comments.length === 0 ? (
                                 <div className="text-slate-400 text-xs italic">No comments yet.</div>
                             ) : (
                                 comments.map(c => (
                                     <div key={c.id} className="flex gap-3 items-start">
                                         <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-slate-500 font-bold text-[10px] shrink-0 border border-slate-200 select-none">
                                             {c.userName.charAt(0)}
                                         </div>
                                         <div className="flex-1">
                                             <div className="flex items-baseline gap-2">
                                                 <span className="font-bold text-slate-800 text-xs">{c.userName}</span>
                                                 <span className="text-[9px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                             </div>
                                             <p className="text-slate-600 text-xs mt-0.5 leading-relaxed bg-white p-2 rounded border border-slate-100 inline-block">{c.text}</p>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>

                         {currentUserRole !== 'guest' && (
                            <div className="flex gap-2 items-center">
                                <input 
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    placeholder="Add a comment..." 
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 placeholder-slate-400"
                                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                                />
                                <Button size="sm" onClick={postComment} disabled={!newComment.trim()} className="h-8 w-8 p-0 flex items-center justify-center rounded-lg">
                                    <Send className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                         )}
                     </div>
                 </div>
            </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};