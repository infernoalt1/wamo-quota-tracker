import React from 'react';
import { Problem, ProblemStatus } from '../types';
import { MoreHorizontal, Calendar, ThumbsUp, Target, Pencil, CheckCircle, Bookmark, Star, AlertCircle, ChevronDown } from 'lucide-react';
import { MathText } from './MathText';

interface ProblemCardProps {
  problem: Problem;
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
        <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200">
           <CheckCircle className="w-3 h-3" /> Accepted
        </span>
      );
    }
    if (status === 'shortlisted') {
      return (
        <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-bold border border-yellow-200">
           <Star className="w-3 h-3" /> Shortlisted
        </span>
      );
    }
    return null; // Pending status doesn't need a loud badge
  };

  return (
    <div className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row ${status === 'accepted' ? 'border-green-200 ring-1 ring-green-100' : 'border-slate-200'}`}>
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-100 min-w-[80px] gap-2 bg-slate-50/50">
         <button 
            onClick={() => onUpvote(problem.id)}
            className={`flex flex-col items-center gap-1 transition-all ${
               hasVoted 
                 ? 'text-indigo-600 scale-110' 
                 : 'text-slate-300 hover:text-slate-500 hover:scale-110'
            }`}
            title={hasVoted ? "Click to remove vote" : `Upvote (Power: ${votingPower})`}
         >
            <ThumbsUp className={`w-6 h-6 ${hasVoted ? 'fill-current' : ''}`} />
         </button>
         <span className={`font-bold text-lg ${score > 0 ? 'text-indigo-900' : 'text-slate-400'}`}>
            {score}
         </span>
         <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider hidden md:block">Votes</span>
      </div>

      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        <MathText text={problem.title} />
                    </h3>
                    <StatusBadge />
                </div>
                
                <div className="flex items-center gap-1">
                    {/* Admin Status Controls */}
                    {isAdmin && onStatusChange && (
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 mr-2">
                             <button 
                                onClick={() => onStatusChange(problem.id, 'pending')} 
                                className={`p-1.5 rounded transition-all ${status === 'pending' ? 'bg-white shadow text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                                title="Set Pending"
                             >
                                <AlertCircle className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => onStatusChange(problem.id, 'shortlisted')} 
                                className={`p-1.5 rounded transition-all ${status === 'shortlisted' ? 'bg-yellow-100 text-yellow-600 shadow-sm' : 'text-slate-400 hover:text-yellow-500'}`}
                                title="Shortlist"
                             >
                                <Star className="w-4 h-4" />
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
                            onClick={() => onEdit(problem)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                            title="Edit Problem"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
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
            </div>
          </div>
        </div>
        
        {/* Topics */}
        <div className="flex flex-wrap gap-2 mb-4">
            {problem.topics && problem.topics.map(t => (
                <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${topicColors[t] || 'bg-gray-100 text-gray-700'}`}>
                    {t}
                </span>
            ))}
        </div>

        <MathText 
           text={problem.statement} 
           className="bg-white p-5 rounded-lg font-serif text-slate-800 border border-slate-200 whitespace-pre-wrap leading-relaxed" 
        />
      </div>
    </div>
  );
};