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

  // Technical color palette
  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-50 text-blue-700 border-blue-200',
    'Geometry': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Combinatorics': 'bg-amber-50 text-amber-700 border-amber-200',
    'Number Theory': 'bg-violet-50 text-violet-700 border-violet-200'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1.5 bg-white text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 text-[10px] uppercase font-bold tracking-wide shadow-sm">
           <CheckCircle className="w-3 h-3" /> 
           <span>{roundName || 'Accepted'}</span>
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
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-white rounded-lg border transition-all duration-200 overflow-hidden relative flex flex-col md:flex-row shadow-sm hover:shadow-md ${status === 'accepted' ? 'border-emerald-200' : 'border-slate-200 hover:border-slate-300'}`}
    >
      
      {/* Technical Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-3 md:p-4 border-b md:border-b-0 md:border-r border-slate-100 min-w-[70px] gap-1 bg-slate-50/50">
         <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onUpvote(problem.id); }}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center justify-center p-1.5 rounded-md transition-colors ${
               hasVoted 
                 ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' 
                 : currentUserRole === 'guest' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
         >
            <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />
         </motion.button>
         <span className={`font-mono font-bold text-lg tracking-tight ${score > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
            {score}
         </span>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 md:p-5 cursor-pointer" onClick={toggleExpand}>
            <div className="flex justify-between items-start mb-2 gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                        <StatusBadge />
                        <div className="flex gap-1.5">
                            {problem.topics && problem.topics.map(t => (
                                <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${topicColors[t] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight tracking-tight mt-1 flex items-center gap-2">
                        <MathText text={problem.title} />
                    </h3>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                    {/* Admin Status Controls */}
                    {isAdmin && onStatusChange && (
                        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-md p-0.5 mr-2" onClick={e => e.stopPropagation()}>
                            <button 
                                onClick={() => onStatusChange(problem.id, 'pending')} 
                                className={`p-1 rounded transition-all ${status === 'pending' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Set Pending"
                            >
                                {status === 'approved' ? <RotateCcw className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                                onClick={() => onStatusChange(problem.id, 'accepted')} 
                                className={`p-1 rounded transition-all ${status === 'accepted' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-emerald-600'}`}
                                title="Set Accepted"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {canEdit && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-slate-50 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}

                    <button className="text-slate-400 hover:text-slate-600 p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3 font-medium">
                <span className="flex items-center gap-1 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">
                    <Target className="w-3 h-3" />
                    <span>D: <span className="font-bold text-slate-900">{problem.difficulty}</span></span>
                </span>
                
                {showAuthor ? (
                    <span className="text-indigo-600">
                        {problem.authorName}
                    </span>
                ) : (
                    <span className="italic flex items-center gap-1 text-slate-400">
                        <MoreHorizontal className="w-3 h-3" /> Blind
                    </span>
                )}
                
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
                    {new Date(problem.createdAt).toLocaleDateString()}
                </span>
                
                {problem.commentCount ? (
                    <span className="flex items-center gap-1 text-slate-400 ml-auto">
                        <MessageSquare className="w-3 h-3" /> {problem.commentCount}
                    </span>
                ) : null}
            </div>

            <div className="text-sm text-slate-700 leading-relaxed font-serif pl-1 border-l-2 border-slate-200">
                 <MathText 
                    text={problem.statement} 
                    className={`whitespace-pre-wrap ${!isExpanded && 'line-clamp-2'}`} 
                />
            </div>
            
            {problem.imageData && (
            <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 p-2">
                <img src={problem.imageData} alt="Problem attachment" className="max-h-60 w-auto mx-auto object-contain mix-blend-multiply" />
            </div>
            )}
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
        {isExpanded && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="border-t border-slate-100 bg-slate-50/50"
            >
                 <div className="grid md:grid-cols-2 gap-0 border-b border-slate-200">
                     <div className="p-5 border-b md:border-b-0 md:border-r border-slate-200 bg-white">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Pencil className="w-3 h-3"/> Solution Outline</h4>
                         {problem.solution ? (
                             <MathText text={problem.solution} className="text-slate-600 text-xs whitespace-pre-wrap font-serif leading-relaxed" />
                         ) : (
                             <div className="text-slate-400 italic text-xs">No solution provided.</div>
                         )}
                     </div>
                     <div className="p-5 bg-slate-50/30">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Answer Key</h4>
                         <div className="text-slate-900 font-bold font-mono text-sm border border-slate-200 bg-white inline-block px-3 py-1.5 rounded">
                             {problem.answerKey || <span className="text-slate-300 font-normal italic">None</span>}
                         </div>
                     </div>
                 </div>

                 {/* Comments */}
                 <div className="p-5">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <MessageSquare className="w-3 h-3" /> Discussion
                     </h4>
                     
                     <div className="space-y-3 mb-4">
                         {loadingComments ? (
                             <div className="text-slate-400 text-xs italic">Loading...</div>
                         ) : comments.length === 0 ? (
                             <div className="text-slate-400 text-xs italic">No comments yet.</div>
                         ) : (
                             comments.map(c => (
                                 <div key={c.id} className="flex gap-3 items-start group/comment">
                                     <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-slate-500 font-bold text-[10px] shrink-0 border border-slate-200 mt-1">
                                         {c.userName.charAt(0)}
                                     </div>
                                     <div className="flex-1">
                                         <div className="flex items-baseline gap-2">
                                             <span className="font-bold text-slate-700 text-xs">{c.userName}</span>
                                             <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                         </div>
                                         <p className="text-slate-600 text-xs leading-relaxed">{c.text}</p>
                                     </div>
                                 </div>
                             ))
                         )}
                     </div>

                     {currentUserRole !== 'guest' && (
                        <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <input 
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Add a comment..." 
                                className="flex-1 bg-transparent border-none text-xs p-2 focus:ring-0 outline-none text-slate-700 placeholder-slate-400"
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                            />
                            <Button size="sm" variant="ghost" onClick={postComment} disabled={!newComment.trim()} className="h-7 w-7 p-0 rounded-md hover:bg-indigo-50 hover:text-indigo-600">
                                <Send className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                     )}
                 </div>
            </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};