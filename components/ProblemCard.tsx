import React, { useState } from 'react';
import { Problem, ProblemStatus, Comment } from '../types';
import { MoreHorizontal, Calendar, ThumbsUp, Target, Pencil, CheckCircle, AlertCircle, Image as ImageIcon, MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { MathText } from './MathText';
import { Button } from './Button';
import { api } from '../api';

interface ProblemCardProps {
  problem: Problem;
  quotaName?: string; // New prop for display
  showAuthor?: boolean;
  currentUserId: string;
  currentUserRole: string;
  onUpvote: (problemId: string) => void;
  onEdit: (problem: Problem) => void;
  onStatusChange?: (problemId: string, status: ProblemStatus) => void;
  votingPower: number;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({ 
  problem, 
  quotaName,
  showAuthor = false, 
  currentUserId,
  currentUserRole,
  onUpvote,
  onEdit,
  onStatusChange,
  votingPower
}) => {
  const hasVoted = problem.votedBy?.includes(currentUserId);
  const score = problem.score || 0;
  const status = problem.status || 'pending';
  const [isExpanded, setIsExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  // Can edit if admin, director or author
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'director';
  const canEdit = isAdmin || problem.authorId === currentUserId;

  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-100 text-blue-700',
    'Geometry': 'bg-green-100 text-green-700',
    'Combinatorics': 'bg-orange-100 text-orange-700',
    'Number Theory': 'bg-purple-100 text-purple-700'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold border border-green-200 shadow-sm">
           <CheckCircle className="w-3.5 h-3.5" /> 
           <span>Accepted {quotaName ? `in ${quotaName}` : ''}</span>
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
    <div className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row ${status === 'accepted' ? 'border-green-200 ring-2 ring-green-50' : 'border-slate-200'}`}>
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-6 border-b md:border-b-0 md:border-r border-slate-100 min-w-[90px] gap-2 bg-slate-50/50">
         <button 
            onClick={(e) => { e.stopPropagation(); onUpvote(problem.id); }}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center gap-1 transition-all ${
               hasVoted 
                 ? 'text-indigo-600 scale-110' 
                 : currentUserRole === 'guest' ? 'text-slate-200 cursor-not-allowed' : 'text-slate-300 hover:text-slate-500 hover:scale-110'
            }`}
            title={currentUserRole === 'guest' ? "Guests cannot vote" : hasVoted ? "Click to remove vote" : `Upvote (Power: ${votingPower})`}
         >
            <ThumbsUp className={`w-6 h-6 ${hasVoted ? 'fill-current' : ''}`} />
         </button>
         <span className={`font-bold text-xl ${score > 0 ? 'text-indigo-900' : 'text-slate-400'}`}>
            {score}
         </span>
         <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider hidden md:block">Votes</span>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 md:p-8 cursor-pointer" onClick={toggleExpand}>
            <div className="flex justify-between items-start mb-4">
            <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-slate-900 leading-tight">
                            <MathText text={problem.title} />
                        </h3>
                        <StatusBadge />
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {/* Admin Status Controls */}
                        {isAdmin && onStatusChange && (
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 mr-2 gap-1" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'pending')} 
                                    className={`p-1.5 rounded transition-all ${status === 'pending' ? 'bg-white shadow text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Set Pending"
                                >
                                    <AlertCircle className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onStatusChange(problem.id, 'accepted')} 
                                    className={`p-1.5 rounded transition-all ${status === 'accepted' ? 'bg-green-100 text-green-600 shadow-sm' : 'text-slate-400 hover:text-green-500'}`}
                                    title="Accept"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {canEdit && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                                className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                title="Edit Problem"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        )}

                        <button className="text-slate-400 hover:text-slate-600 p-1">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                {showAuthor ? (
                    <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        By {problem.authorName}
                    </span>
                ) : (
                    <span className="font-medium italic flex items-center gap-1 text-slate-400">
                        <MoreHorizontal className="w-3 h-3" /> Blind Review
                    </span>
                )}
                <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    <Target className="w-3 h-3" />
                    Diff: <span className="font-bold">{problem.difficulty}</span>
                </span>
                <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(problem.createdAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                    <MessageSquare className="w-3 h-3" /> {problem.commentCount || 0}
                </span>
                </div>
            </div>
            </div>
            
            {/* Topics */}
            <div className="flex flex-wrap gap-2 mb-4">
                {problem.topics && problem.topics.map(t => (
                    <span key={t} className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${topicColors[t] || 'bg-gray-100 text-gray-700'}`}>
                        {t}
                    </span>
                ))}
            </div>

            <MathText 
            text={problem.statement} 
            className={`bg-slate-50 p-6 rounded-xl font-serif text-slate-800 border border-slate-100 whitespace-pre-wrap leading-relaxed shadow-sm text-lg ${!isExpanded && 'line-clamp-3'}`} 
            />
            
            {problem.imageData && (
            <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
                <img src={problem.imageData} alt="Problem attachment" className="max-h-96 w-auto mx-auto object-contain" />
                <div className="bg-slate-50 text-xs text-center text-slate-400 py-1 border-t border-slate-100 flex items-center justify-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Attachment
                </div>
            </div>
            )}
        </div>

        {/* Expanded Content: Solution, Answer, Comments */}
        {isExpanded && (
            <div className="border-t border-slate-100 p-6 md:p-8 bg-slate-50/30 animate-in slide-in-from-top-2 duration-200">
                 <div className="grid md:grid-cols-2 gap-8 mb-8">
                     <div>
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Solution Outline</h4>
                         {problem.solution ? (
                             <MathText text={problem.solution} className="bg-white p-4 rounded-xl border border-slate-200 text-slate-800 text-sm whitespace-pre-wrap font-serif shadow-sm" />
                         ) : (
                             <div className="text-slate-400 italic text-sm">No solution provided.</div>
                         )}
                     </div>
                     <div>
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Answer Key</h4>
                         <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-900 font-bold font-mono shadow-sm">
                             {problem.answerKey || <span className="text-slate-400 font-normal italic">None</span>}
                         </div>
                     </div>
                 </div>

                 {/* Comments */}
                 <div className="border-t border-slate-200 pt-6">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <MessageSquare className="w-4 h-4" /> Discussion
                     </h4>
                     
                     <div className="space-y-4 mb-4">
                         {loadingComments ? (
                             <div className="text-slate-400 text-sm italic">Loading comments...</div>
                         ) : comments.length === 0 ? (
                             <div className="text-slate-400 text-sm italic">No comments yet.</div>
                         ) : (
                             comments.map(c => (
                                 <div key={c.id} className="flex gap-3">
                                     <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                         {c.userName.charAt(0)}
                                     </div>
                                     <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-sm">
                                         <div className="flex items-center gap-2 mb-1">
                                             <span className="font-bold text-slate-700">{c.userName}</span>
                                             <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                         </div>
                                         <p className="text-slate-600">{c.text}</p>
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
                                className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                            />
                            <Button size="sm" onClick={postComment} disabled={!newComment.trim()}>
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                     )}
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};