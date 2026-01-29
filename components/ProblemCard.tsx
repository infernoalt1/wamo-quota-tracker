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
    'Algebra': 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    'Geometry': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    'Combinatorics': 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    'Number Theory': 'bg-purple-500/10 text-purple-300 border-purple-500/20'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1.5 bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-green-500/20 shadow-[0_0_10px_-3px_rgba(74,222,128,0.2)]">
           <CheckCircle className="w-3 h-3" /> 
           <span>Accepted {roundName ? `in ${roundName}` : ''}</span>
        </span>
      );
    }
    return null; // Pending status doesn't need a loud badge
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
      layout
      className={`group bg-white/[0.03] backdrop-blur-xl rounded-3xl border transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row ${status === 'accepted' ? 'border-green-500/30 ring-1 ring-green-500/20' : 'border-white/10 hover:border-indigo-500/30'}`}
    >
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-6 border-b md:border-b-0 md:border-r border-white/5 min-w-[90px] gap-2 bg-black/20">
         <button 
            onClick={(e) => { e.stopPropagation(); onUpvote(problem.id); }}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${
               hasVoted 
                 ? 'text-indigo-400 scale-110 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' 
                 : currentUserRole === 'guest' ? 'text-gray-700 cursor-not-allowed' : 'text-gray-600 hover:text-gray-300 hover:scale-110'
            }`}
            title={currentUserRole === 'guest' ? "Guests cannot vote" : hasVoted ? "Click to remove vote" : `Upvote (Power: ${votingPower})`}
         >
            <ThumbsUp className={`w-6 h-6 ${hasVoted ? 'fill-current' : ''}`} />
         </button>
         <span className={`font-bold text-xl tracking-tight ${score > 0 ? 'text-indigo-100' : 'text-gray-600'}`}>
            {score}
         </span>
         <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest hidden md:block">Votes</span>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 md:p-8 cursor-pointer" onClick={toggleExpand}>
            <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-100 leading-tight tracking-tight">
                            <MathText text={problem.title} />
                        </h3>
                        <StatusBadge />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {/* Admin Status Controls */}
                        {isAdmin && onStatusChange && (
                            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 mr-2 gap-1" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'pending')} 
                                    className={`p-1.5 rounded transition-all ${status === 'pending' ? 'bg-white/10 text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    title={status === 'approved' ? "Return to Waitlist" : "Set Pending"}
                                >
                                    {status === 'approved' ? <RotateCcw className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                </button>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'accepted')} 
                                    className={`p-1.5 rounded transition-all ${status === 'accepted' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-500 hover:text-green-400'}`}
                                    title="Accept"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {canEdit && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                                className="text-gray-500 hover:text-indigo-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
                                title="Edit Problem"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}

                        <button className="text-gray-500 hover:text-gray-300 p-1">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-1">
                {showAuthor ? (
                    <span className="font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                        By {problem.authorName}
                    </span>
                ) : (
                    <span className="font-medium italic flex items-center gap-1 text-gray-600">
                        <MoreHorizontal className="w-3 h-3" /> Blind Review
                    </span>
                )}
                <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5">
                    <Target className="w-3 h-3" />
                    Diff: <span className="font-bold text-gray-200">{problem.difficulty}</span>
                </span>
                <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(problem.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-gray-500">
                    <MessageSquare className="w-3 h-3" /> {problem.commentCount || 0}
                </span>
                </div>
            </div>
            </div>
            
            {/* Topics */}
            <div className="flex flex-wrap gap-2 mb-4">
                {problem.topics && problem.topics.map(t => (
                    <span key={t} className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${topicColors[t] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {t}
                    </span>
                ))}
            </div>

            <MathText 
            text={problem.statement} 
            className={`bg-white/[0.02] p-6 rounded-2xl font-serif text-gray-200 border border-white/5 whitespace-pre-wrap leading-relaxed shadow-inner text-lg ${!isExpanded && 'line-clamp-3'}`} 
            />
            
            {problem.imageData && (
            <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <img src={problem.imageData} alt="Problem attachment" className="max-h-96 w-auto mx-auto object-contain" />
                <div className="bg-black/60 text-xs text-center text-gray-500 py-1 border-t border-white/5 flex items-center justify-center gap-1 backdrop-blur-sm">
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
                className="border-t border-white/10 p-6 md:p-8 bg-black/20"
            >
                 <div className="grid md:grid-cols-2 gap-8 mb-8">
                     <div>
                         <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Solution Outline</h4>
                         {problem.solution ? (
                             <MathText text={problem.solution} className="bg-white/[0.03] p-4 rounded-xl border border-white/10 text-gray-300 text-sm whitespace-pre-wrap font-serif" />
                         ) : (
                             <div className="text-gray-600 italic text-sm">No solution provided.</div>
                         )}
                     </div>
                     <div>
                         <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Answer Key</h4>
                         <div className="bg-white/[0.03] p-4 rounded-xl border border-white/10 text-indigo-300 font-bold font-mono shadow-inner">
                             {problem.answerKey || <span className="text-gray-600 font-normal italic">None</span>}
                         </div>
                     </div>
                 </div>

                 {/* Comments */}
                 <div className="border-t border-white/10 pt-6">
                     <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <MessageSquare className="w-4 h-4" /> Discussion
                     </h4>
                     
                     <div className="space-y-4 mb-4">
                         {loadingComments ? (
                             <div className="text-gray-600 text-sm italic">Loading comments...</div>
                         ) : comments.length === 0 ? (
                             <div className="text-gray-600 text-sm italic">No comments yet.</div>
                         ) : (
                             comments.map(c => (
                                 <div key={c.id} className="flex gap-3">
                                     <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 font-bold text-xs shrink-0 border border-white/5">
                                         {c.userName.charAt(0)}
                                     </div>
                                     <div className="bg-white/[0.03] p-3 rounded-2xl rounded-tl-none border border-white/10 text-sm max-w-2xl">
                                         <div className="flex items-center gap-2 mb-1">
                                             <span className="font-bold text-gray-300">{c.userName}</span>
                                             <span className="text-[10px] text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                                         </div>
                                         <p className="text-gray-400">{c.text}</p>
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
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none h-20 text-white placeholder-gray-600 transition-all"
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