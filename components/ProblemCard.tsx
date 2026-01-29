import React, { useState } from 'react';
import { Problem, ProblemStatus, Comment } from '../types';
import { MoreHorizontal, Calendar, ThumbsUp, Target, Pencil, CheckCircle, AlertCircle, Image as ImageIcon, MessageSquare, ChevronDown, ChevronUp, Send, RotateCcw } from 'lucide-react';
import { MathText } from './MathText';
import { Button } from './Button';
import { api } from '../api';
import { motion, AnimatePresence } from 'framer-motion';

interface ProblemCardProps {
  problem: Problem;
  roundName?: string; // New prop for display
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
  
  // Can edit if admin, director or author
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'director';
  const canEdit = isAdmin || problem.authorId === currentUserId;

  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Geometry': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Combinatorics': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Number Theory': 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
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
          setComments([...comments, { ...c, userName: 'Me' }]); // Optimistic / Response
          setNewComment('');
      } catch(e) {
          console.error(e);
      }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005, borderColor: "rgba(255,255,255,0.2)" }}
      transition={{ duration: 0.2 }}
      className={`group bg-white/[0.02] backdrop-blur-md rounded-2xl border transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row ${status === 'accepted' ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' : 'border-white/10'}`}
    >
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-6 border-b md:border-b-0 md:border-r border-white/5 min-w-[90px] gap-2 bg-black/20">
         <button 
            onClick={(e) => { e.stopPropagation(); onUpvote(problem.id); }}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${
               hasVoted 
                 ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' 
                 : currentUserRole === 'guest' ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-600 hover:text-zinc-400 hover:scale-110'
            }`}
            title={currentUserRole === 'guest' ? "Guests cannot vote" : hasVoted ? "Click to remove vote" : `Upvote (Power: ${votingPower})`}
         >
            <ThumbsUp className={`w-6 h-6 ${hasVoted ? 'fill-current' : ''}`} />
         </button>
         <span className={`font-bold text-xl ${score > 0 ? 'text-indigo-300' : 'text-zinc-600'}`}>
            {score}
         </span>
         <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest hidden md:block">Votes</span>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 md:p-8 cursor-pointer" onClick={toggleExpand}>
            <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-zinc-100 leading-tight">
                            <MathText text={problem.title} />
                        </h3>
                        <StatusBadge />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {/* Admin Status Controls */}
                        {isAdmin && onStatusChange && (
                            <div className="flex items-center bg-black/30 border border-white/10 rounded-lg p-1 mr-2 gap-1" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'pending')} 
                                    className={`p-1.5 rounded transition-all ${status === 'pending' ? 'bg-white/10 text-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                                    title={status === 'approved' ? "Return to Waitlist" : "Set Pending"}
                                >
                                    {status === 'approved' ? <RotateCcw className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'accepted')} 
                                    className={`p-1.5 rounded transition-all ${status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'text-zinc-600 hover:text-emerald-400'}`}
                                    title="Accept"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {canEdit && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                                className="text-zinc-500 hover:text-indigo-400 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors"
                                title="Edit Problem"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}

                        <button className="text-zinc-500 hover:text-zinc-300 p-1">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mt-1">
                {showAuthor ? (
                    <span className="font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                        By {problem.authorName}
                    </span>
                ) : (
                    <span className="font-medium italic flex items-center gap-1 text-zinc-600">
                        <MoreHorizontal className="w-3 h-3" /> Blind Review
                    </span>
                )}
                <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-zinc-400 border border-white/5">
                    <Target className="w-3 h-3" />
                    Diff: <span className="font-bold text-zinc-200">{problem.difficulty}</span>
                </span>
                <span className="flex items-center gap-1 text-zinc-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(problem.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-zinc-500">
                    <MessageSquare className="w-3 h-3" /> {problem.commentCount || 0}
                </span>
                </div>
            </div>
            </div>
            
            {/* Topics */}
            <div className="flex flex-wrap gap-2 mb-4">
                {problem.topics && problem.topics.map(t => (
                    <span key={t} className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider border ${topicColors[t] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                        {t}
                    </span>
                ))}
            </div>

            <div className={`text-zinc-300 font-serif text-lg leading-relaxed ${!isExpanded && 'line-clamp-3'}`}>
                <MathText 
                    text={problem.statement} 
                    className="whitespace-pre-wrap"
                />
            </div>
            
            {problem.imageData && (
            <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black/30">
                <img src={problem.imageData} alt="Problem attachment" className="max-h-96 w-auto mx-auto object-contain opacity-90 hover:opacity-100 transition-opacity" />
                <div className="bg-white/5 text-[10px] uppercase tracking-widest text-center text-zinc-500 py-1.5 border-t border-white/5 flex items-center justify-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Attachment
                </div>
            </div>
            )}
        </div>

        {/* Expanded Content: Solution, Answer, Comments */}
        <AnimatePresence>
        {isExpanded && (
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/5 p-6 md:p-8 bg-black/20"
            >
                 <div className="grid md:grid-cols-2 gap-8 mb-8">
                     <div>
                         <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Solution Outline</h4>
                         {problem.solution ? (
                             <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-zinc-300 text-sm whitespace-pre-wrap font-serif shadow-inner">
                                <MathText text={problem.solution} />
                             </div>
                         ) : (
                             <div className="text-zinc-600 italic text-sm">No solution provided.</div>
                         )}
                     </div>
                     <div>
                         <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Answer Key</h4>
                         <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-zinc-100 font-bold font-mono shadow-inner">
                             {problem.answerKey || <span className="text-zinc-600 font-normal italic">None</span>}
                         </div>
                     </div>
                 </div>

                 {/* Comments */}
                 <div className="border-t border-white/5 pt-6">
                     <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <MessageSquare className="w-3 h-3" /> Discussion
                     </h4>
                     
                     <div className="space-y-4 mb-4">
                         {loadingComments ? (
                             <div className="text-zinc-600 text-sm italic">Loading comments...</div>
                         ) : comments.length === 0 ? (
                             <div className="text-zinc-600 text-sm italic">No comments yet.</div>
                         ) : (
                             comments.map(c => (
                                 <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2">
                                     <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 font-bold text-xs shrink-0 border border-white/5">
                                         {c.userName.charAt(0)}
                                     </div>
                                     <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 text-sm max-w-2xl">
                                         <div className="flex items-center gap-2 mb-1">
                                             <span className="font-bold text-zinc-300">{c.userName}</span>
                                             <span className="text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                                         </div>
                                         <p className="text-zinc-400">{c.text}</p>
                                     </div>
                                 </div>
                             ))
                         )}
                     </div>

                     {currentUserRole !== 'guest' && (
                        <div className="flex gap-2 items-end">
                            <textarea 
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Add a comment..." 
                                className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none h-20 text-zinc-200 placeholder:text-zinc-600"
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