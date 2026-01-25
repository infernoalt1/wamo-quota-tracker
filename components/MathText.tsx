import React from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split string by $$...$$ (block) or $...$ (inline)
  // The capturing regex ( ) keeps the delimiter/content in the output array so we can process it
  // Regex explanation:
  // \$\$[\s\S]*?\$\$ matches block math (using [\s\S] to match newlines inside blocks)
  // \$[^$\n]*?\$ matches inline math (avoiding newlines to prevent accidental multi-line matches for single $)
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          // Block Math
          const math = part.slice(2, -2);
          try {
            const html = katex.renderToString(math, { 
                displayMode: true, 
                throwOnError: false,
                output: 'html' // Render html (not MathML) for better compatibility in simple view
            });
            return <div key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index} className="text-red-500 font-mono">{part}</span>;
          }
        } else if (part.startsWith('$') && part.endsWith('$')) {
          // Inline Math
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, { 
                displayMode: false, 
                throwOnError: false,
                output: 'html'
            });
            return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch (e) {
            return <span key={index} className="text-red-500 font-mono">{part}</span>;
          }
        } else {
          // Regular Text
          return <span key={index}>{part}</span>;
        }
      })}
    </div>
  );
};