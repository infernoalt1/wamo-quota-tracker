import React, { useState } from 'react';
import { Problem, ProblemStatus, Comment } from '../types';
import { Calendar, ThumbsUp, Target, Pencil, CheckCircle, MessageSquare, ChevronDown, ChevronUp, Send, RotateCcw, Trash2, FolderOpen } from 'lucide-react';
import { MathText } from './MathText';
import { Button } from './Button';
import { api } from '../api';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';

interface ProblemCardProps {
  problem: Problem;
  roundName?: string;
  quotaName?: string;
  showAuthor?: boolean;
  currentUserId: string;
  currentUserRole: string;
  onUpvote: (problemId: string) => void;
  onEdit: (problem: Problem) => void;
  onDelete?: (problem: Problem) => void;
  onStatusChange?: (problemId: string, status: ProblemStatus) => void;
  onCommentPosted?: () => void;
  onCommentError?: (message: string) => void;
  votingPower: number;
  defaultExpanded?: boolean;
  readOnly?: boolean;
  showWaitlistBadge?: boolean;
  className?: string;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({
  problem,
  roundName,
  quotaName,
  showAuthor = false,
  currentUserId,
  currentUserRole,
  onUpvote,
  onEdit,
  onDelete,
  onStatusChange,
  onCommentPosted,
  onCommentError,
  votingPower,
  defaultExpanded = false,
  readOnly = false,
  showWaitlistBadge = false,
  className = ''
}) => {
  const isOwnProblem = problem.authorId === currentUserId;
  const hasVoted = !isOwnProblem && problem.votedBy?.includes(currentUserId);
  const score = problem.score || 0;
  const status = problem.status || 'pending';
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'director';
  const canEdit = isAdmin || problem.authorId === currentUserId;
  const votingDisabled = currentUserRole === 'guest' || readOnly || isOwnProblem;

  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-50 text-blue-700 border-blue-200',
    'Geometry': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Combinatorics': 'bg-orange-50 text-orange-700 border-orange-200',
    'Number Theory': 'bg-purple-50 text-purple-700 border-purple-200'
  };
  const topicLabels: Record<string, string> = {
    'Algebra': 'A',
    'Geometry': 'G',
    'Combinatorics': 'C',
    'Number Theory': 'N'
  };
  const topicOrder = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];
  const sortedTopics = [...(problem.topics || [])].sort((a, b) => topicOrder.indexOf(a) - topicOrder.indexOf(b));
  const formatDifficulty = (value: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(1) : '0.0';
  };
  const TopicBadge = ({ topic, compact = false }: { topic: string; compact?: boolean }) => (
    <span
      title={topic}
      className={`${compact ? 'grid h-5 w-5 place-items-center rounded-full text-[10px]' : 'grid h-6 w-6 place-items-center rounded-full text-[11px]'} font-black border ${topicColors[topic] || 'bg-slate-100 text-slate-500 border-slate-200'}`}
    >
      {topicLabels[topic] || topic.charAt(0)}
    </span>
  );

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200">
           <CheckCircle className="w-3 h-3" />
           <span>{roundName ? roundName : 'Accepted'}</span>
        </span>
      );
    }
    if (status === 'pending' && showWaitlistBadge) {
      return (
        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">
          <span>Waitlisted</span>
        </span>
      );
    }
    return null;
  };

  const toggleExpand = async () => {
      const nextState = !isExpanded;
      setIsExpanded(nextState);
      if (nextState && comments.length === 0) {
          try {
              const c = await api.getComments(problem.id);
              setComments(c);
          } catch(e) {
              console.error(e);
          }
      }
  };

  const postComment = async () => {
      if (!newComment.trim()) return;
      try {
          const c = await api.postComment(problem.id, newComment);
          setComments([...comments, c]); 
          setNewComment('');
          onCommentPosted?.();
      } catch(e) {
          console.error(e);
          onCommentError?.(e instanceof Error ? e.message : 'Failed to post comment');
      }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-white rounded-xl border transition-all duration-200 relative flex flex-col shadow-sm hover:shadow-md ${status === 'accepted' ? 'border-green-200/60 ring-1 ring-green-50' : 'border-slate-200 hover:border-indigo-200'} ${className}`}
    >
      
      <div className="flex flex-row items-stretch">
        {/* Vote Sidebar */}
        <div className="flex flex-col items-center p-3 border-r border-slate-100 bg-slate-50/50 w-16 gap-1 shrink-0">
           <div
              title="Voting happens in the Voting tab."
              className="flex flex-col items-center justify-center gap-0.5 w-10 h-10 rounded-lg text-slate-400 bg-white/70 ring-1 ring-slate-100"
           >
              <ThumbsUp className="w-4 h-4" />
           </div>
           <span className={`font-bold text-sm tabular-nums tracking-tight ${score > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
              {score}
           </span>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
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
                                <span className="font-bold text-slate-700">{formatDifficulty(problem.difficulty)}</span>
                            </span>
                            {quotaName && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 text-slate-500">
                                    <FolderOpen className="w-3 h-3 text-slate-400" />
                                    <span className="font-semibold truncate max-w-[140px]">{quotaName}</span>
                                </span>
                            )}
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
                        <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[120px]">
                            {sortedTopics.map(t => (
                                <TopicBadge key={t} topic={t} compact />
                            ))}
                        </div>
                        
                        {!readOnly && isAdmin && onStatusChange && status !== 'pending' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onStatusChange(problem.id, 'pending'); }}
                                className="text-slate-400 hover:text-amber-600 p-1.5 rounded-md hover:bg-amber-50 transition-colors ml-1"
                                title="Return to waitlist"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {!readOnly && canEdit && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
                                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors ml-1"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {!readOnly && isAdmin && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(problem); }}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors ml-1"
                                title="Delete problem"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                         
                         <div className="pl-1 border-l border-slate-100 ml-1">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                         </div>
                    </div>
                </div>

                {/* --- STATEMENT PREVIEW WITH AUTOMATIC IMAGE --- */}
                <div className="mt-3">
                     <MathText 
                        text={problem.statement} 
                        className= "font-serif text-slate-800 text-sm leading-relaxed whitespace-pre-wrap" 
                    />
                    
                    {/* Display image automatically if it exists, matching Waitlist style */}
                    {problem.imageData && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-white inline-block">
                            <img 
                                src={problem.imageData} 
                                alt="Problem attachment" 
                                className="max-h-64 w-auto object-contain block" 
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/30">
                <div className="p-5 grid gap-5">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Solution Outline</h4>
                      {problem.solution ? (
                        <MathText text={problem.solution} className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-serif" />
                      ) : (
                        <div className="text-slate-400 italic text-sm">No solution provided.</div>
                      )}
                    </div>
                    <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 h-fit">
                      <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Answer Key</h4>
                      {problem.answerKey ? (
                        <MathText text={problem.answerKey} className="text-indigo-900 text-sm font-serif" />
                      ) : (
                        <span className="text-indigo-300 italic text-sm">None</span>
                      )}
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div className="pt-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" /> Discussion
                    </h4>
                    <div className="space-y-3 mb-4 pl-1">
                      {comments.map(c => (
                        <div key={c.id} className="flex gap-3 items-start">
                          <Avatar name={c.userName} size="xs" />
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-slate-800 text-xs">{c.userName}</span>
                              <span className="text-[9px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-600 text-xs mt-0.5 leading-relaxed bg-white p-2 rounded border border-slate-100 inline-block">{c.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {currentUserRole !== 'guest' && (
                      <div className="flex gap-2 items-center">
                        <input
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 placeholder-slate-400"
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                        />
                        <Button size="sm" onClick={postComment} disabled={!newComment.trim()} className="h-8 w-8 p-0 flex items-center justify-center rounded-lg">
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </motion.div>
  );
};
