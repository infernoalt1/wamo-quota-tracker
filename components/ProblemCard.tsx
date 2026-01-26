import React from 'react';
import { Problem, ProblemStatus } from '../types';
import { MoreHorizontal, Calendar, ThumbsUp, Target, Pencil, CheckCircle, Star, AlertCircle, Image as ImageIcon } from 'lucide-react';
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
    'Algebra': 'bg-blue-50 text-blue-700 border-blue-100',
    'Geometry': 'bg-green-50 text-green-700 border-green-100',
    'Combinatorics': 'bg-orange-50 text-orange-700 border-orange-100',
    'Number Theory': 'bg-purple-50 text-purple-700 border-purple-100'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-green-200 uppercase tracking-wide">
           <CheckCircle className="w-3 h-3" /> Accepted
        </span>
      );
    }
    if (status === 'shortlisted') {
      return (
        <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-yellow-200 uppercase tracking-wide">
           <Star className="w-3 h-3" /> Shortlisted
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row ${status === 'accepted' ? 'border-green-200 ring-1 ring-green-50' : 'border-slate-200'}`}>
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-start pt-0 md:pt-4 px-4 py-2 md:w-16 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 gap-2">
         <button 
            onClick={() => onUpvote(problem.id)}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center gap-0.5 transition-all ${
               hasVoted 
                 ? 'text-indigo-600' 
                 : currentUserRole === 'guest' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-500 hover:-translate-y-0.5'
            }`}
            title={currentUserRole === 'guest' ? "Guests cannot vote" : hasVoted ? "Click to remove vote" : `Upvote (Power: ${votingPower})`}
         >
            <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />
         </button>
         <span className={`font-bold text-sm ${score > 0 ? 'text-indigo-900' : 'text-slate-400'}`}>
            {score}
         </span>
      </div>

      <div className="p-4 md:p-5 flex-1 min-w-0">
        <div className="flex justify-between items-start mb-3 gap-3">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug truncate max-w-full">
                        <MathText text={problem.title} />
                    </h3>
                    <StatusBadge />
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                    {/* Admin Status Controls */}
                    {isAdmin && onStatusChange && (
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded p-0.5 mr-1 gap-0.5">
                             <button 
                                onClick={() => onStatusChange(problem.id, 'pending')} 
                                className={`p-1 rounded transition-all ${status === 'pending' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-300 hover:text-slate-600'}`}
                                title="Set Pending"
                             >
                                <AlertCircle className="w-3 h-3" />
                             </button>
                             <button 
                                onClick={() => onStatusChange(problem.id, 'shortlisted')} 
                                className={`p-1 rounded transition-all ${status === 'shortlisted' ? 'bg-yellow-50 text-yellow-600 shadow-sm' : 'text-slate-300 hover:text-yellow-500'}`}
                                title="Shortlist"
                             >
                                <Star className="w-3 h-3" />
                             </button>
                             <button 
                                onClick={() => onStatusChange(problem.id, 'accepted')} 
                                className={`p-1 rounded transition-all ${status === 'accepted' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-slate-300 hover:text-green-500'}`}
                                title="Accept"
                             >
                                <CheckCircle className="w-3 h-3" />
                             </button>
                        </div>
                    )}

                    {canEdit && (
                        <button 
                            onClick={() => onEdit(problem)}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-slate-50 transition-colors"
                            title="Edit Problem"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
               {showAuthor ? (
                  <span className="font-medium text-indigo-600">
                    By {problem.authorName}
                  </span>
               ) : (
                  <span className="font-medium italic flex items-center gap-1 text-slate-400">
                    <MoreHorizontal className="w-3 h-3" /> Blind
                  </span>
               )}
               <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                  <Target className="w-3 h-3" />
                  <span>{problem.difficulty}</span>
               </span>
               <span className="flex items-center gap-1">
                 <Calendar className="w-3 h-3" />
                 {new Date(problem.createdAt).toLocaleDateString()}
               </span>
            </div>
          </div>
        </div>
        
        {/* Topics */}
        <div className="flex flex-wrap gap-1.5 mb-3">
            {problem.topics && problem.topics.map(t => (
                <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${topicColors[t] || 'bg-gray-50 text-gray-700 border-gray-100'}`}>
                    {t}
                </span>
            ))}
        </div>

        <MathText 
           text={problem.statement} 
           className="bg-slate-50/50 p-4 rounded-lg font-serif text-slate-800 border border-slate-100 whitespace-pre-wrap leading-relaxed text-sm" 
        />
        
        {problem.imageData && (
           <div className="mt-3 rounded-lg overflow-hidden border border-slate-200">
               <img src={problem.imageData} alt="Attachment" className="max-h-64 w-auto mx-auto object-contain" />
           </div>
        )}
      </div>
    </div>
  );
};