import React from 'react';
import { Problem } from '../types';
import { MoreHorizontal, Calendar, ThumbsUp } from 'lucide-react';

interface ProblemCardProps {
  problem: Problem;
  showAuthor?: boolean;
  currentUserId: string;
  onUpvote: (problemId: string) => void;
  votingPower: number;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({ 
  problem, 
  showAuthor = false, 
  currentUserId,
  onUpvote,
  votingPower
}) => {
  const hasVoted = problem.votedBy?.includes(currentUserId);
  const score = problem.score || 0;

  return (
    <div className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative flex flex-col md:flex-row">
      
      {/* Vote Section */}
      <div className="flex flex-row md:flex-col items-center justify-between md:justify-center p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-100 min-w-[80px] gap-2">
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
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-slate-900 leading-tight">{problem.title}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
               {showAuthor ? (
                  <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    By {problem.authorName}
                  </span>
               ) : (
                  <span className="font-medium italic flex items-center gap-1 text-slate-400">
                    <MoreHorizontal className="w-3 h-3" /> Blind Review
                  </span>
               )}
               <span className="flex items-center gap-1">
                 <Calendar className="w-3 h-3" />
                 {new Date(problem.createdAt).toLocaleDateString()}
               </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg font-serif text-slate-800 border border-slate-200 whitespace-pre-wrap leading-relaxed">
          {problem.statement}
        </div>
      </div>
    </div>
  );
};
