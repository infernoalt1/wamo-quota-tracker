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
  
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'director';
  const canEdit = isAdmin || problem.authorId === currentUserId;

  const topicColors: Record<string, string> = {
    'Algebra': 'bg-blue-50 text-blue-700 border-blue-100',
    'Geometry': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Combinatorics': 'bg-orange-50 text-orange-700 border-orange-100',
    'Number Theory': 'bg-purple-50 text-purple-700 border-purple-100'
  };

  const StatusBadge = () => {
    if (status === 'accepted') {
      return (
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200 uppercase tracking-wide">
           <CheckCircle className="w-3 h-3" /> Accepted
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row overflow-hidden ${status === 'accepted' ? 'border-green-200' : 'border-slate-200'}`}>
      
      {/* Vote Section */}
      <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-start sm:pt-4 px-4 py-3 sm:w-16 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-100 gap-1 sm:gap-2">
         <button 
            onClick={() => onUpvote(problem.id)}
            disabled={currentUserRole === 'guest'}
            className={`flex flex-col items-center transition-all ${
               hasVoted 
                 ? 'text-indigo-600' 
                 : currentUserRole === 'guest' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-500 hover:-translate-y-0.5'
            }`}
            title={currentUserRole === 'guest' ? "Guests cannot vote" : hasVoted ? "Remove vote" : `Upvote (Power: ${votingPower})`}
         >
            <ThumbsUp className={`w-5 h-5 ${hasVoted ? 'fill-current' : ''}`} />
         </button>
         <span className={`font-bold text-sm ${score > 0 ? 'text-indigo-900' : 'text-slate-400'}`}>
            {score}
         </span>
      </div>

      <div className="flex-1 p-5 min-w-0">
        <div className="flex justify-between items-start mb-3 gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-slate-900 leading-snug truncate max-w-[500px]">
                    <MathText text={problem.title} />
                </h3>
                <StatusBadge />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
               {showAuthor ? (
                  <span className="text-indigo-600 font-medium">
                    {problem.authorName}
                  </span>
               ) : (
                  <span className="italic flex items-center gap-1">
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

          <div className="flex items-center gap-1 shrink-0">
              {isAdmin && onStatusChange && (
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded p-0.5 gap-0.5">
                        <button onClick={() => onStatusChange(problem.id, 'pending')} className={`p-1 rounded hover:bg-white hover:shadow-sm ${status === 'pending' ? 'text-slate-800' : 'text-slate-400'}`} title="Pending"><AlertCircle className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onStatusChange(problem.id, 'accepted')} className={`p-1 rounded hover:bg-white hover:shadow-sm ${status === 'accepted' ? 'text-green-600' : 'text-slate-400'}`} title="Accept"><CheckCircle className="w-3.5 h-3.5" /></button>
                  </div>
              )}
              {canEdit && (
                  <button onClick={() => onEdit(problem)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-slate-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                  </button>
              )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
            {problem.topics && problem.topics.map(t => (
                <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${topicColors[t] || 'bg-gray-50 text-gray-700 border-gray-100'}`}>
                    {t}
                </span>
            ))}
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100/50">
            <MathText text={problem.statement} className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif" />
        </div>
        
        {problem.imageData && (
           <div className="mt-3">
               <img src={problem.imageData} alt="Problem Attachment" className="max-w-full h-auto max-h-[400px] rounded border border-slate-200" />
           </div>
        )}
      </div>
    </div>
  );
};