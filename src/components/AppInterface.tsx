import { useState, useRef, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Scissors, Download, Settings, ArrowLeft, Upload, RotateCcw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Timeline from "./Timeline";
import { audioBufferToWavBlob } from "@/lib/audioUtils";

// --- Define Ref Handle Type for Timeline ---
export interface TimelineHandle {
  resetTimeline: () => void;
}
// ------------------------------------------

interface AppInterfaceProps {
  onBack: () => void;
}

// --- Define Type for Persisted State ---
interface PersistedAppState {
  thresholdDb?: number[];
  minDuration?: number[];
  leftPadding?: number[];
  rightPadding?: number[];
  paddingLinked?: boolean;
  regions?: { start: number; end: number }[];
  targetDuration?: number | null;
  appliedPlaybackRate?: number | null;
  exportAsSections?: boolean;
  // Note: We don't store hasFile or audioBuffer, user must reload file
}
// ------------------------------------

const AppInterface = ({ onBack }: AppInterfaceProps) => {
  // --- State Initialization with localStorage --- 
  const [initialStateLoaded, setInitialStateLoaded] = useState(false);
  const loadState = (): PersistedAppState | null => {
    try {
      const savedState = localStorage.getItem('slicrAppState'); // Renamed key
      if (savedState) {
        console.log("[State Load] Found saved state.");
        return JSON.parse(savedState) as PersistedAppState;
      } else {
        console.log("[State Load] No saved state found.");
      }
    } catch (error) {
      console.error("[State Load] Error loading or parsing state:", error);
      localStorage.removeItem('slicrAppState'); // Clear corrupted state
    }
    return null;
  };

  const initialSavedState = loadState();

  const [activeTab, setActiveTab] = useState("silence");
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);
  const [thresholdDb, setThresholdDb] = useState<number[]>(initialSavedState?.thresholdDb ?? [-40]);
  const [minDuration, setMinDuration] = useState<number[]>(initialSavedState?.minDuration ?? [0.2]);
  const [leftPadding, setLeftPadding] = useState<number[]>(initialSavedState?.leftPadding ?? [0.0332]);
  const [rightPadding, setRightPadding] = useState<number[]>(initialSavedState?.rightPadding ?? [0.0332]);
  const [paddingLinked, setPaddingLinked] = useState<boolean>(initialSavedState?.paddingLinked ?? true);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportProcessing, setIsExportProcessing] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [regions, setRegions] = useState<{ start: number; end: number }[]>(initialSavedState?.regions ?? []);
  const timelineRef = useRef<TimelineHandle>(null);
  const [exportAsSections, setExportAsSections] = useState<boolean>(initialSavedState?.exportAsSections ?? false);
  
  // --- State for Target Duration Feature ---
  const [targetDuration, setTargetDuration] = useState<number | null>(initialSavedState?.targetDuration ?? null);
  const [currentProcessedDuration, setCurrentProcessedDuration] = useState<number | null>(null);
  const [appliedPlaybackRate, setAppliedPlaybackRate] = useState<number | null>(initialSavedState?.appliedPlaybackRate ?? null);
  const [displayEstimatedDuration, setDisplayEstimatedDuration] = useState<number | null>(null);
  // ----------------------------------------

  // --- Audio Context State ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  // ---------------------------------------

  // --- Recalculate Processed Duration --- 
  // This needs access to *all* deleted regions (manual+auto), which is currently
  // a limitation. We'll estimate based on the `regions` state for now.
  // TODO: Refactor state to get accurate deleted regions from Timeline.
  useEffect(() => {
      if (audioBuffer) {
          const regionsToCut = regions.sort((a, b) => a.start - b.start);
          let totalCutDuration = 0;
          regionsToCut.forEach(region => {
              totalCutDuration += (region.end - region.start);
          });
          const estimatedDuration = audioBuffer.duration - totalCutDuration;
          setCurrentProcessedDuration(Math.max(0, estimatedDuration));
          // Initialize display duration based on current rate (usually 1.0 initially)
          setDisplayEstimatedDuration(Math.max(0, estimatedDuration) / (appliedPlaybackRate || 1.0));
          console.log(`[Duration Calc] Estimated processed duration: ${estimatedDuration.toFixed(2)}s`);
      } else {
          setCurrentProcessedDuration(null);
          setDisplayEstimatedDuration(null);
      }
  }, [regions, audioBuffer]);
  // -----------------------------------

  // --- Effect to update Display Duration when Rate Changes ---
  useEffect(() => {
      if (currentProcessedDuration !== null && appliedPlaybackRate !== null && appliedPlaybackRate > 0) {
          setDisplayEstimatedDuration(currentProcessedDuration / appliedPlaybackRate);
      } else {
          // If rate is removed or invalid, display matches the pre-rate duration
          setDisplayEstimatedDuration(currentProcessedDuration);
      }
  }, [currentProcessedDuration, appliedPlaybackRate]);
  // ---------------------------------------------------------

  // --- Effect to Save State to localStorage ---
  useEffect(() => {
    // Don't save until initial load is done to avoid overwriting with defaults immediately
    if (!initialStateLoaded) {
        // Mark initial load complete after first render cycle completes
        const timer = setTimeout(() => setInitialStateLoaded(true), 0);
        return () => clearTimeout(timer);
    }
    
    const stateToSave: PersistedAppState = {
      thresholdDb,
      minDuration,
      leftPadding,
      rightPadding,
      paddingLinked,
      regions, // Save auto-detected regions
      targetDuration,
      appliedPlaybackRate,
      exportAsSections,
    };
    try {
      console.log("[State Save] Saving state to localStorage...");
      localStorage.setItem('slicrAppState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error("[State Save] Error saving state:", error);
      // Handle potential storage errors (e.g., quota exceeded)
    }
  }, [
    thresholdDb,
    minDuration,
    leftPadding,
    rightPadding,
    paddingLinked,
    regions,
    targetDuration,
    appliedPlaybackRate,
    exportAsSections,
    initialStateLoaded // Include to trigger save after initial load
  ]);
  // ------------------------------------------

  // --- Apply Speed Adjustment Handler ---
  const handleApplySpeedAdjustment = () => {
      if (!currentProcessedDuration || !targetDuration || targetDuration <= 0) {
          toast({ title: "Error", description: "Cannot apply speed adjustment without valid current and target durations.", variant: "destructive"});
          return;
      }
      
      const playbackRate = currentProcessedDuration / targetDuration;
      setAppliedPlaybackRate(playbackRate);
      // Store pitch setting implicitly via state
      console.log(`[Speed Adjust] Applied. Rate: ${playbackRate.toFixed(3)} (Current: ${currentProcessedDuration.toFixed(2)}s, Target: ${targetDuration}s)`);
      toast({
          title: "Speed Adjustment Applied",
          description: `Timeline preview rate set to ${playbackRate.toFixed(2)}x. Export will reflect this change.`,
      });
      
      // TODO: Communicate 'playbackRate' to the Timeline component 
      // This might involve passing it as a prop or using a ref method.
      // Example using prop: <Timeline ... appliedPlaybackRate={appliedPlaybackRate} />
  };
  // ------------------------------------

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files);
    }
  };

  const handleFile = async (files: FileList) => {
  setIsProcessing(true);
  const file = files[0];
  toast({
    title: "File received",
    description: `Processing ${file.name}...`,
  });

  if (file.type.startsWith("audio/")) {
    try {
      // --- Initialize Audio Context on file load (requires user interaction) ---
      const audioCtx = await initializeAudio();
      if (!audioCtx) {
          throw new Error("AudioContext could not be initialized.");
      }
      // -----------------------------------------------------------------------
      const arrayBuffer = await file.arrayBuffer();
      // Use the initialized context
      const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedAudio);
      setHasFile(true);
      toast({
        title: "Processing complete!",
        description: "Your audio file is ready for editing.",
      });
    } catch (err) {
      console.error("Audio Decode Error:", err);
      toast({
        title: "Error",
        description: "Failed to decode audio file.",
        variant: "destructive",
      });
    }
    setIsProcessing(false);
  } else {
    // For video: fallback to previous simulation for now
    setTimeout(() => {
      setIsProcessing(false);
      setHasFile(true);
      toast({
        title: "Processing complete!",
        description: "Your file is ready for editing.",
      });
    }, 2000);
  }
};

  const handleExport = () => {
    toast({
      title: "Exporting!",
      description: "Your file is being exported...",
    });
    
    // Simulate export
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: "Your file has been successfully exported.",
      });
    }, 2000);
  };

  const handleRemoveSilence = () => {
    toast({
      title: "Processing",
      description: "Removing silence from your video...",
    });
    
    // Simulate processing
    setTimeout(() => {
      toast({
        title: "Success!",
        description: "Silence has been removed from your video.",
      });
    }, 1500);
  };

  // Silence detection: Updated to take dBFS threshold
  function detectSilence(
      buffer: AudioBuffer, 
      thresholdDbValue: number, // Now expects dBFS
      minDuration: number, 
      paddingStart: number, 
      paddingEnd: number
  ): {start: number, end: number}[] {
    // Convert dBFS threshold to amplitude (0-1 range)
    // Ensure thresholdDbValue is <= 0 for valid conversion
    const amplitudeThreshold = thresholdDbValue <= 0 ? Math.pow(10, thresholdDbValue / 20) : 1;
    console.log(`[detectSilence] dBFS Threshold: ${thresholdDbValue} -> Amplitude Threshold: ${amplitudeThreshold.toFixed(5)}`);

    const channel = buffer.getChannelData(0); // Use first channel for detection
    const sampleRate = buffer.sampleRate;
    const minSilenceSamples = Math.floor(minDuration * sampleRate);
    const paddingStartSamples = Math.floor(paddingStart * sampleRate);
    const paddingEndSamples = Math.floor(paddingEnd * sampleRate);

    let silences: {start: number, end: number}[] = [];
    let inSilence = false;
    let silenceStartIndex = 0;
    let i = 0;

    while (i < channel.length) {
      if (Math.abs(channel[i]) < amplitudeThreshold) {
        if (!inSilence) {
          inSilence = true;
          silenceStartIndex = i;
        }
      } else {
        if (inSilence) {
          const silenceEndIndex = i;
          const silenceDurationSamples = silenceEndIndex - silenceStartIndex;
          
          if (silenceDurationSamples >= minSilenceSamples) {
            // Apply padding: move start forward, move end backward
            // Ensure padding doesn't make start >= end or go out of bounds
            let paddedStart = silenceStartIndex + paddingStartSamples;
            let paddedEnd = silenceEndIndex - paddingEndSamples;

            // Clamp padded start/end to ensure they don't cross original silence boundary or each other
            paddedStart = Math.min(paddedStart, silenceEndIndex);
            paddedEnd = Math.max(paddedEnd, silenceStartIndex); 

            // Only add if the padded region is still valid (duration > 0)
            if (paddedEnd > paddedStart) {
                 // Check if duration after padding still meets minimum (optional, depends on desired behavior)
                 // const paddedDurationSamples = paddedEnd - paddedStart;
                 // if (paddedDurationSamples >= minSilenceSamples) { ... }
                 
                 silences.push({ 
                    start: paddedStart / sampleRate, 
                    end: paddedEnd / sampleRate 
                 });
            }
          }
          inSilence = false;
        }
      }
      i++;
    }

    // Check if ends in silence
    if (inSilence) {
      const silenceEndIndex = channel.length;
      const silenceDurationSamples = silenceEndIndex - silenceStartIndex;
      if (silenceDurationSamples >= minSilenceSamples) {
         let paddedStart = silenceStartIndex + paddingStartSamples;
         let paddedEnd = silenceEndIndex - paddingEndSamples;
         paddedStart = Math.min(paddedStart, silenceEndIndex);
         paddedEnd = Math.max(paddedEnd, silenceStartIndex); 
         if (paddedEnd > paddedStart) {
              silences.push({ 
                 start: paddedStart / sampleRate, 
                 end: paddedEnd / sampleRate 
              });
    }
      }
    }

    return silences;
  }

  // Export sliced audio based on regions
  const handleExportAudio = () => {
    if (!audioBuffer || !regions.length) return;
    regions.forEach((region, idx) => {
      const startSample = Math.floor(region.start * audioBuffer.sampleRate);
      const endSample = Math.floor(region.end * audioBuffer.sampleRate);
      const length = endSample - startSample;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const newBuffer = ctx.createBuffer(
        audioBuffer.numberOfChannels,
        length,
        audioBuffer.sampleRate
      );
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch).slice(startSample, endSample);
        newBuffer.copyToChannel(channelData, ch, 0);
      }
      // Convert to WAV Blob
      const wavBlob = audioBufferToWavBlob(newBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cut_${idx + 1}.wav`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
    toast({ title: "Exported audio cuts!" });
  };

  // Export cut list as CSV
  const handleExportCutList = () => {
    if (!regions.length) return;
    const csv = regions.map((r, i) => `${i + 1},${r.start.toFixed(3)},${r.end.toFixed(3)}`).join("\n");
    const blob = new Blob([`Index,Start,End\n${csv}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cut_list.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    toast({ title: "Exported cut list!" });
  };

  // Updated handler for the main button in the Silence tab
  const handleApplySilenceRemoval = () => {
    console.log("[ApplySilenceRemoval] Triggered."); 
    if (!audioBuffer) {
        toast({ title: "Error", description: "No audio buffer available.", variant: "destructive" });
        return;
    }
    toast({ title: "Processing Silence..." });
    // Detect silences using all current settings
    const detectedSilentRegions = detectSilence(
        audioBuffer, 
        thresholdDb[0], // Pass dB value
        minDuration[0], 
        leftPadding[0], 
        rightPadding[0]
    );
    // Update the main regions state with these results
    // These regions will be passed to Timeline and interpreted as 'deleted'
    setRegions(detectedSilentRegions);
    console.log("[ApplySilenceRemoval] Detected regions to remove:", detectedSilentRegions);
    toast({
      title: "Silence Removal Applied!",
      description: `${detectedSilentRegions.length} silent region(s) marked for removal on timeline.`,
    });
  };

  // --- Export Handlers ---

  // Helper to get final deleted regions (now represented by specific region objects)
  const getFinalDeletedRegions = (): { start: number; end: number }[] => {
      // We need access to the regions plugin instance from the Timeline component.
      // This is tricky without complex state lifting or context.
      // For now, we will assume the `regions` state holds the *initial* silence regions,
      // and we don't have access to the manually deleted regions created in Timeline.
      // TODO: Refactor state management (Context API?) to share regions plugin/deleted regions.
      
      console.warn("Export currently only considers initial silence regions due to state limitations.");
      // Return the regions generated by detectSilence (which includes padding/spikes)
      return regions; 
  };

  // Updated to handle both single file and segmented export, now with time stretching
  const handleExportSegments = async () => {
    if (!audioBuffer) {
      toast({ title: "Error", description: "No audio loaded.", variant: "destructive" });
      return;
    }
    if (isExportProcessing) {
        toast({ title: "Busy", description: "Already processing an export.", variant: "destructive"});
        return;
    }

    setIsExportProcessing(true);
    const exportType = exportAsSections ? "Segments" : "Full Processed Audio";
    toast({ title: `Exporting ${exportType}...`, description: "Processing audio, this may take a moment." });

    // Ensure Audio Context is ready before proceeding
    const audioCtx = await initializeAudio();
    if (!audioCtx) {
        toast({ title: "Error", description: "Audio engine not ready. Please try again.", variant: "destructive" });
        setIsExportProcessing(false);
        return;
    }

    // --- Define Native Speed Change Function (with pitch shift) ---
    const performNativeSpeedChange = async (inputBuffer: AudioBuffer, rate: number): Promise<AudioBuffer> => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`[Native Speed Change] Starting offline processing. Rate: ${rate}`);
                const targetLength = Math.ceil(inputBuffer.length / rate);
                const offlineCtx = new OfflineAudioContext(
                    inputBuffer.numberOfChannels,
                    targetLength,
                    inputBuffer.sampleRate
                );

                // Source node to play the original (combined) buffer
                const sourceNode = offlineCtx.createBufferSource();
                sourceNode.buffer = inputBuffer;

                // --- Apply native playbackRate --- 
                sourceNode.playbackRate.value = rate;
                console.log(`[Native Speed Change] Setting sourceNode.playbackRate.value = ${rate}`);
                // ---------------------------------

                // Connect graph: source -> destination
                sourceNode.connect(offlineCtx.destination);

                // Start processing
                sourceNode.start(0);
                const processedBuffer = await offlineCtx.startRendering();
                console.log("[Native Speed Change] Offline rendering complete.");
                resolve(processedBuffer);
            } catch (error) {
                console.error("[Native Speed Change] Error during offline processing:", error);
                reject(error);
            }
        });
    };
    // ---------------------------------------

    try {
      // TODO: This still needs the proper way to get *all* deleted regions (manual + auto)
      const regionsToCut = regions.sort((a, b) => a.start - b.start);
      const audibleSegments = calculateAudibleSegments(audioBuffer, regionsToCut);
      console.log("Calculated audible segments:", audibleSegments);

      if (exportAsSections) {
          // --- Export Each Audible Segment Separately ---
          let exportedCount = 0;
          for (let i = 0; i < audibleSegments.length; i++) {
              const seg = audibleSegments[i];
              let segmentBuffer = await extractAudioSegment(audioBuffer, seg.start, seg.end, audioCtx);
              
              // Apply native speed change if rate is set
              if (appliedPlaybackRate && appliedPlaybackRate !== 1) {
                  console.log(`[Export Segments] Applying native speed change to segment ${i+1}...`);
                  try {
                      segmentBuffer = await performNativeSpeedChange(segmentBuffer, appliedPlaybackRate);
                  } catch (processError) {
                      toast({ title: "Processing Error", description: `Failed to apply speed change to segment ${i+1}. Exporting original speed.`, variant: "destructive"});
                      // Re-extract original if processing failed
                      segmentBuffer = await extractAudioSegment(audioBuffer, seg.start, seg.end, audioCtx); 
                  }
              }

              await downloadAudioSegment(segmentBuffer, i + 1);
              exportedCount++;
          }
          toast({ title: "Segment Export Complete!", description: `${exportedCount} segments exported.` });

      } else {
          // --- Export Single Combined Audio File ---
          if (audibleSegments.length === 0) {
              toast({ title: "Export Warning", description: "No audio content remaining after cuts.", variant: "destructive" });
              setIsExportProcessing(false);
              return;
          }

          // Combine audible segments into one buffer
          let combinedBuffer = await combineAudioSegments(audioBuffer, audibleSegments, audioCtx);

          // Apply native speed change if rate is set
          if (appliedPlaybackRate && appliedPlaybackRate !== 1 && combinedBuffer) {
              console.log("[Export Full] Applying native speed change to combined audio...");
              try {
                  combinedBuffer = await performNativeSpeedChange(combinedBuffer, appliedPlaybackRate);
              } catch (processError) {
                  toast({ title: "Processing Error", description: "Failed to apply speed change to audio. Exporting original speed.", variant: "destructive"});
                  // Re-combine original if processing failed?
                  combinedBuffer = await combineAudioSegments(audioBuffer, audibleSegments, audioCtx);
              }
          }

          if (!combinedBuffer || combinedBuffer.length === 0) {
             toast({ title: "Export Warning", description: "Resulting audio has zero length after processing.", variant: "destructive" });
             setIsExportProcessing(false);
             return;
          }

          // Convert final buffer (potentially stretched) to WAV and download
          downloadCombinedAudio(combinedBuffer, "processed_audio.wav");
          toast({ title: "Export Complete!", description: "Processed audio exported as single WAV file." });
      }

    } catch (error) {
        console.error("Error during export process:", error);
        toast({ title: "Export Error", description: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
    } finally {
        setIsExportProcessing(false);
    }
  };

  // --- Refactored Helper Functions for Export ---

  // Calculates the segments of audio that are NOT deleted
  const calculateAudibleSegments = (sourceBuffer: AudioBuffer, regionsToCut: { start: number, end: number }[]) => {
    const audibleSegments: { start: number; end: number }[] = [];
    const totalDuration = sourceBuffer.duration;
    let lastEndTime = 0;

    if (regionsToCut.length === 0 || regionsToCut[0].start > 0) {
        const end = regionsToCut.length > 0 ? regionsToCut[0].start : totalDuration;
        if (end > 0) audibleSegments.push({ start: 0, end });
    }
    if (regionsToCut.length > 0) {
        lastEndTime = regionsToCut[0].end;
    }

    for (let i = 0; i < regionsToCut.length - 1; i++) {
        const start = regionsToCut[i].end;
        const end = regionsToCut[i + 1].start;
        if (end > start) audibleSegments.push({ start, end });
        lastEndTime = regionsToCut[i + 1].end;
    }

    if (lastEndTime < totalDuration) {
        audibleSegments.push({ start: lastEndTime, end: totalDuration });
    }
    return audibleSegments;
  };

  // Extracts a single segment into its own AudioBuffer
  const extractAudioSegment = async (sourceBuffer: AudioBuffer, startTime: number, endTime: number, audioCtx: AudioContext): Promise<AudioBuffer> => {
      const startSample = Math.floor(startTime * sourceBuffer.sampleRate);
      const endSample = Math.floor(endTime * sourceBuffer.sampleRate);
      const length = endSample - startSample;

      if (length <= 0) {
          // Return an empty buffer if segment is invalid
          return audioCtx.createBuffer(sourceBuffer.numberOfChannels, 0, sourceBuffer.sampleRate);
      }

      const segmentBuffer = audioCtx.createBuffer(
          sourceBuffer.numberOfChannels,
          length,
          sourceBuffer.sampleRate
      );

      for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
          const channelData = sourceBuffer.getChannelData(ch).slice(startSample, endSample);
          segmentBuffer.copyToChannel(channelData, ch, 0);
      }
      return segmentBuffer;
  };

  // Combines multiple audible segments into a single AudioBuffer
  const combineAudioSegments = async (sourceBuffer: AudioBuffer, audibleSegments: { start: number, end: number }[], audioCtx: AudioContext): Promise<AudioBuffer | null> => {
      const sampleRate = sourceBuffer.sampleRate;
      const numChannels = sourceBuffer.numberOfChannels;

      let totalCombinedLength = 0;
      for (const seg of audibleSegments) {
          totalCombinedLength += Math.max(0, Math.floor(seg.end * sampleRate) - Math.floor(seg.start * sampleRate));
      }

      if (totalCombinedLength <= 0) return null; 

      const combinedBuffer = audioCtx.createBuffer(numChannels, totalCombinedLength, sampleRate);
      let destinationOffset = 0;

      for (const seg of audibleSegments) {
          const startSample = Math.floor(seg.start * sampleRate);
          const endSample = Math.floor(seg.end * sampleRate);
          const segmentLength = endSample - startSample;

          if (segmentLength > 0) {
              for (let ch = 0; ch < numChannels; ch++) {
                  const sourceData = sourceBuffer.getChannelData(ch);
                  const segmentData = sourceData.slice(startSample, endSample);
                  combinedBuffer.copyToChannel(segmentData, ch, destinationOffset);
              }
              destinationOffset += segmentLength;
          }
      }
      return combinedBuffer;
  };

  // Downloads a given AudioBuffer as a WAV file (for segments)
  const downloadAudioSegment = async (segmentBuffer: AudioBuffer, index: number) => {
      if (!segmentBuffer || segmentBuffer.length === 0) return; 
      const wavBlob = audioBufferToWavBlob(segmentBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `segment_${index}.wav`; 
      document.body.appendChild(a);
      a.click();
      
      await new Promise(resolve => setTimeout(resolve, 100)); 
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
  };

  // Downloads a given AudioBuffer as a WAV file (for combined export)
  const downloadCombinedAudio = async (combinedBuffer: AudioBuffer, filename: string) => {
      if (!combinedBuffer || combinedBuffer.length === 0) return;
      const wavBlob = audioBufferToWavBlob(combinedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename; 
      document.body.appendChild(a);
      a.click();
      
      await new Promise(resolve => setTimeout(resolve, 100)); 
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
  };

  // --- End Refactored Helpers ---

  // --- Initialize Audio Context ---
  // Needs to be triggered AFTER user interaction (e.g., file drop/select)
  // Simplified: Only creates the main AudioContext now.
  const initializeAudio = async () => {
    if (!audioCtxRef.current) {
        try {
            console.log("[Audio Init] Creating AudioContext...");
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = context;
            // Removed worklet loading logic
            return context;
        } catch (err) {
            console.error("[Audio Init] Failed to initialize AudioContext:", err);
            toast({ 
                title: "Audio Engine Error", 
                description: "Could not initialize audio processing. Please try reloading.", 
                variant: "destructive"
            });
            return null;
        }
    }
    return audioCtxRef.current;
  };
  // -----------------------------------------------

  // --- Reset Handler ---
  const handleReset = () => {
      console.log("[Reset] Triggered.");
      // Clear auto-detected regions state
      setRegions([]); 
      // Clear speed adjustment state
      setAppliedPlaybackRate(null);
      // Reset display duration to match current processed duration
      setDisplayEstimatedDuration(currentProcessedDuration);
      // Call reset function on Timeline component via ref
      timelineRef.current?.resetTimeline();
      // Optionally reset sliders to default values
      // setThreshold([0.019]);
      // setMinDuration([0]);
      // setLeftPadding([0.0332]);
      // setRightPadding([0.0332]);
      // setAudioSpikes([0]);
      // setPaddingLinked(true);
      toast({ title: "Timeline Reset", description: "Deletions and markers cleared." });
  };

  // Debug Log for Export Button State (moved outside return)
  console.log("[Render] Export Button Disabled Check:", 
      { hasFile, audioBuffer: !!audioBuffer, isExportProcessing },
      "Disabled should be:", (!hasFile || !audioBuffer || isExportProcessing)
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* App Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onBack} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Slicr.me</h1>
          </div>
          <div className="flex items-center space-x-2">
            {/* REMOVED Save Project Button */}
            {/* <Button variant="outline" disabled={!hasFile}>
              Save Project
            </Button> */}
            {/* Keeping main Export button in header for now? User moved it below... check final location */}
            {/* <Button disabled={!hasFile} onClick={handleExport}>
              Export
            </Button> */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        {/* Left: Timeline Area */}
        <div className="md:w-2/3 flex flex-col gap-4">
          {/* File Drop Area / Timeline Display */}
          {!hasFile ? (
            <div 
              className={`bg-white rounded-lg border-2 ${
                dragActive ? "border-primary border-dashed" : "border-gray-200"
              } flex-1 flex flex-col items-center justify-center p-12`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-xl font-medium text-gray-700">Processing your file...</p>
                </div>
              ) : (
                <>
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Upload className="h-10 w-10 text-gray-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">Drop a File to Edit</h2>
                  <p className="text-gray-600 mb-8">audio or video</p>
                  <p className="text-gray-600">Or click to Browse.</p>
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                  />
                  <label 
                    htmlFor="file-upload" 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    style={{ cursor: 'pointer' }}
                  >
                    <Button variant="outline" className="mt-4">
                      Browse Files
                    </Button>
                  </label>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 flex-1 flex flex-col items-center justify-center p-8">
              <Timeline ref={timelineRef} audioBuffer={audioBuffer} regions={regions} />
            </div>
          )}
        </div>

        {/* Right: Settings Panel */}
        <div className="md:w-1/3">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {/* Updated Tabs - Only Silence Tab */}
              <Tabs defaultValue="silence" className="w-full">
                <TabsList className="w-full grid grid-cols-1">
                  <TabsTrigger value="silence" className="relative">
                    <Scissors className="h-5 w-5 mr-2" />
                    Silence Removal Settings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="silence" className="p-4">
                  <div className="space-y-6">
                    {/* Top Buttons: Remove Silence & Reset */}
                    <div className="flex justify-between items-center gap-2">
                      <Button onClick={handleApplySilenceRemoval} disabled={!hasFile || !audioBuffer} className="flex-1">
                        Apply Auto Silence Removal
                      </Button>
                      <Button onClick={handleReset} variant="outline" disabled={!hasFile}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Settings Group */}
                    <div className="border-t border-gray-200 pt-4 space-y-6">
                        {/* Threshold slider - Updated for dBFS */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Silence Threshold (dBFS)</label>
                            <span className="text-sm font-mono">{thresholdDb[0].toFixed(1)} dB</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Audio below this level is treated as silent (0 dB is max).</p>
                          <div className="flex items-center">
                            <Slider 
                              value={thresholdDb} 
                              onValueChange={setThresholdDb}
                              min={-60} // dBFS range
                              max={0}
                              step={0.5}
                              disabled={!hasFile}
                            />
                          </div>
                        </div>

                        {/* Minimum Duration slider */}
                        <div>
                          <div className="flex justify-between mb-2">
                             <label className="text-sm font-medium">Minimum Silence Duration</label>
                             <span className="text-sm font-mono">{minDuration[0].toFixed(2)} s</span>
                          </div>
                           {/* Clarified description */}
                           <p className="text-xs text-gray-500 mb-2">Silence shorter than this duration will be ignored.</p>
                          <Slider 
                            value={minDuration} 
                            onValueChange={setMinDuration}
                             max={2} // Keeping 0-2s for now
                            step={0.01}
                            disabled={!hasFile}
                          />
                        </div>

                        {/* Padding sliders */}
                        <div>
                          <label className="text-sm font-medium block mb-2">Padding</label>
                          <p className="text-xs text-gray-500 mb-2">Keep some silence around cuts.</p>
                          
                          <div className="flex justify-between items-center gap-4 mb-2">
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs">Left</span>
                                <span className="text-xs font-mono">{leftPadding[0].toFixed(4)} s</span>
                              </div>
                              <Slider 
                                value={leftPadding} 
                                onValueChange={(value) => {
                                    setLeftPadding(value);
                                    if (paddingLinked) setRightPadding(value);
                                }}
                                max={0.2}
                                step={0.0001}
                                disabled={!hasFile}
                              />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs">Right</span>
                                <span className="text-xs font-mono">{rightPadding[0].toFixed(4)} s</span>
                              </div>
                              <Slider 
                                value={rightPadding} 
                                onValueChange={(value) => {
                                    setRightPadding(value);
                                    if (paddingLinked) setLeftPadding(value);
                                }}
                                max={0.2}
                                step={0.0001}
                                disabled={!hasFile}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center mt-1">
                            <Button 
                              variant={paddingLinked ? "secondary" : "outline"} 
                              size="sm"
                              className="text-xs"
                              onClick={() => setPaddingLinked(!paddingLinked)}
                              title={paddingLinked ? "Unlink Padding" : "Link Padding"}
                              disabled={!hasFile}
                            >
                              {paddingLinked ? "🔒 Linked" : "🔓 Unlinked"}
                            </Button>
                          </div>
                        </div>
                        {/* --- End Padding --- */}

                        {/* --- Target Duration Settings - NEW --- */}
                        <div className="border-t border-gray-200 pt-4 space-y-4">
                            <h3 className="text-sm font-medium">Adjust Speed to Target Duration</h3>
                            
                            {/* Display Current Duration */}
                            <div className="text-sm">
                                Estimated Current Duration: 
                                <span className="font-mono ml-2">
                                    {displayEstimatedDuration !== null ? `${displayEstimatedDuration.toFixed(2)}s` : (currentProcessedDuration !== null ? `${currentProcessedDuration.toFixed(2)}s` : 'N/A')}
                                </span>
                                {/* Moved Rate Display Here */} 
                                {appliedPlaybackRate !== null && appliedPlaybackRate !== 1 && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                        (Rate: {appliedPlaybackRate.toFixed(2)}x)
                                    </span>
                                )}
                            </div>

                            {/* Target Duration Input & Apply Button */}
                        <div className="flex items-center gap-2">
                                <input 
                                    type="number"
                                    id="target-duration"
                                    step="0.1"
                                    min="0.1" // Needs a minimum duration
                                    value={targetDuration === null ? '' : targetDuration}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setTargetDuration(val === '' ? null : Math.max(0.1, parseFloat(val)));
                                    }}
                                    placeholder={currentProcessedDuration !== null ? `${currentProcessedDuration.toFixed(2)}` : 'e.g., 60'}
                                    className="flex-grow p-2 border rounded bg-background disabled:cursor-not-allowed disabled:opacity-50" // Use flex-grow
                            disabled={!hasFile}
                          />
                                <Button 
                                    onClick={handleApplySpeedAdjustment} 
                                    disabled={!hasFile || !audioBuffer || !targetDuration || targetDuration <= 0 || !currentProcessedDuration}
                                    variant="secondary" 
                                    className="flex-shrink-0" // Prevent button from shrinking too much
                                >
                                    Apply
                                </Button>
                            </div>
                            {/* Display the applied rate if active */}
                            {appliedPlaybackRate !== null && (
                                <div className="text-xs text-muted-foreground text-center">
                                </div>
                            )}
                        </div>

                            {/* --- Export as Sections Toggle - NEW --- */}
                            <div className="border-t border-gray-200 pt-4">
                               <div className="flex items-center justify-between">
                                    <label htmlFor="export-sections-toggle" className="text-sm font-medium">
                                        Export as Separate Sections
                                        <p className="text-xs text-gray-500 font-normal">Exports one file per audible segment.</p>
                                    </label>
                                    <Switch 
                                        id="export-sections-toggle"
                                        checked={exportAsSections}
                                        onCheckedChange={setExportAsSections}
                              disabled={!hasFile}
                            />
                               </div>
                           </div>
                            {/* --- End Toggle --- */}

                            {/* --- Export Button - MOVED HERE --- */}
                            <div className="border-t border-gray-200 pt-4">
                                <Button 
                                    onClick={handleExportSegments} 
                                    disabled={!hasFile || !audioBuffer || isExportProcessing} 
                                    className="w-full"
                                >
                                    {isExportProcessing ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                                    ) : (
                                        <Download className="h-4 w-4 mr-2" />
                                    )}
                                    {isExportProcessing ? 'Processing Export...' : 
                                    (exportAsSections ? "Export Audio Segments (WAV)" : "Export Full Processed Audio (WAV)")
                                }
                            </Button>
                            {/* Updated Text */} 
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                {appliedPlaybackRate && appliedPlaybackRate !== 1 
                                    ? 'Exports with speed/pitch change applied.' 
                                    : 'Exports at original speed.'
                                }
                            </p> 
                        </div>
                        {/* --- End Export Button --- */}
                    </div>
                  </div>
                </TabsContent>
              
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// Add a Play icon component since it's not imported from lucide-react
const Play = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export default AppInterface;
