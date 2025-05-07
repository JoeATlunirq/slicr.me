import { useState, useRef, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Scissors, Download, Settings, ArrowLeft, Upload, RotateCcw, Loader2, Music } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast, useToast } from "@/hooks/use-toast";
import Timeline from "./Timeline";
import { audioBufferToWavBlob } from "@/lib/audioUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import axios from "axios";

// --- Define Ref Handle Type for Timeline ---
export interface TimelineHandle {
  resetTimeline: () => void;
  getDeletedRegions: () => { start: number; end: number }[];
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
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [regions, setRegions] = useState<{ start: number; end: number }[]>(initialSavedState?.regions ?? []);
  const timelineRef = useRef<TimelineHandle>(null);
  const [exportAsSections, setExportAsSections] = useState<boolean>(initialSavedState?.exportAsSections ?? false);
  
  // --- State for Target Duration Feature ---
  const [targetDuration, setTargetDuration] = useState<number | null>(initialSavedState?.targetDuration ?? null);
  const [currentProcessedDuration, setCurrentProcessedDuration] = useState<number | null>(null);
  const [appliedPlaybackRate, setAppliedPlaybackRate] = useState<number | null>(initialSavedState?.appliedPlaybackRate ?? null);
  const [displayEstimatedDuration, setDisplayEstimatedDuration] = useState<number | null>(null);
  // ----------------------------------------

  const [transcribeEnabled, setTranscribeEnabled] = useState<boolean>(false);

  // --- State for Export Format ---
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('wav'); // Default to WAV
  // -----------------------------

  // --- State for Export Status Message ---
  const [exportStatusMessage, setExportStatusMessage] = useState<string>("");
  // ---------------------------------------

  // --- Audio Context State ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  // ---------------------------------------

  // --- Get dismiss function from useToast hook ---
  const { dismiss: dismissToast } = useToast();
  // ----------------------------------------------

  // --- State for Music --- 
  const [addMusicEnabled, setAddMusicEnabled] = useState<boolean>(false);
  const [availableMusicTracks, setAvailableMusicTracks] = useState<{id: string; name: string; description?: string; mood?: string; lufs?: number; duration?: number}[]>([]);
  const [selectedMusicTrackId, setSelectedMusicTrackId] = useState<string | null>(null);
  const [musicVolumeDb, setMusicVolumeDb] = useState<number[]>([-18]);
  const [isLoadingMusic, setIsLoadingMusic] = useState<boolean>(false);
  const [autoSelectMusic, setAutoSelectMusic] = useState<boolean>(false);
  // -----------------------

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
      // Store the original File object
      setOriginalFile(file); 

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
      setRegions([]); // Clear previous auto-regions on new file load
      setAppliedPlaybackRate(null); // Also clear speed adjustments
      setTargetDuration(null); // Clear target duration
      timelineRef.current?.resetTimeline(); // Ensure timeline visuals reset too

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
      thresholdDbValue: number, // Now expects dB value
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

  // --- Helper to get final deleted regions (placeholder if not used by server) ---
  // If the server handles all silence removal based on parameters,
  // this function might not be strictly needed to collect regions for the API call.
  // However, it might be used for other UI logic or if some pre-selection is desired.
  // For now, let's assume it might still be called, and it should return current regions.
  const getFinalDeletedRegions = (): { start: number; end: number }[] => {
    // If regions are directly from timelineRef.current?.getDeletedRegions(), that would be ideal.
    // For now, returning the state `regions` which might be auto-detected ones.
    console.warn("[getFinalDeletedRegions] Returning regions from state. Ensure this aligns with server expectations if it needs pre-calculated cuts.");
    return regions; 
  };
  // --------------------------------------------------------------------------

  // --- Placeholder or reinstated handleApplySilenceRemoval ---
  // If this is still called by any UI element, ensure it has a definition.
  // If it's obsolete with the new server-side processing, its calls should be removed.
  const handleApplySilenceRemoval = () => {
    console.log("[handleApplySilenceRemoval] Called. Current implementation might be a placeholder.");
    if (!audioBuffer) {
        toast({ title: "Error", description: "No audio buffer available to detect silence.", variant: "destructive" });
        return;
    }
    // Example: Re-run client-side detection if needed for UI, but server does the actual work.
    const detectedSilentRegions = detectSilence(
        audioBuffer, 
        thresholdDb[0],
        minDuration[0], 
        leftPadding[0], 
        rightPadding[0]
    );
    setRegions(detectedSilentRegions); // Update UI state if necessary
    toast({
      title: "Silence Regions Updated (Client-side)",
      description: `${detectedSilentRegions.length} silent region(s) marked on timeline based on current settings. Server will perform final processing.`,
    });
  };
  // --------------------------------------------------------

  // Modified handleExportAudio to implement the 3-step process
  const handleExportAudio = async () => {
    if (!originalFile) {
      toast({ title: "Error", description: "No audio file loaded or original file not found.", variant: "destructive" });
      setIsExportProcessing(false);
      return;
    }

    setIsExportProcessing(true);
    setExportStatusMessage("Initiating export...");

    // --- Prepare processing parameters ---
    const finalDeletedRegions = getFinalDeletedRegions(); // Get combined regions
    const processingParams = {
      thresholdDb: thresholdDb[0],
      minDuration: minDuration[0],
      leftPadding: leftPadding[0],
      rightPadding: rightPadding[0],
      targetDuration: targetDuration, // from state
      transcribe: transcribeEnabled, // from state
      exportFormat: exportFormat,   // from state
      // Music parameters
      addBackgroundMusic: addMusicEnabled,
      autoSelectMusicTrack: autoSelectMusic,
      selectedMusicTrackId: selectedMusicTrackId,
      musicVolumeDb: musicVolumeDb[0],
      // regionsToCut: finalDeletedRegions, // Server-side silence removal based on parameters, not pre-cut regions
    };
    console.log("[Export Audio] Using processing params:", processingParams);
    // -------------------------------------

    try {
      // Step 1: Get a pre-signed URL
      setExportStatusMessage("Step 1/3: Generating secure upload link...");
      toast({ title: "Exporting...", description: "Step 1/3: Generating secure upload link..." });

      const generateUrlPayload = {
        fileName: originalFile.name,
        contentType: originalFile.type,
      };

      const generateUrlHeaders: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (VITE_SLICR_API_KEY) {
        generateUrlHeaders['X-API-Key'] = VITE_SLICR_API_KEY;
      }

      const presignedUrlResponse = await fetch('/api/generate-upload-url', { // Use relative path for Vercel
        method: 'POST',
        headers: generateUrlHeaders,
        body: JSON.stringify(generateUrlPayload),
      });

      if (!presignedUrlResponse.ok) {
        const errorData = await presignedUrlResponse.json().catch(() => ({ error: 'Failed to get pre-signed URL, server returned invalid response' }));
        throw new Error(`Failed to get pre-signed URL: ${presignedUrlResponse.status} - ${errorData.error || presignedUrlResponse.statusText}`);
      }
      const { uploadUrl, s3Key } = await presignedUrlResponse.json();

      if (!uploadUrl || !s3Key) {
        throw new Error("Pre-signed URL or s3Key missing in server response.");
      }
      console.log("[Export Audio] Step 1 successful. S3 Key:", s3Key);

      // Step 2: Upload the file directly to S3
      setExportStatusMessage("Step 2/3: Uploading audio file to secure storage...");
      toast({ title: "Exporting...", description: "Step 2/3: Uploading audio file... (this may take a moment)" });

      const s3UploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': originalFile.type,
        },
        body: originalFile,
      });

      if (!s3UploadResponse.ok) {
        // Attempt to get error details from S3 (often XML)
        const s3ErrorText = await s3UploadResponse.text();
        console.error("[Export Audio] S3 Upload Error Text:", s3ErrorText);
        throw new Error(`S3 upload failed: ${s3UploadResponse.status} ${s3UploadResponse.statusText}. Check S3 bucket CORS and permissions.`);
      }
      console.log("[Export Audio] Step 2 successful. File uploaded to S3.");

      // Step 3: Call the process API with the s3Key
      setExportStatusMessage("Step 3/3: Processing audio with Slicr...");
      toast({ title: "Exporting...", description: "Step 3/3: Processing audio..." });
      
      const processApiPayload = {
        s3Key: s3Key,
        params: processingParams,
      };

      const processApiHeaders: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (VITE_SLICR_API_KEY) {
        processApiHeaders['X-API-Key'] = VITE_SLICR_API_KEY;
      }
      
      const processResponse = await fetch('/api/process', { // Use relative path
        method: 'POST',
        headers: processApiHeaders,
        body: JSON.stringify(processApiPayload),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({ error: 'Processing API returned invalid response' }));
        throw new Error(`Audio processing failed: ${processResponse.status} - ${errorData.error || processResponse.statusText}`);
      }

      const data = await processResponse.json();
      console.log("[Export Audio] Step 3 successful. Process API response:", data);

      if (data.success && data.audioUrl) {
        setExportStatusMessage("Export successful! Downloading...");
        toast({
          title: "Export Successful!",
          description: "Your processed audio is downloading.",
        });
        // Trigger download
        const filename = s3Key.substring(s3Key.lastIndexOf('/') + 1).replace(/^s3_input_\d+_/, 'processed_') + '.' + processingParams.exportFormat;
        forceDownload(data.audioUrl, filename);
        if (data.srtUrl) {
            toast({ title: "SRT Generated", description: "SRT subtitles also downloading." });
            const srtFilename = filename.replace(/\.[^/.]+$/, ".srt");
            forceDownload(data.srtUrl, srtFilename);
        }
      } else {
        throw new Error(data.error || "Processing completed but no audio URL was returned.");
      }

    } catch (error: any) {
      console.error("[Export Audio] Error during export process:", error);
      setExportStatusMessage("Export failed. See console for details.");
      toast({
        title: "Export Error",
        description: error.message || "An unknown error occurred during export.",
        variant: "destructive",
      });
    } finally {
      setIsExportProcessing(false);
      // Do not clear status message immediately, let success/failure message persist briefly
      // setTimeout(() => setExportStatusMessage(""), 5000);
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

    // If the first segment added was the *entire* duration (because no cuts),
    // we don't need to check for a segment after the "last" cut.
    const addedFullDurationInitially = audibleSegments.length === 1 && audibleSegments[0].start === 0 && audibleSegments[0].end === totalDuration;

    if (!addedFullDurationInitially && lastEndTime < totalDuration) {
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
      // --- Log duration before download --- 
      console.log(`[Export Segment ${index}] Final segment buffer duration BEFORE download: ${segmentBuffer.duration.toFixed(3)}s`);
      // -------------------------------------
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

  // Debug Log for States
  console.log("[Render Check] hasFile:", hasFile, "audioBuffer exists:", !!audioBuffer, "activeTab:", activeTab);

  // Debug Log for Export Button State (moved outside return)
  console.log("[Render] Export Button Disabled Check:", 
      { hasFile, audioBuffer: !!audioBuffer, isExportProcessing },
      "Disabled should be:", (!hasFile || !audioBuffer || isExportProcessing)
  );

  // --- Fetch Available Music Tracks --- 
  useEffect(() => {
    const fetchMusic = async () => {
      setIsLoadingMusic(true);
      try {
        console.log("[Music Fetch] Fetching available tracks...");
        const response = await axios.get('/api/music-tracks');
        if (response.data?.success && Array.isArray(response.data.tracks)) {
          console.log("[Music Fetch] Received tracks:", response.data.tracks);
          setAvailableMusicTracks(response.data.tracks);
          // Optionally set a default selection
          // if (response.data.tracks.length > 0 && !selectedMusicTrackId) {
          //   setSelectedMusicTrackId(response.data.tracks[0].id);
          // }
        } else {
          console.error("[Music Fetch] Invalid response format from /api/music-tracks");
          setAvailableMusicTracks([]);
          toast({ title: "Music Error", description: "Could not load available music tracks.", variant: "destructive" });
        }
      } catch (error) {
        console.error("[Music Fetch] Error fetching music tracks:", error);
        setAvailableMusicTracks([]);
        toast({ title: "Music Error", description: "Failed to connect to music library.", variant: "destructive" });
      } finally {
        setIsLoadingMusic(false);
      }
    };

    fetchMusic();
    // Run only once on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ------------------------------------

  // --- Effect to handle auto-select changes --- 
  useEffect(() => {
      // When auto-select is turned on, clear manual selection
      if (autoSelectMusic) {
          setSelectedMusicTrackId(null);
      }
  }, [autoSelectMusic]);
  // ---------------------------------------------

  // --- Add API Key from environment variables ---
  const VITE_SLICR_API_KEY = import.meta.env.VITE_SLICR_API_KEY;
  // ---------------------------------------------

  // --- Helper Function to force download ---
  const forceDownload = async (url: string, defaultFilename: string) => {
      let downloadToastId: string | number | undefined = undefined; // Declare here
      // Consider API key for download if files are not public?
      // For now, assuming S3 URLs are publicly accessible or presigned for GET
      try {
          // Update status message for download
          setExportStatusMessage(`Fetching ${defaultFilename}...`);
          // Store the ID from the toast return value
          const toastInstance = toast({ title: "Downloading...", description: `Fetching ${defaultFilename}...` });
          downloadToastId = toastInstance?.id; // Assign here
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
          }
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = objectUrl;
          const filename = url.substring(url.lastIndexOf('/') + 1) || defaultFilename;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Revoke the object URL after a short delay
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); 
          // Dismiss using the hook's dismiss function
          if (typeof downloadToastId === 'string') {
            dismissToast(downloadToastId);
          }
          toast({ title: "Download Started", description: `Downloading ${filename}...` });
          return true;
      } catch (error) {
          console.error(`Error forcing download for ${url}:`, error);
          // Clear status on error
          setExportStatusMessage("Error occurred.");
          // Dismiss using the hook's dismiss function
          if (typeof downloadToastId === 'string') {
             dismissToast(downloadToastId);
      }
          toast({ title: "Download Error", description: `Could not download ${defaultFilename}. ${error instanceof Error ? error.message : 'Network error'}`, variant: "destructive" });
          return false;
      }
  };

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
          {/* Header Buttons Removed/Moved */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        {/* Left: Timeline Area */}
        <div className="md:w-2/3 flex flex-col gap-4">
          {!hasFile ? (
            <div 
              className={`bg-white rounded-lg border-2 ${dragActive ? "border-primary border-dashed" : "border-gray-200"} flex-1 flex flex-col items-center justify-center p-12`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                  <p className="text-xl font-medium text-gray-700">Loading Audio...</p>
                  {originalFile && <p className="text-sm text-gray-500 mt-2">{originalFile.name}</p>}
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
              <Timeline ref={timelineRef} audioBuffer={audioBuffer} regions={regions} appliedPlaybackRate={appliedPlaybackRate}/>
            </div>
          )}
        </div>

        {/* Right: Settings Panel */}
        <div className="md:w-1/3">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Tabs defaultValue="silence" className="w-full" onValueChange={setActiveTab} value={activeTab}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="silence" className="relative">
                    <Scissors className="h-5 w-5 mr-2" />
                    Silence
                  </TabsTrigger>
                  <TabsTrigger value="music" className="relative" disabled={!hasFile}>
                    <Music className="h-5 w-5 mr-2" />
                    Music
                  </TabsTrigger>
                  <TabsTrigger value="export" className="relative" disabled={!hasFile}>
                    <Download className="h-5 w-5 mr-2" />
                    Export
                  </TabsTrigger>
                </TabsList>

                {/* Silence Settings Tab Content */}
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
                          {/* Threshold slider */} 
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
                                min={-60}
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
                           <p className="text-xs text-gray-500 mb-2">Silence shorter than this duration will be ignored.</p>
                          <Slider 
                            value={minDuration} 
                            onValueChange={setMinDuration}
                               max={2}
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
                      </div>
                    </div>
                </TabsContent>
                
                {/* Music Settings Tab Content - NEW */} 
                <TabsContent value="music" className="p-4">
                  <div className="space-y-6">
                    {/* Add Music Checkbox (Master Toggle) */} 
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                         <Label htmlFor="add-music-toggle" className="text-sm font-medium">
                             Add Background Music
                             <p className="text-xs text-gray-500 font-normal">Mix royalty-free music behind your voice.</p>
                         </Label>
                         <Checkbox 
                             id="add-music-toggle"
                             checked={addMusicEnabled}
                             onCheckedChange={(checked) => setAddMusicEnabled(Boolean(checked))}
                             disabled={!hasFile}
                         />
                    </div>
                    
                    {/* Conditionally show detailed music options */} 
                    {addMusicEnabled && (
                       <div className="space-y-6">
                          {/* Auto-Select Music */} 
                          <div className="flex items-center justify-between">
                              <Label htmlFor="auto-select-music-toggle" className="text-sm font-medium">
                                  Auto-Select Music
                                  <p className="text-xs text-gray-500 font-normal">Let the system pick a random track.</p>
                              </Label>
                              <Checkbox 
                                  id="auto-select-music-toggle"
                                  checked={autoSelectMusic}
                                  onCheckedChange={(checked) => setAutoSelectMusic(Boolean(checked))}
                                  disabled={!hasFile}
                              />
                          </div>

                          {/* Manual Track Selection (Disabled if Auto is on) */} 
                          <div>
                               <Label htmlFor="music-track-select" className={`text-sm font-medium block mb-1 ${autoSelectMusic ? 'text-gray-400' : ''}`}>Manual Track Selection</Label>
                               <Select 
                                  value={selectedMusicTrackId ?? ''} 
                                  onValueChange={(value) => setSelectedMusicTrackId(value || null)} 
                                  disabled={isLoadingMusic || availableMusicTracks.length === 0 || !hasFile || autoSelectMusic}
                                  >
                                   <SelectTrigger id="music-track-select">
                                       <SelectValue placeholder={isLoadingMusic ? "Loading tracks..." : (autoSelectMusic ? "Auto-selecting..." : "Select track...")} />
                                   </SelectTrigger>
                                   <SelectContent>
                                       {availableMusicTracks.map(track => {
                                           console.log("[Select Render] Mapping track:", track.id, track.name);
                                           return (
                                             <SelectItem key={track.id} value={track.id}>
                                                 {track.name} {track.mood ? `(${track.mood})` : ''}
                                             </SelectItem>
                                           );
                                       })}
                                       {availableMusicTracks.length === 0 && !isLoadingMusic && (
                                          <SelectItem key="no-tracks-export" value="none" disabled>No tracks found</SelectItem>
                                       )}
                                   </SelectContent>
                               </Select>
                               {selectedMusicTrackId && !autoSelectMusic &&
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {availableMusicTracks.find(t => t.id === selectedMusicTrackId)?.description}
                                  </p>
                               }
                           </div>
                          {/* Music Volume Slider */} 
                          <div>
                               <div className="flex justify-between mb-1">
                                  <Label htmlFor="music-volume" className="text-xs font-medium">Music Ducking Level</Label>
                                  <span className="text-xs font-mono">{musicVolumeDb[0]} dB</span>
                               </div>
                               <Slider 
                                   id="music-volume"
                                   value={musicVolumeDb} 
                                   onValueChange={setMusicVolumeDb}
                                   min={-30} // Range for music volume relative to VO
                                   max={-6}
                                   step={1}
                                   disabled={!hasFile}
                               />
                               <p className="text-xs text-muted-foreground mt-1">Target music volume relative to voice (-18dB default).</p>
                           </div>
                       </div>
                     )}
                  </div>
                </TabsContent>
                            
                {/* Export Settings Tab Content - UPDATED */} 
                <TabsContent value="export" className="p-4">
                   <div className="relative space-y-6">
                     {/* Loading Overlay */} 
                     {isExportProcessing && (
                       <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex flex-col items-center justify-center z-10 rounded-md">
                         <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                         <p className="text-sm font-medium text-center px-4">{exportStatusMessage || "Processing..."}</p>
                       </div>
                     )}

                     {/* Actual Content - Keep relevant export options */} 
                     {/* Target Duration */} 
                     <div className={`space-y-4 ${isExportProcessing ? 'opacity-50' : ''}`}> 
                         <h3 className="text-sm font-medium">Adjust Speed to Target Duration</h3>
                            <div className="text-sm">
                                Estimated Current Duration: 
                                <span className="font-mono ml-2">
                                    {displayEstimatedDuration !== null ? `${displayEstimatedDuration.toFixed(2)}s` : (currentProcessedDuration !== null ? `${currentProcessedDuration.toFixed(2)}s` : 'N/A')}
                                </span>
                                {appliedPlaybackRate !== null && appliedPlaybackRate !== 1 && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                        (Rate: {appliedPlaybackRate.toFixed(2)}x)
                                    </span>
                                )}
                            </div>
                        <div className="flex items-center gap-2">
                                <input 
                                    type="number"
                                    id="target-duration"
                                    step="0.1"
                                     min="0.1"
                                    value={targetDuration === null ? '' : targetDuration}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setTargetDuration(val === '' ? null : Math.max(0.1, parseFloat(val)));
                                    }}
                                    placeholder={currentProcessedDuration !== null ? `${currentProcessedDuration.toFixed(2)}` : 'e.g., 60'}
                                     className="flex-grow p-2 border rounded bg-background disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!hasFile}
                          />
                                <Button 
                                    onClick={handleApplySpeedAdjustment} 
                                    disabled={!hasFile || !audioBuffer || !targetDuration || targetDuration <= 0 || !currentProcessedDuration}
                                    variant="secondary" 
                                     className="flex-shrink-0"
                                >
                                    Apply
                                </Button>
                            </div>
                                </div>
                     {/* End Target Duration */} 

                     {/* Grouped Export Options (Reduced) */} 
                     <div className={`border-t border-gray-200 pt-4 space-y-6 ${isExportProcessing ? 'opacity-50' : ''}`}> 
                       <h3 className="text-sm font-medium mb-2">Export Options</h3>
                       {/* Transcription Checkbox */} 
                       <div className="pt-0">
                               <div className="flex items-center justify-between">
                               <Label htmlFor="transcribe-toggle" className="text-sm font-medium">
                                   Generate Subtitles (SRT)
                                   <p className="text-xs text-gray-500 font-normal">Creates word-level timestamps via Whisper.</p>
                               </Label>
                               <Checkbox 
                                    id="transcribe-toggle"
                                    checked={transcribeEnabled}
                                    onCheckedChange={(checked) => setTranscribeEnabled(Boolean(checked))}
                              disabled={!hasFile}
                            />
                               </div>
                           </div>
                       {/* --- Add Music Section --- */} 
                       <div className="pt-0 space-y-3">
                         <div className="flex items-center justify-between">
                             <Label htmlFor="add-music-toggle" className="text-sm font-medium">
                                 Add Background Music
                                 <p className="text-xs text-gray-500 font-normal">Mix royalty-free music behind your voice.</p>
                             </Label>
                             <Checkbox 
                                 id="add-music-toggle"
                                 checked={addMusicEnabled}
                                 onCheckedChange={(checked) => setAddMusicEnabled(Boolean(checked))}
                                 disabled={!hasFile}
                             />
                        </div>
                        {/* Conditionally show music selection options */} 
                        {addMusicEnabled && (
                            <div className="pl-2 space-y-4 pt-2 border-l-2 border-muted">
                               {/* Music Track Selection */} 
                               <div>
                                   <Label htmlFor="music-track-select" className="text-xs font-medium block mb-1">Music Track</Label>
                                   <Select 
                                      value={selectedMusicTrackId ?? ''} 
                                      onValueChange={(value) => setSelectedMusicTrackId(value || null)} 
                                      disabled={isLoadingMusic || availableMusicTracks.length === 0 || !hasFile}
                                      >
                                       <SelectTrigger id="music-track-select">
                                           <SelectValue placeholder={isLoadingMusic ? "Loading tracks..." : "Select track..."} />
                                       </SelectTrigger>
                                       <SelectContent>
                                           {/* <SelectItem value="default">Default Track</SelectItem> */} {/* Option for default */} 
                                           {availableMusicTracks.map(track => {
                                               console.log("[Select Render] Mapping track:", track.id, track.name);
                                               return (
                                                 <SelectItem key={track.id} value={track.id}>
                                                     {track.name} {track.mood ? `(${track.mood})` : ''}
                                                 </SelectItem>
                                               );
                                           })}
                                           {availableMusicTracks.length === 0 && !isLoadingMusic && (
                                              <SelectItem key="no-tracks-export" value="none" disabled>No tracks found</SelectItem>
                                           )}
                                       </SelectContent>
                                   </Select>
                                   {selectedMusicTrackId && 
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {availableMusicTracks.find(t => t.id === selectedMusicTrackId)?.description}
                                      </p>
                                   }
                               </div>
                               {/* Music Volume Slider */} 
                               <div>
                                   <div className="flex justify-between mb-1">
                                      <Label htmlFor="music-volume" className="text-xs font-medium">Music Volume</Label>
                                      <span className="text-xs font-mono">{musicVolumeDb[0]} dB</span>
                                   </div>
                                   <Slider 
                                       id="music-volume"
                                       value={musicVolumeDb} 
                                       onValueChange={setMusicVolumeDb}
                                       min={-30} // Range for music volume relative to VO
                                       max={-6}
                                       step={1}
                                       disabled={!hasFile}
                                   />
                                   <p className="text-xs text-muted-foreground mt-1">Adjusts background music level (-18dB default).</p>
                               </div>
                           </div>
                        )}
                        </div>
                        {/* --- End Add Music Section --- */}

                        {/* Export Format Selection */} 
                        <div className="pt-0">
                            <Label className="text-sm font-medium block mb-2">Export Format</Label>
                            <RadioGroup 
                                defaultValue={exportFormat}
                                value={exportFormat} 
                                onValueChange={(value: 'wav' | 'mp3') => setExportFormat(value)}
                                className="flex space-x-4"
                                disabled={!hasFile}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="wav" id="format-wav" disabled={!hasFile} />
                                    <Label htmlFor="format-wav" className={`text-sm ${!hasFile ? 'text-gray-400 cursor-not-allowed' : ''}`}>WAV (Lossless)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="mp3" id="format-mp3" disabled={!hasFile} />
                                    <Label htmlFor="format-mp3" className={`text-sm ${!hasFile ? 'text-gray-400 cursor-not-allowed' : ''}`}>MP3 (Compressed)</Label>
                                </div>
                            </RadioGroup>
                            <p className="text-xs text-gray-500 mt-1">MP3 is smaller (faster upload, good for transcription) but loses some quality.</p>
                        </div>
                        {/* Export Button */} 
                        <div className="pt-0">
                                <Button 
                                    onClick={handleExportAudio} 
                                    disabled={!hasFile || !audioBuffer || isExportProcessing} 
                                    className="w-full"
                                >
                                    {isExportProcessing ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                                    ) : (
                                        <Download className="h-4 w-4 mr-2" />
                                    )}
                                    {isExportProcessing ? 'Processing Export...' : 
                                `Export Processed Audio (${exportFormat.toUpperCase()})`
                                }
                            </Button>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                {appliedPlaybackRate && appliedPlaybackRate !== 1 
                                    ? 'Exports with speed/pitch change applied.' 
                                    : 'Exports at original speed.'
                                }
                            </p> 
                        </div>
                    </div>
                     {/* End Grouped Export Options */} 
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

export default AppInterface;
