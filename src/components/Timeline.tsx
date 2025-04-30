import { audioBufferToWavBlob } from "@/lib/audioUtils";

interface TimelineProps {
  audioBuffer?: AudioBuffer | null;
  regions?: { start: number; end: number }[];
  appliedPlaybackRate?: number | null;
  targetDuration?: number | null;
  preservePitch?: boolean;
  currentProcessedDuration?: number | null;
}

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

import { Play, Pause, Trash2, CornerDownLeft, CornerUpRight, X } from 'lucide-react';

// Define type for WaveSurfer region
import { type Region } from 'wavesurfer.js/dist/plugins/regions';

// Import the Handle type from AppInterface
import { type TimelineHandle } from "./AppInterface";

// Wrap component definition with forwardRef
const Timeline = forwardRef<TimelineHandle, TimelineProps>(({ 
    audioBuffer, 
    regions, 
    appliedPlaybackRate,
    targetDuration, 
    preservePitch, 
    currentProcessedDuration 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(50);
  const [isWaveSurferReady, setIsWaveSurferReady] = useState(false);
  const [currentRegions, setCurrentRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  
  // --- State and Refs for Mark In/Out ---
  const [markInPoint, setMarkInPoint] = useState<number | null>(null);
  const [markOutPoint, setMarkOutPoint] = useState<number | null>(null);
  const lastInteractionTimeRef = useRef<number | null>(null); // Store latest interaction time via Ref
  
  // --- State for Time Display ---
  const [displayCurrentTime, setDisplayCurrentTime] = useState<number>(0);
  const [displayTotalDuration, setDisplayTotalDuration] = useState<number>(0);
  // ---------------------------

  const MARKER_COLOR = 'rgba(255, 0, 0, 0.9)'; // Solid Red for markers
  const SELECTION_COLOR = 'rgba(255, 255, 0, 0.3)'; // Yellow for selection
  const DELETED_MARKER_COLOR = 'rgba(50, 50, 50, 0.7)'; // Dark Grey for deleted sections
  const MARKER_ID_PREFIX = '__marker__';
  const SELECTION_REGION_ID = '__selection__';
  const DELETED_REGION_ID_PREFIX = '__deleted__'; // For manually deleted regions

  // Function to update regions state
  const updateRegionsState = () => {
    if (regionsPluginRef.current) {
      setCurrentRegions(regionsPluginRef.current.getRegions());
    }
  };

  useEffect(() => {
    // Log when the effect runs and the state of its dependencies
    console.log(`[Effect Run] audioBuffer exists: ${!!audioBuffer}, regions prop length: ${regions ? regions.length : 'undefined'}`);

    if (!audioBuffer || !containerRef.current) {
        console.log('[Effect] Bailing: No audio buffer or container ref.');
        return;
    }

    setIsWaveSurferReady(false);
    setSelectedRegionId(null); // Clear selection on new buffer
    setCurrentRegions([]); // Clear regions state
    setMarkInPoint(null); // Clear markers
    setMarkOutPoint(null);
    lastInteractionTimeRef.current = null; // Clear ref

    if (wavesurferRef.current) {
      console.log('[Effect] Destroying previous wavesurfer instance.');
      wavesurferRef.current.destroy();
      wavesurferRef.current = null; // Explicitly nullify
    }

    // --- Create Regions Plugin Instance --- 
    const rs = RegionsPlugin.create(/* Options passed later */);
    regionsPluginRef.current = rs; // Store instance

    // --- Regions Plugin Event Listeners --- 
    rs.on('region-created', (region) => {
      console.log('Region created:', region);
      updateRegionsState();
      setSelectedRegionId(region.id);
    });
    rs.on('region-updated', (region) => {
      console.log('Region updated:', region);
      updateRegionsState();
    });
    rs.on('region-removed', (region) => {
      console.log('Region removed:', region);
      if (selectedRegionId === region.id) {
        setSelectedRegionId(null); // Clear selection if deleted
      }
      updateRegionsState();
    });
    rs.on('region-clicked', (region, e) => {
      e.stopPropagation(); // Prevent triggering 'seek'
      setIsPlaying(false); // Stop playback
      wavesurferRef.current?.pause();
      setSelectedRegionId(region.id);
      console.log('Region clicked:', region.id);
    });
     // Clear selection when clicking outside a region
    rs.on('region-out', (region) => {
        if (selectedRegionId === region.id) {
             setSelectedRegionId(null);
             console.log("Deselected region:", region.id)
        }
    });

    // Create WaveSurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#A8A8A8',
      progressColor: '#6366f1',
      height: 100,
      interact: true, // Allow seeking by clicking waveform
      cursorColor: '#111827',
      barWidth: 2,
      barGap: 2,
      plugins: [
        rs // Add Regions plugin instance here
      ],
    });
    wavesurferRef.current = ws;

    // Convert AudioBuffer to WAV Blob using utility function
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    
    // Event listeners for play/pause state must be set BEFORE loading
    ws.on('play', () => {
        setIsPlaying(true);
        lastInteractionTimeRef.current = null; // Clear ref
        // Start timer updates if playing
        setDisplayCurrentTime(ws.getCurrentTime());
    });
    ws.on('pause', () => {
        setIsPlaying(false);
         // Ensure time updates when paused
        setDisplayCurrentTime(ws.getCurrentTime());
    });
    ws.on('finish', () => {
        setIsPlaying(false);
        // Set time to end when finished
        setDisplayCurrentTime(ws.getDuration() ?? 0);
    });

    // Listen for user interaction to get accurate time when paused
    ws.on('interaction', (newTime) => {
        console.log(`[Interaction Event] Time: ${newTime}`);
        lastInteractionTimeRef.current = newTime; // Update Ref directly
    });

    // Update display time on seek and audioprocess
    ws.on('seeking', (newTime) => {
        console.log(`[Seeking Event] Time: ${newTime}`);
        setSelectedRegionId(null);
        clearMarkPoints(); // Clear visual markers
        lastInteractionTimeRef.current = null; // Clear ref
        setDisplayCurrentTime(newTime);
    });
     ws.on('audioprocess', (currentTime) => {
         // Update display time during playback
         setDisplayCurrentTime(currentTime);
         // Also run skip logic
         skipDeletedRegions(currentTime);
     });
     // Remove previous separate audioprocess listener for skip logic
     // ws.on('audioprocess', skipDeletedRegions);

    // --- Playback Skipping Logic --- 
    const skipDeletedRegions = (currentTime: number) => {
        if (!regionsPluginRef.current || !wavesurferRef.current) return;
        const ws = wavesurferRef.current;
        const deletedRegions = regionsPluginRef.current.getRegions()
            .filter(r => r.id.startsWith(DELETED_REGION_ID_PREFIX) || (r as any).data?.deleted)
            .sort((a, b) => a.start - b.start); // Sort by start time

        for (const deletedRegion of deletedRegions) {
            // Is the current time INSIDE this deleted region?
            if (currentTime >= deletedRegion.start && currentTime < deletedRegion.end) {
                console.log(`[Playback Skip] Current time ${currentTime} is inside deleted region ${deletedRegion.id} (${deletedRegion.start} - ${deletedRegion.end}). Skipping to ${deletedRegion.end}`);
                // Immediately seek to the end of the deleted region
                ws.setTime(deletedRegion.end);
                // Try forcing a pause/play cycle to reduce skip delay
                ws.pause(); 
                setTimeout(() => ws.play(), 0); 
                break; // Skip checking other regions once we jump
            }
        }
    };
    // Add listener
    ws.on('audioprocess', skipDeletedRegions);
    // -------------------------------

    // Load the audio
    ws.loadBlob(wavBlob);

    // --- Wait for audio to be ready before interacting --- 
    ws.on('ready', () => {
      console.log('WaveSurfer is ready!');
      setDisplayCurrentTime(0); // Reset current time
      ws.zoom(zoomLevel);
      setIsWaveSurferReady(true);

      // Add initial silence regions if provided (also needs to wait for ready)
      console.log(`[Ready] Checking condition: regions provided? ${regions && regions.length > 0}, plugin ref exists? ${!!regionsPluginRef.current}`); // Log before check
      if (regions && regions.length > 0 && regionsPluginRef.current) {
          const regionsPlugin = regionsPluginRef.current;
          console.log(`[Ready] Adding ${regions.length} initial regions...`);
          regionsPlugin.clearRegions(); 
          regions.forEach(regionData => {
            console.log(`[Ready] Attempting to add region: start=${regionData.start}, end=${regionData.end}`);
            const newRegion = regionsPlugin.addRegion({
                start: regionData.start,
                end: regionData.end,
                color: 'rgba(255,0,0,0.25)', // Red for silence
            drag: true,
            resize: true,
            });
            // Assign data after creation, using type assertion
            (newRegion as any).data = { type: 'silence' };
          });
          updateRegionsState(); // Update state after adding initial regions
          // Log regions right after adding
          console.log('[Ready] Regions immediately after add loop:', regionsPlugin.getRegions().map(r => r.id)); 
      } else {
        console.warn("Initial regions not provided or Regions plugin not found.");
      }
    });

    ws.on('error', (err) => {
        console.error('WaveSurfer error:', err);
    });

    return () => {
      // Log cleanup
      console.log(`[Effect Cleanup] Destroying wavesurfer instance.`);
      // Remove listeners
      ws.un('audioprocess', skipDeletedRegions); // Ensure old one is removed if applicable
      // ws.un('audioprocess', timeUpdateHandler); // Need to handle combined listener cleanup
      ws.destroy();
      // Avoid race conditions: only nullify if it's the current instance
      if (wavesurferRef.current === ws) { 
      wavesurferRef.current = null;
        regionsPluginRef.current = null; 
      }
    };
  }, [audioBuffer]); // ONLY rerun when the audio buffer itself changes

  // Update zoom when slider changes
  useEffect(() => {
    if (wavesurferRef.current && isWaveSurferReady) { 
      wavesurferRef.current.zoom(zoomLevel);
    }
  }, [zoomLevel, isWaveSurferReady]);

  // --- Effect to Add Auto-Detected Silence Regions from props ---
  useEffect(() => {
    // This effect now ONLY adds the auto-detected regions from the prop
    // It DOES NOT handle styling anymore.
    if (!isWaveSurferReady || !regionsPluginRef.current) return;
    
    console.log("[Auto Regions Effect] Running. Regions prop length:", regions?.length);
    const regionsPlugin = regionsPluginRef.current;
    
    // Clear existing AUTO regions (assuming they have data.type === 'silence')
    regionsPlugin.getRegions().forEach(existingRegion => {
      if ((existingRegion as any).data?.type === 'silence') {
        console.log(`[Auto Regions Effect] Removing previous auto region: ${existingRegion.id}`);
        existingRegion.remove(); 
      }
    });

    // Add new regions from the prop, marking them as silence
    if (regions && regions.length > 0) {
      console.log(`[Auto Regions Effect] Adding ${regions.length} new auto regions...`);
      regions.forEach(regionData => {
        const newRegion = regionsPlugin.addRegion({
            // Use specific prefix for auto regions?
            // id: `__auto_silence__${regionData.start}`, 
            start: regionData.start,
            end: regionData.end,
            color: DELETED_MARKER_COLOR, // Add them directly as greyed out/deleted
            drag: false, // Make them non-interactive initially
            resize: false,
        });
        (newRegion as any).data = { type: 'silence', deleted: true }; // Mark as deleted
        console.log(`[Auto Regions Effect] Added new auto region: ${newRegion.id}`);
      });
    }
    updateRegionsState();
  }, [regions, isWaveSurferReady]); // Rerun ONLY when regions prop or ready state changes

  // --- Effect to update region APPEARANCE (Hiding deleted) --- 
  useEffect(() => {
    if (!regionsPluginRef.current || !isWaveSurferReady || !audioBuffer) return; // Added audioBuffer check
    
    const plugin = regionsPluginRef.current;
    const allRegions = plugin.getRegions();
    const originalDuration = audioBuffer.duration; // Get original duration
    let totalDeletedDuration = 0;
    console.log(`[Region Style Effect] Running. Triggered by change in: ${JSON.stringify({ regions: regions?.length, currentRegions: currentRegions?.length, isReady: isWaveSurferReady, buffer: !!audioBuffer })}. Original Duration: ${originalDuration.toFixed(2)}s`);
    
    allRegions.forEach(region => {
      // Apply specific styling to deleted regions
      const isDeleted = region.id.startsWith(DELETED_REGION_ID_PREFIX) || (region as any).data?.deleted;
      let targetColor = region.color; // Default to current color
      let isStyled = false; // Track if style was potentially changed

      if (isDeleted) {
          targetColor = DELETED_MARKER_COLOR;
          totalDeletedDuration += (region.end - region.start); // Accumulate deleted duration
          region.setOptions({ color: targetColor, drag: false, resize: false });
          isStyled = true;
      } else if (region.id.startsWith(MARKER_ID_PREFIX)) {
          targetColor = MARKER_COLOR;
          region.setOptions({ color: targetColor, drag: false, resize: false });
          isStyled = true;
      } else if (region.id === SELECTION_REGION_ID) {
          targetColor = SELECTION_COLOR;
          region.setOptions({ color: targetColor, drag: false, resize: false });
          isStyled = true;
      } else if ((region as any).data?.type === 'silence') {
          // Ensure non-deleted silence regions are correct color
          targetColor = 'rgba(255,0,0,0.25)'; 
          region.setOptions({ color: targetColor }); // Should still allow drag/resize if not deleted
          isStyled = true;
      } 
      // else: Manually added regions keep their default color unless deleted

      // Optional: Log style changes if needed
      // if (isStyled && region.color !== targetColor) { ... }
    });
    
    // Update total duration display
    const newEffectiveDuration = Math.max(0, originalDuration - totalDeletedDuration);
    console.log(`[Region Style Effect] Total Deleted: ${totalDeletedDuration.toFixed(2)}s, New Effective Duration: ${newEffectiveDuration.toFixed(2)}s`);
    // Only update state if the value has actually changed to prevent potential loops
    if (newEffectiveDuration !== displayTotalDuration) {
        setDisplayTotalDuration(newEffectiveDuration);
    }

  }, [regions, currentRegions, isWaveSurferReady, audioBuffer]); // ADDED `regions` prop dependency

  // --- Effect to Update Displayed Total Duration --- 
  useEffect(() => {
    if (!audioBuffer || !isWaveSurferReady) {
        setDisplayTotalDuration(0);
        return;
    }

    const originalDuration = audioBuffer.duration;
    let totalDeletedDuration = 0;

    // Calculate duration of deleted regions (manual or auto)
    // Use currentRegions state which is updated by the plugin listeners
    currentRegions.forEach(region => {
        const isDeleted = region.id.startsWith(DELETED_REGION_ID_PREFIX) || (region as any).data?.deleted;
        if (isDeleted) {
            totalDeletedDuration += (region.end - region.start);
        }
    });

    const effectiveDurationBeforeRate = Math.max(0, originalDuration - totalDeletedDuration);
    
    // Apply playback rate adjustment
    const rate = appliedPlaybackRate && appliedPlaybackRate > 0 ? appliedPlaybackRate : 1.0;
    const finalDisplayDuration = effectiveDurationBeforeRate / rate;

    // Detailed Log:
    console.log(`[Duration Effect] Triggered. Rate Prop: ${appliedPlaybackRate?.toFixed(3) ?? 'N/A'}, Original: ${originalDuration.toFixed(3)}, Deleted: ${totalDeletedDuration.toFixed(3)}, EffectivePreRate: ${effectiveDurationBeforeRate.toFixed(3)}, FinalCalc: ${finalDisplayDuration.toFixed(3)}, CurrentState: ${displayTotalDuration.toFixed(3)}`);
    
    // Only update if significantly different to avoid minor floating point loops
    if (Math.abs(finalDisplayDuration - displayTotalDuration) > 0.001) { 
        console.log(`[Duration Effect] Updating displayTotalDuration from ${displayTotalDuration.toFixed(3)} to ${finalDisplayDuration.toFixed(3)}`);
        setDisplayTotalDuration(finalDisplayDuration);
    } else {
        console.log(`[Duration Effect] No significant change detected, not updating state.`);
    }
  }, [audioBuffer, isWaveSurferReady, currentRegions, appliedPlaybackRate]); // Dependencies
  // --------------------------------------------------

  // --- Effect to control Playback Rate for Preview --- 
  useEffect(() => {
      if (!wavesurferRef.current || !isWaveSurferReady || !audioBuffer) return;
      const ws = wavesurferRef.current;

      let calculatedRate = 1.0;
      if (targetDuration && targetDuration > 0 && currentProcessedDuration && currentProcessedDuration > 0) {
          // Calculate rate needed to hit target duration
          // Only speed up if current > target, otherwise rate remains 1
          if (currentProcessedDuration > targetDuration) {
              calculatedRate = currentProcessedDuration / targetDuration;
              // Optional: Add sanity check / cap for maximum speedup?
              // calculatedRate = Math.min(calculatedRate, 4.0); // e.g., Max 4x speed
              console.log(`[Playback Rate] Target: ${targetDuration.toFixed(2)}s, Current Est: ${currentProcessedDuration.toFixed(2)}s => Rate: ${calculatedRate.toFixed(2)}x`);
          } else {
              console.log(`[Playback Rate] Target: ${targetDuration.toFixed(2)}s >= Current Est: ${currentProcessedDuration.toFixed(2)}s. Rate: 1.0x`);
              calculatedRate = 1.0;
          }
      } else {
           console.log(`[Playback Rate] Target duration not set or invalid. Rate: 1.0x`);
           calculatedRate = 1.0;
      }

      // Apply the calculated rate and pitch setting
      ws.setPlaybackRate(calculatedRate, preservePitch ?? true);

  }, [targetDuration, preservePitch, currentProcessedDuration, isWaveSurferReady, audioBuffer]);
  const handleMark = () => {
    if (!wavesurferRef.current || !regionsPluginRef.current) return;

    // --- Determine time (Prioritize Interaction Ref Time) ---
    let timeToMark: number | null = null;
    const ws = wavesurferRef.current;
    if (lastInteractionTimeRef.current !== null) {
        timeToMark = lastInteractionTimeRef.current;
        console.log(`[Mark] Using time from interaction ref: ${timeToMark}`);
        lastInteractionTimeRef.current = null; // Consume interaction time
    } else {
        timeToMark = ws.getCurrentTime();
        console.log(`[Mark] Using time from getCurrentTime(): ${timeToMark}`);
    }
    if (timeToMark === null) return;
    // ----------------------------------

    const plugin = regionsPluginRef.current;
    removeVisualMarkers(); // Remove previous markers/selection

    if (markInPoint === null || markOutPoint !== null) { // Set START point (or restart)
        setMarkInPoint(timeToMark);
        setMarkOutPoint(null);
        plugin.addRegion({ id: `${MARKER_ID_PREFIX}start`, start: timeToMark, end: timeToMark, color: MARKER_COLOR, drag: false, resize: false }); 
        console.log("Marked Start:", timeToMark);
    } else { // Set END point (markIn is set, markOut is null)
        let endPoint = timeToMark;
        if (endPoint < markInPoint) { 
            console.warn("End point must be after start point. Clearing Start Point.");
            setMarkInPoint(null); 
            setMarkOutPoint(null);
            return; 
        }
        setMarkOutPoint(endPoint);
        plugin.addRegion({ id: `${MARKER_ID_PREFIX}start`, start: markInPoint, end: markInPoint, color: MARKER_COLOR, drag: false, resize: false }); // Re-add start marker
        plugin.addRegion({ id: `${MARKER_ID_PREFIX}end`, start: endPoint, end: endPoint, color: MARKER_COLOR, drag: false, resize: false });
        console.log("Marked End:", endPoint);
        // Create yellow selection region 
        plugin.addRegion({
            id: SELECTION_REGION_ID,
            start: markInPoint,
            end: endPoint,
            color: SELECTION_COLOR,
            drag: false,
            resize: false,
        });
        console.log(`Created selection region from ${markInPoint} to ${endPoint}`);
    } 
  };

  const removeVisualMarkers = () => {
       if (regionsPluginRef.current) {
            regionsPluginRef.current.getRegions().forEach(r => {
                if (r.id.startsWith(MARKER_ID_PREFIX) || r.id === SELECTION_REGION_ID) {
                    r.remove();
                }
            });
       }
  };

  const clearMarkPoints = () => {
      setMarkInPoint(null);
      setMarkOutPoint(null);
      lastInteractionTimeRef.current = null; // Clear interaction ref
      removeVisualMarkers();
      console.log("Cleared Mark Points (State & Visuals)");
   };

  // --- Delete Handler --- 
  const handleDeleteMarkedSection = () => {
      if (markInPoint !== null && markOutPoint !== null && regionsPluginRef.current) {
          const start = markInPoint;
          const end = markOutPoint;
          console.log(`[Delete] Adding deleted region for range: ${start} to ${end}`);
          
          // Add a new region specifically for the deleted range
          const deletedRegion = regionsPluginRef.current.addRegion({
              id: `${DELETED_REGION_ID_PREFIX}${Date.now()}`, // Unique ID
              start: start,
              end: end,
              color: DELETED_MARKER_COLOR,
              drag: false,
              resize: false,
              // Optional: make it shorter or styled differently
              // height: 0.5, // Example: 50% height
          });
          // Mark data after creation
          (deletedRegion as any).data = { deleted: true }; // Ensure manual deletes are marked

          // We no longer add to deletedRanges state, the region itself marks the deletion
          clearMarkPoints(); // Clear In/Out state and visual markers/selection
      } else {
          console.warn("[Delete] No complete In/Out range selected.")
      }
  };

  // --- Expose Reset Function via Ref --- 
  useImperativeHandle(ref, () => ({
    resetTimeline: () => {
        console.log("[Timeline] Reset called via ref.");
        setMarkInPoint(null);
        setMarkOutPoint(null);
        lastInteractionTimeRef.current = null;
        if (regionsPluginRef.current) {
            const plugin = regionsPluginRef.current;
            const regionsToRemove = plugin.getRegions().filter(r => 
                r.id.startsWith(MARKER_ID_PREFIX) || 
                r.id === SELECTION_REGION_ID || 
                r.id.startsWith(DELETED_REGION_ID_PREFIX) || 
                (r as any).data?.deleted
            );
            console.log("[Timeline Reset] Removing regions:", regionsToRemove.map(r=>r.id));
            regionsToRemove.forEach(r => r.remove());
            // We might need to also remove auto-regions if they aren't cleared by prop update
             plugin.getRegions().filter(r => (r as any).data?.type === 'silence').forEach(r => r.remove());
        }
        updateRegionsState(); // Update internal region list
    },
    getDeletedRegions: (): { start: number; end: number }[] => {
        if (!regionsPluginRef.current) {
            console.warn("[getDeletedRegions] Regions plugin not ready.");
            return [];
        }
        const deletedRegions = regionsPluginRef.current.getRegions()
            .filter(r => r.id.startsWith(DELETED_REGION_ID_PREFIX) || (r as any).data?.deleted)
            .map(r => ({ start: r.start, end: r.end }));
        console.log("[getDeletedRegions] Returning deleted regions:", deletedRegions);
        return deletedRegions;
    }
  }));
  // -------------------------------------

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
          lastInteractionTimeRef.current = null; // Clear interaction ref on play/pause toggle
      wavesurferRef.current.playPause();
    }
  };

  // Helper to format time (MM:SS.ms)
  const formatTime = (timeSeconds: number): string => {
      const minutes = Math.floor(timeSeconds / 60);
      const seconds = Math.floor(timeSeconds % 60);
      const milliseconds = Math.floor((timeSeconds * 1000) % 1000);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  // --- Component Return --- 
  return (
    <div className="w-full bg-gray-100 rounded-lg flex flex-col items-center p-4 shadow-inner">
      {audioBuffer ? (
        <>
          {/* Added overflow-x-auto for panning */}
          <div ref={containerRef} className="w-full bg-white rounded border border-gray-300 overflow-x-auto" style={{ minHeight: 100 }} />
          
          {/* Controls Row 1: Playback, Time & Zoom */}
          <div className="flex items-center gap-4 mt-4 w-full">
            <Button onClick={handlePlayPause} variant="outline" size="icon" title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            {/* Time Display */}
            <div className="text-sm font-mono text-gray-700">
                <span>{formatTime(displayCurrentTime)}</span> / <span>{formatTime(displayTotalDuration)}</span>
            </div>

            {/* Zoom Slider */}
            <div className="flex items-center gap-2 flex-grow justify-end"> { /* Pushed to end */}
                <span className="text-sm font-medium text-gray-600">Zoom:</span>
                <Slider
                    min={10} // Minimum pixels per second
                    max={500} // Increased max zoom
                    step={1}
                    value={[zoomLevel]}
                    onValueChange={(value) => setZoomLevel(value[0])}
                    className="w-full max-w-xs"
                    disabled={!isWaveSurferReady}
                />
            </div>
          </div>

          {/* Controls Row 2: Mark & Delete */}
          <div className="flex items-center gap-2 mt-2 w-full flex-wrap">
             {/* Mark In/Out Button */} 
             <Button 
                onClick={handleMark} 
                variant="outline" 
                size="sm" 
                disabled={!isWaveSurferReady}
                title={markInPoint === null || markOutPoint !== null ? "Mark In Point" : "Mark Out Point"}
              >
                {markInPoint === null || markOutPoint !== null ? <CornerDownLeft className="h-4 w-4 mr-1" /> : <CornerUpRight className="h-4 w-4 mr-1" />}
                {markInPoint === null || markOutPoint !== null ? "Mark In" : "Mark Out"}
              </Button>
              
              {/* Delete Marked Button */} 
              <Button 
                onClick={handleDeleteMarkedSection}
                variant="destructive" 
                size="sm" 
                disabled={!(markInPoint !== null && markOutPoint !== null) || !isWaveSurferReady}
                title={markInPoint !== null && markOutPoint !== null ? "Delete Section Between In/Out Marks" : "Mark In and Out points first"}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete Mark
              </Button>

              {/* Clear Marks Button */}
               <Button 
                onClick={clearMarkPoints}
                variant="ghost" 
                size="sm" 
                disabled={markInPoint === null}
                title="Clear In/Out Marks"
              >
                <X className="h-4 w-4 mr-1" /> Clear Marks
              </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-32">
            <span className="text-gray-500">Load a file to see the timeline</span>
        </div>
      )}
    </div>
  );
});

export default Timeline;
