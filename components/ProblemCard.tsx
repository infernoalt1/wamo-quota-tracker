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
    'Algebra': 'bg-blue-50 text-blue-600 border-blue-100',
    'Geometry': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Combinatorics': 'bg-orange-50 text-orange-600 border-orange-100',
    'Number Theory': 'bg-purple-50 text-purple-600 border-purple-100'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold border border-green-200 shadow-sm">
           <CheckCircle className="w-3 h-3" /> 
           <span>Accepted {roundName ? `in ${roundName}` : ''}</span>
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-white/80 backdrop-blur-xl rounded-[2rem] border transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row shadow-lg hover:shadow-xl hover:shadow-indigo-500/5 ${status === 'accepted' ? 'border-green-200 ring-4 ring-green-50' : 'border-white hover:border-indigo-100'}`}
    >
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-6 border-b md:border-b-0 md:border-r border-slate-100 min-w-[90px] gap-2 bg-slate-50/50">
         <motion.button 
            whileTap={{ scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); onUpvote(problem.id); }}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center gap-1 transition-all duration-300 p-2 rounded-xl ${
               hasVoted 
                 ? 'text-indigo-600 bg-indigo-50 shadow-inner' 
                 : currentUserRole === 'guest' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-500 hover:bg-white'
            }`}
         >
            <ThumbsUp className={`w-6 h-6 ${hasVoted ? 'fill-current' : ''}`} />
         </motion.button>
         <span className={`font-black text-2xl tracking-tight ${score > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
            {score}
         </span>
         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden md:block">Votes</span>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 md:p-8 cursor-pointer" onClick={toggleExpand}>
            <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">
                            <MathText text={problem.title} />
                        </h3>
                        <StatusBadge />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {/* Admin Status Controls */}
                        {isAdmin && onStatusChange && (
                            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 mr-2 gap-1" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'pending')} 
                                    className={`p-1.5 rounded transition-all ${status === 'pending' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {status === 'approved' ? <RotateCcw className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'accepted')} 
                                    className={`p-1.5 rounded transition-all ${status === 'accepted' ? 'bg-green-100 text-green-600 shadow-sm' : 'text-slate-400 hover:text-green-600'}`}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {canEdit && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                                className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}

                        <button className="text-slate-400 hover:text-slate-600 p-1">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                {showAuthor ? (
                    <span className="font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">
                        By {problem.authorName}
                    </span>
                ) : (
                    <span className="font-medium italic flex items-center gap-1 text-slate-400">
                        <MoreHorizontal className="w-3 h-3" /> Blind Review
                    </span>
                )}
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-slate-600 border border-slate-200">
                    <Target className="w-3 h-3" />
                    Diff: <span className="font-bold text-slate-900">{problem.difficulty}</span>
                </span>
                <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(problem.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                    <MessageSquare className="w-3 h-3" /> {problem.commentCount || 0}
                </span>
                </div>
            </div>
            </div>
            
            {/* Topics */}
            <div className="flex flex-wrap gap-2 mb-6">
                {problem.topics && problem.topics.map(t => (
                    <span key={t} className={`text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border ${topicColors[t] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {t}
                    </span>
                ))}
            </div>

            <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100/50">
                 <MathText 
                    text={problem.statement} 
                    className={`font-serif text-slate-800 text-lg leading-relaxed whitespace-pre-wrap ${!isExpanded && 'line-clamp-3'}`} 
                />
            </div>
            
            {problem.imageData && (
            <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                <img src={problem.imageData} alt="Problem attachment" className="max-h-96 w-auto mx-auto object-contain mix-blend-multiply" />
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
                className="border-t border-slate-100 p-6 md:p-8 bg-slate-50/30"
            >
                 <div className="grid md:grid-cols-2 gap-8 mb-8">
                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Solution Outline</h4>
                         {problem.solution ? (
                             <MathText text={problem.solution} className="text-slate-600 text-sm whitespace-pre-wrap font-serif" />
                         ) : (
                             <div className="text-slate-400 italic text-sm">No solution provided.</div>
                         )}
                     </div>
                     <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 h-fit">
                         <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Answer Key</h4>
                         <div className="text-indigo-900 font-bold font-mono text-xl">
                             {problem.answerKey || <span className="text-indigo-300 font-normal italic text-sm">None</span>}
                         </div>
                     </div>
                 </div>

                 {/* Comments */}
                 <div className="border-t border-slate-200 pt-6">
                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                         <MessageSquare className="w-4 h-4" /> Discussion
                     </h4>
                     
                     <div className="space-y-6 mb-8">
                         {loadingComments ? (
                             <div className="text-slate-400 text-sm italic">Loading comments...</div>
                         ) : comments.length === 0 ? (
                             <div className="text-slate-400 text-sm italic">No comments yet.</div>
                         ) : (
                             comments.map(c => (
                                 <div key={c.id} className="flex gap-4">
                                     <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 border border-slate-200 shadow-sm">
                                         {c.userName.charAt(0)}
                                     </div>
                                     <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 text-sm max-w-2xl shadow-sm">
                                         <div className="flex items-center gap-2 mb-2">
                                             <span className="font-bold text-slate-800">{c.userName}</span>
                                             <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                         </div>
                                         <p className="text-slate-600 leading-relaxed">{c.text}</p>
                                     </div>
                                 </div>
                             ))
                         )}
                     </div>

                     {currentUserRole !== 'guest' && (
                        <div className="flex gap-2 items-end bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                            <textarea 
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Add a comment..." 
                                className="flex-1 bg-transparent border-none rounded-xl p-3 text-sm focus:ring-0 outline-none resize-none h-12 text-slate-700 placeholder-slate-400"
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                            />
                            <Button size="sm" onClick={postComment} disabled={!newComment.trim()}>
                                <Send className="w-4 h-4" />
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