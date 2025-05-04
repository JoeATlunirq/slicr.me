import { useState, useRef, useEffect, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Scissors, Download, Settings, ArrowLeft, Upload, RotateCcw, Loader2, Music, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast, useToast } from "@/hooks/use-toast";
import Timeline from "./Timeline";
import { audioBufferToWavBlob } from "@/lib/audioUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import axios from "axios";

// Import Tab components
import MusicTab from './tabs/MusicTab';

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
  // Define a clearer type for fetched tracks
  interface FetchedMusicTrack {
    Id: number | string; // NocoDB might use number or string
    Title: string;
    Description?: string;
    Mood?: string;
    LUFS?: number;      // Added from NocoDB fetch
    Duration?: number; // Added from NocoDB fetch
    S3_URL?: string;   // Added from NocoDB fetch
  }
  const [availableMusicTracks, setAvailableMusicTracks] = useState<FetchedMusicTrack[]>([]);
  const [selectedMusicTrackId, setSelectedMusicTrackId] = useState<string | null>(null); // Allow null
  const [musicVolumeDb, setMusicVolumeDb] = useState<number>(-23); // Default to -23, single number state
  const [isLoadingMusic, setIsLoadingMusic] = useState<boolean>(false);
  const [autoSelectMusic, setAutoSelectMusic] = useState<boolean>(false);
  const [musicTracksError, setMusicTracksError] = useState<Error | null>(null); // State for fetch error

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
    const exportType = exportFormat.toUpperCase();
    // --- Set initial status message --- 
    setExportStatusMessage(`Sending to server (${exportType})...`);
    toast({ title: `Preparing Export (${exportType})...`, description: "Sending file to server..." }); // Keep toast for consistency

    // --- Prepare data for API --- 
    if (!originalFile) {
        toast({ title: "Error", description: "Original file not found.", variant: "destructive" });
        setIsExportProcessing(false);
        return;
    }

    const params = {
        thresholdDb: thresholdDb[0],
        minDuration: minDuration[0],
        leftPadding: leftPadding[0],
        rightPadding: rightPadding[0],
        targetDuration: targetDuration,
        exportAsSections: exportAsSections,
        transcribe: transcribeEnabled,
        exportFormat: exportFormat,
        // Add music params
        addMusic: addMusicEnabled,
        autoSelectMusic: addMusicEnabled ? autoSelectMusic : undefined,
        musicTrackId: addMusicEnabled && !autoSelectMusic ? (selectedMusicTrackId || undefined) : undefined,
        musicVolumeDb: addMusicEnabled ? musicVolumeDb : undefined,
    };

    const formData = new FormData();
    formData.append('audioFile', originalFile);
    formData.append('params', JSON.stringify(params));

    console.log("[API Export] Sending parameters:", params);
    // ---------------------------

    // Ensure Audio Context is ready before proceeding (might not be needed if only sending file)
    const audioCtx = await initializeAudio(); 
    if (!audioCtx) { 
        toast({ title: "Error", description: "Audio engine not ready. Please try again.", variant: "destructive" });
        setIsExportProcessing(false);
        return;
    }

    // Get API Key from environment variables
    const apiKey = import.meta.env.VITE_SLICR_API_KEY;
    if (!apiKey) {
      toast({ title: "Configuration Error", description: "API Key is missing in frontend configuration.", variant: "destructive" });
      setIsExportProcessing(false);
      setExportStatusMessage("Configuration Error");
      return;
    }

    try {
      // --- Call API with Auth Header --- 
      setExportStatusMessage("Processing on server..."); // Update status
      const response = await fetch('/api/process', {
          method: 'POST',
          headers: {
            // Add the API Key header
            'X-API-Key': apiKey
          },
          body: formData
      });

      // --- Enhanced Response Handling --- 
      let result;
      try {
          const responseText = await response.text();
          console.log("[API Export] Raw Response Text:", responseText);

          if (!response.ok) {
              // Try parsing error JSON, fallback to text
              let errorMsg = `Server error: ${response.status} ${response.statusText}`;
              try {
                  const errorData = JSON.parse(responseText);
                  errorMsg = `${errorMsg} - ${errorData?.error || 'Unknown server error details'}`;
              } catch (parseError) {
                  errorMsg = `${errorMsg} - Response: ${responseText}`;
              }
              throw new Error(errorMsg);
          }

          // If response.ok, try parsing the text as JSON
          try {
              result = JSON.parse(responseText);
              console.log("[API Export] Parsed Response JSON:", result);
          } catch (parseError) {
              console.error("[API Export] Failed to parse response JSON:", parseError);
              throw new Error(`Failed to parse server response. Raw response: ${responseText}`);
          }

      } catch (fetchError) {
          // Catch errors from fetch() itself or response processing
          console.error("[API Export] Error fetching or processing response:", fetchError);
          setIsExportProcessing(false); // Stop loading indicator
          toast({ title: "Network/Response Error", description: `Failed to communicate with server: ${fetchError instanceof Error ? fetchError.message : 'Unknown network error'}`, variant: "destructive" });
          return; // Exit the function early
      }
      // --- End Enhanced Response Handling ---

      setIsExportProcessing(false); // Stop loading indicator (moved after response handling)

      // --- Check Parsed Result --- 
      // Check if result is defined and has the expected structure
      if (!result || !result.success || !(result.audioUrl || result.srtUrl)) {
         const errorDetail = result?.error || "API did not return valid file data or success was false.";
         console.error("[API Export] Invalid result structure or success=false:", result);
         throw new Error(errorDetail); // Use specific error if available
      }
      // ---------------------------

      console.log("[API Export] Received success response structure is valid:", result);

      // --- Handle downloaded files/links (using fetch for forced download) --- 
      let downloaded = false;
      
      // Helper function for forced download
      const forceDownload = async (url: string, defaultFilename: string) => {
          if (!url) return false;
          let downloadToastId: string | number | undefined = undefined;
          try {
              // Update status message for download
              setExportStatusMessage(`Fetching ${defaultFilename}...`);
              // Store the ID from the toast return value
              const toastInstance = toast({ title: "Downloading...", description: `Fetching ${defaultFilename}...` });
              downloadToastId = toastInstance?.id; // Use optional chaining
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

      // Attempt to download audio
      if (result.audioUrl) {
          const audioDownloaded = await forceDownload(result.audioUrl, `processed_audio.${exportFormat}`);
          if (audioDownloaded) downloaded = true;
      } else {
          console.warn("[API Export] No audioUrl found in response.");
      }
      
      // Attempt to download SRT
      if (result.srtUrl) {
           const srtDownloaded = await forceDownload(result.srtUrl, 'subtitles.srt');
           if (srtDownloaded) downloaded = true; // Mark as downloaded even if only SRT
      } else if (transcribeEnabled) {
          console.warn("[API Export] Transcription requested but no srtUrl found in response.");
      }

      if (!downloaded) {
        // If neither download succeeded
        toast({ title: "Processing Complete", description: "Server processed the request but downloading failed.", variant: "default"});
      }

      // --- Clear status on completion --- 
      setIsExportProcessing(false);
      setExportStatusMessage("Export complete."); // Or clear: ""
      // Optional: Clear message after a delay
      // setTimeout(() => setExportStatusMessage(""), 3000);

      // --- Remove old link handling --- 
      /*
      if (result.audioUrl) {
          // ... old link creation ...
      }
      if (result.srtUrl) {
          // ... old link creation ...
      }
      */
      // --- End old link handling ---

      // --- Remove old base64 handling --- 
      /*
      // Decode base64 data, create Blob, trigger download
      if (result.files && result.files.length > 0) {
        // TODO: Handle multiple files if exportAsSections is implemented in API
        const fileInfo = result.files[0];
        try {
            const byteCharacters = atob(fileInfo.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/wav' }); // Assuming WAV for now

            // Create a link and trigger download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileInfo.filename || 'processed_audio.wav';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // Clean up object URL

            toast({ title: "Download Started", description: `Downloading ${link.download}...` });

        } catch (decodeError) {
            console.error("Error decoding or downloading file:", decodeError);
            toast({ title: "Download Error", description: "Failed to decode or prepare the downloaded file.", variant: "destructive"});
        }
      } else {
         toast({ title: "Processing Complete", description: "Server processed the request but returned no files.", variant: "default"});
      }
      */
      // --- End old base64 handling ---

      // --- Remove old local processing logic --- 
      /*
      // Get ALL deleted regions (auto + manual) directly from the Timeline component
      const regionsToCut = timelineRef.current?.getDeletedRegions() ?? [];
      regionsToCut.sort((a, b) => a.start - b.start); // Ensure sorted

      const audibleSegments = calculateAudibleSegments(audioBuffer, regionsToCut);
      console.log("Calculated audible segments based on ALL deleted regions:", audibleSegments);

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

          // --- Log duration before download --- 
           console.log(`[Export Full] Final combined buffer duration BEFORE download: ${combinedBuffer.duration.toFixed(3)}s. Expected (approx): ${audioBuffer.duration.toFixed(3)}s (minus cuts) / ${appliedPlaybackRate?.toFixed(2) ?? 1.0}`);
           // -------------------------------------

           // Convert final buffer (potentially stretched) to WAV and download
           downloadCombinedAudio(combinedBuffer, "processed_audio.wav");
           toast({ title: "Export Complete!", description: "Processed audio exported as single WAV file." });
      }

      */
      
    } catch (error) {
        console.error("Error during export process:", error);
        toast({ title: "Export Error", description: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
        setIsExportProcessing(false); // Ensure loading stops on error
    } finally {
        setIsExportProcessing(false); // Ensure loading stops even on error
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
      setMusicTracksError(null); // Reset error on new fetch
      try {
        console.log("[Music Fetch] Fetching available tracks...");
        const response = await axios.get('/api/music-tracks');
        if (response.data?.success && Array.isArray(response.data.tracks)) {
          console.log("[Music Fetch] Received tracks:", response.data.tracks);
          setAvailableMusicTracks(response.data.tracks);
        } else {
          console.error("[Music Fetch] Invalid response format from /api/music-tracks");
          setAvailableMusicTracks([]);
          const error = new Error("Could not load available music tracks due to invalid format.");
          setMusicTracksError(error);
          toast({ title: "Music Error", description: error.message, variant: "destructive" });
        }
      } catch (error: any) {
        console.error("[Music Fetch] Error fetching music tracks:", error);
        setAvailableMusicTracks([]);
        const fetchError = new Error(error.message || "Failed to connect to music library.");
        setMusicTracksError(fetchError);
        toast({ title: "Music Error", description: fetchError.message, variant: "destructive" });
      } finally {
        setIsLoadingMusic(false);
      }
    };

    fetchMusic();
    // Run only once on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed toast dependency
  // ------------------------------------

  // --- Effect to handle auto-select changes --- 
  useEffect(() => {
      // When auto-select is turned on, clear manual selection
      if (autoSelectMusic) {
          setSelectedMusicTrackId(null);
      }
  }, [autoSelectMusic]);
  // ---------------------------------------------

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
                    {/* Add Apply Button Back */}
                    <Button onClick={handleApplySilenceRemoval} disabled={!hasFile || !audioBuffer} className="w-full">
                         Apply Auto Silence Detection
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Adjust settings below and click Apply to see changes on the timeline.</p>
                    
                    {/* Threshold */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label htmlFor="threshold" className="text-xs font-medium">Silence Threshold</Label>
                        <span className="text-xs font-mono">{thresholdDb[0]} dB</span>
                      </div>
                      <Slider
                        id="threshold"
                        value={thresholdDb}
                        onValueChange={setThresholdDb}
                        max={0}
                        min={-60}
                        step={1}
                        disabled={!hasFile}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Audio below this level is considered silence.</p>
                    </div>

                    {/* Min Duration */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <Label htmlFor="min-duration" className="text-xs font-medium">Minimum Silence Duration</Label>
                        <span className="text-xs font-mono">{minDuration[0].toFixed(3)} s</span>
                      </div>
                      <Slider
                        id="min-duration"
                        value={minDuration}
                        onValueChange={setMinDuration}
                        max={1.0}
                        min={0.1}
                        step={0.005}
                        disabled={!hasFile}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Silences shorter than this are kept.</p>
                    </div>

                    {/* Padding */}
                    <div>
                      <Label className="text-xs font-medium block mb-2">Silence Padding</Label>
                      <div className="flex items-center gap-4">
                        {/* Left Padding Slider */}
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs">Left</span>
                            <span className="text-xs font-mono">{leftPadding[0].toFixed(4)} s</span>
                          </div>
                          <Slider
                            value={[leftPadding[0]]} // Pass as array
                            onValueChange={(value) => {
                                const newPadding = [...leftPadding];
                                newPadding[0] = value[0];
                                if (paddingLinked) newPadding[1] = value[0];
                                setLeftPadding(newPadding);
                            }}
                            max={0.2}
                            min={0}
                            step={0.0001}
                            disabled={!hasFile}
                          />
                        </div>
                        {/* Right Padding Slider */}
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs">Right</span>
                            <span className="text-xs font-mono">{rightPadding[0].toFixed(4)} s</span>
                          </div>
                          <Slider
                            value={[rightPadding[0]]} // Pass as array
                            onValueChange={(value) => {
                              const newPadding = [...rightPadding];
                              newPadding[0] = value[0];
                              if (paddingLinked) newPadding[1] = value[0];
                              setRightPadding(newPadding);
                            }}
                            max={0.2}
                            min={0}
                            step={0.0001}
                            disabled={!hasFile}
                          />
                        </div>
                      </div>
                      {/* Link Button */}
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
                      <p className="text-xs text-muted-foreground mt-1 text-center">Add padding before/after kept audio.</p>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Music Settings Tab Content */}
                <TabsContent value="music" className="p-4">
                  <MusicTab
                    addMusic={addMusicEnabled}
                    setAddMusic={setAddMusicEnabled}
                    autoSelectMusic={autoSelectMusic}
                    setAutoSelectMusic={setAutoSelectMusic}
                    musicTrackId={selectedMusicTrackId}
                    setMusicTrackId={setSelectedMusicTrackId}
                    musicVolumeDb={musicVolumeDb} // Pass single number
                    setMusicVolumeDb={setMusicVolumeDb} // Pass setter for single number
                    availableMusicTracks={availableMusicTracks}
                    isLoadingMusic={isLoadingMusic}
                    tracksError={musicTracksError} // Pass error state
                  />
                </TabsContent>

                {/* Export Settings Tab Content */}
                <TabsContent value="export" className="p-4">
                  <div className="relative space-y-6">
                     {/* Loading Overlay */}
                     {isExportProcessing && (
                        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10 rounded-md">
                           <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
                           <p className="text-sm font-medium text-gray-700">{exportStatusMessage}</p>
                         </div>
                     )}

                    {/* Export Format */}
                    <div className="pt-0 space-y-3">
                      <Label className="text-sm font-medium">Export Format</Label>
                      <RadioGroup defaultValue="wav" value={exportFormat} onValueChange={(v) => setExportFormat(v as 'wav' | 'mp3')}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="wav" id="r-wav" disabled={!hasFile || isExportProcessing}/>
                          <Label htmlFor="r-wav">WAV (Lossless)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mp3" id="r-mp3" disabled={!hasFile || isExportProcessing}/>
                          <Label htmlFor="r-mp3">MP3 (Compressed)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Transcription */}
                    <div className="pt-0 space-y-3">
                         <div className="flex items-center justify-between">
                           <Label htmlFor="transcribe-toggle" className="text-sm font-medium">
                               Generate Subtitles (SRT)
                               <p className="text-xs text-gray-500 font-normal">Creates a .srt file via Whisper AI.</p>
                           </Label>
                           <Checkbox
                               id="transcribe-toggle"
                               checked={transcribeEnabled}
                               onCheckedChange={(checked) => setTranscribeEnabled(Boolean(checked))}
                               disabled={!hasFile || isExportProcessing}
                           />
                        </div>
                        {transcribeEnabled && (
                           <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-200">
                              Note: Transcription requires audio to be under 25MB. Export will proceed without subtitles if the limit is exceeded.
                           </p>
                        )}
                    </div>

                     {/* Target Duration (Optional Speed Up) */}
                    <div className="pt-0 space-y-3">
                      <Label htmlFor="target-duration" className="text-sm font-medium">
                          Target Duration (Optional)
                          <p className="text-xs text-gray-500 font-normal">Speed up audio to fit a duration (preserves pitch).</p>
                      </Label>
                       <div className="flex items-center space-x-2">
                          <input 
                              type="number" 
                              id="target-duration"
                              value={targetDuration ?? ''} 
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setTargetDuration(val ? parseFloat(val) : null);
                              }}
                              placeholder={currentProcessedDuration ? `Current: ${currentProcessedDuration.toFixed(1)}s` : "(e.g., 60)"}
                              min="1"
                              step="0.1"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-grow"
                              disabled={!hasFile || isExportProcessing}
                            />
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => setTargetDuration(null)} 
                                disabled={!targetDuration || !hasFile || isExportProcessing}
                                title="Clear target duration"
                                className="flex-shrink-0">
                                 <X className="h-4 w-4" />
                             </Button>
                        </div>
                         {displayEstimatedDuration && targetDuration && currentProcessedDuration && targetDuration < currentProcessedDuration && (
                            <p className="text-xs text-indigo-600">
                                Estimated Speed: x{displayEstimatedDuration.toFixed(2)}. Final duration may vary slightly.
                            </p>
                        )}
                         {targetDuration && currentProcessedDuration && targetDuration >= currentProcessedDuration && (
                            <p className="text-xs text-red-600">
                                Target duration must be shorter than current duration ({currentProcessedDuration.toFixed(1)}s) to apply speed-up.
                            </p>
                        )}
                    </div>

                    {/* Export Button */}
                    <div className="pt-4">
                      <Button
                        onClick={handleExportSegments} // Changed to export segments
                        disabled={!hasFile || !audioBuffer || isExportProcessing}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {isExportProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Process & Download
                          </>
                        )}
                      </Button>
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

export default AppInterface;
