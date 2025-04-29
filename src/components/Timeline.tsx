
import { useState, useRef, useEffect } from "react";

interface TimelineSegment {
  start: number;
  end: number;
  type: string;
}

interface TimelineProps {
  timelineData: {
    segments: TimelineSegment[];
  };
}

const Timeline: React.FC<TimelineProps> = ({ timelineData }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const totalDuration = timelineData.segments.length > 0
    ? timelineData.segments[timelineData.segments.length - 1].end
    : 0;

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleScroll = (e: React.WheelEvent) => {
    if (e.shiftKey && containerRef.current) {
      const newPosition = position + e.deltaY;
      const maxScroll = (containerRef.current.scrollWidth - containerRef.current.clientWidth) * zoomLevel;
      setPosition(Math.max(0, Math.min(newPosition, maxScroll)));
      e.preventDefault();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-100 rounded-md p-2">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-gray-600">Timeline</div>
        <div className="flex space-x-2">
          <button 
            className="bg-violet-200 hover:bg-violet-300 text-violet-800 rounded px-2 py-0.5 text-xs"
            onClick={handleZoomOut}
          >
            -
          </button>
          <div className="text-xs bg-white px-2 py-0.5 rounded border border-gray-300">
            {(zoomLevel * 100).toFixed(0)}%
          </div>
          <button 
            className="bg-violet-200 hover:bg-violet-300 text-violet-800 rounded px-2 py-0.5 text-xs"
            onClick={handleZoomIn}
          >
            +
          </button>
        </div>
      </div>
      
      <div className="relative mb-1">
        <div className="absolute left-0 top-0 h-4 bg-gray-200 w-full">
          {[...Array(Math.ceil(totalDuration / 5))].map((_, i) => (
            <div 
              key={i} 
              className="absolute top-0 h-2 border-l border-gray-400" 
              style={{ 
                left: `${(i * 5 / totalDuration) * 100}%`
              }}
            >
              <div className="absolute -left-4 -top-4 text-[10px] text-gray-600">
                {formatTime(i * 5)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="relative h-16 overflow-hidden"
        onWheel={handleScroll}
      >
        <div 
          className="absolute top-0 h-full transition-transform duration-200 ease-in-out"
          style={{ 
            width: `${totalDuration * 20 * zoomLevel}px`,
            transform: `translateX(${-position}px)`
          }}
        >
          {timelineData.segments.map((segment, index) => {
            const segmentWidth = (segment.end - segment.start) * 20 * zoomLevel;
            const segmentLeft = segment.start * 20 * zoomLevel;
            
            return (
              <div
                key={index}
                className={`absolute top-0 h-full ${
                  segment.type === 'silence' 
                    ? 'bg-gray-300' 
                    : 'bg-gradient-to-r from-violet-300 to-purple-300'
                } border-r border-gray-400`}
                style={{
                  left: `${segmentLeft}px`,
                  width: `${segmentWidth}px`,
                }}
              >
                {segmentWidth > 50 && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs">
                    {segment.type === 'silence' ? 'Silence' : 'Audio'}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" 
            style={{ left: '100px' }}
          >
            <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1"></div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <div>00:00.00</div>
        <div>{formatTime(totalDuration)}</div>
      </div>
    </div>
  );
};

export default Timeline;
