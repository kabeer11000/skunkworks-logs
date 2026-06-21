import { MarkViewContent, type MarkViewRendererProps } from '@tiptap/react'
import React from 'react'

export default (props: MarkViewRendererProps) => {
  const authorColor = props.mark.attrs['data-color'] || '#91b5fc';
  const authorName = props.mark.attrs['data-author'] || 'Unknown Author';
  
  // Format the date nicely for the tooltip (if it exists)
  const rawDate = props.mark.attrs['data-updated-at'];
  const formattedDate = rawDate ? new Date(rawDate).toLocaleTimeString() : 'Just now';

  return (
    <span 
      className="group relative inline-flex items-center cursor-pointer z-0"
      style={{ '--author-color': authorColor } as React.CSSProperties}
    >
      <span 
        aria-hidden="true"
        className="absolute bg-[var(--author-color)]/30 -inset-y-[3px] -inset-x-[4px] -z-10 rounded-[6px] transition-colors duration-150 ease-in-out pointer-events-none group-hover:bg-[var(--author-color)] group-active:bg-[var(--author-color)] group-focus-within:bg-[var(--author-color)]"
      />

      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-md z-50">
        {authorName} - {formattedDate}
      </span>
      
      <MarkViewContent />
    </span>
  )
}