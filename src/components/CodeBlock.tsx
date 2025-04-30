import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Or choose another theme

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  return (
    <SyntaxHighlighter 
        language={language} 
        style={vscDarkPlus} // Use the imported theme
        customStyle={{
            borderRadius: '0.375rem', // Match Shadcn border radius (md)
            padding: '1rem', 
            margin: '0',
            fontSize: '0.875rem' // text-sm
        }}
        wrapLongLines={true}
    >
      {code}
    </SyntaxHighlighter>
  );
};

export default CodeBlock; //11