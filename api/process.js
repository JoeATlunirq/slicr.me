import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { pathToFileURL } from 'url';
import process from 'process';
import axios from 'axios';
import ffprobeStatic from 'ffprobe-static';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from 'openai';
import { getAllMusicTracks, getMusicTrackById } from './lib/musicService.js'; // Import music service - Added .js extension

// --- API Key Check --- 
const EXPECTED_API_KEY = process.env.PROCESS_API_KEY;
// Define allowed origins for UI requests (add your production domain here)
const ALLOWED_UI_ORIGINS = [
  'http://localhost:8080', // Vite default dev server
  'https://www.slicr.me'   // Your production domain
  // Add other potential origins if needed (e.g., staging)
];
// ---------------------

// --- AWS S3 Configuration --- 
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME } = process.env;

// --- OpenAI Configuration ---
const { OPENAI_API_KEY } = process.env;
let openai = null;
if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    console.log("[API Init] OpenAI Client Initialized.");
} else {
    console.warn("[API Init] OPENAI_API_KEY not found. Transcription feature will be disabled.");
}
// --- End OpenAI Configuration ---

// --- Add careful logging --- 
console.log(`[API Init Debug] AWS_REGION: ${AWS_REGION}`);
console.log(`[API Init Debug] S3_BUCKET_NAME: ${S3_BUCKET_NAME}`);
console.log(`[API Init Debug] AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID?.substring(0, 5)}...`); // Log first few chars only
console.log(`[API Init Debug] AWS_SECRET_ACCESS_KEY length: ${AWS_SECRET_ACCESS_KEY?.length}`); // Log length only
// --- End careful logging ---

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
    console.error("[API Init] Missing required AWS environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME).");
    // Optionally throw an error or handle differently if needed for local dev without env vars
}

const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID || '', // Provide default empty string if undefined
        secretAccessKey: AWS_SECRET_ACCESS_KEY || ''
    }
});
// --- End AWS S3 Configuration ---

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// Explicitly set ffprobe path using ffprobe-static
try {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
    console.log(`[API Init] Set ffprobe path using ffprobe-static: ${ffprobeStatic.path}`);
} catch (err) {
    console.error("[API Init] Error setting ffprobe path from ffprobe-static:", err);
}

// Keep Vercel specific config for compatibility if deploying there
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to download file from URL
async function downloadFile(url, outputPath) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// --- Helper Function: Generate SRT from Whisper Words ---
// Revised formatTimestamp to preserve milliseconds
function formatTimestamp(totalSeconds) {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
        return '00:00:00,000'; // Return default for invalid input
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    // Calculate milliseconds from the fractional part, ensuring it's between 0 and 999
    const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
    
    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');
    const millisecondsStr = milliseconds.toString().padStart(3, '0');

    return `${hoursStr}:${minutesStr}:${secondsStr},${millisecondsStr}`;
}

function generateSrtFromWhisperWords(words) {
    if (!words || words.length === 0) {
        return '';
    }
    let srtContent = '';
    words.forEach((wordData, index) => {
        const { start, end, word } = wordData;
        // Basic check for valid timestamps
        if (typeof start !== 'number' || typeof end !== 'number' || start > end) {
            console.warn(`[SRT Gen] Skipping invalid word data: ${JSON.stringify(wordData)}`);
            return; // Skip this entry
        }
        const startTime = formatTimestamp(start);
        const endTime = formatTimestamp(end);
        // Remove leading/trailing spaces from word, handle potential empty words after trimming
        const trimmedWord = word.trim(); 
        if (!trimmedWord) {
            console.warn(`[SRT Gen] Skipping empty word data after trim: ${JSON.stringify(wordData)}`);
            return; // Skip this entry if word becomes empty after trim
        } 
        
        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${trimmedWord}\n\n`;
    });
    return srtContent;
}
// --- End Helper Function ---

// --- FFmpeg Filter Constants --- 
const DEFAULT_MUSIC_TARGET_LUFS = -18; // Target loudness for music normalization
const DEFAULT_MUSIC_DUCKING_DB = -18; // Default volume level relative to VO (Reverted from -26)
const DEFAULT_MUSIC_FADEOUT_THRESHOLD_S = 180; // 3 minutes
const DEFAULT_MUSIC_FADEOUT_DURATION_S = 2; // Fade-out duration
// -----------------------------

// Export default handler function
export default async function handler(req, res) {

  // --- Origin Check / API Key Verification --- 
  const requestOrigin = req.headers['origin']; // Get Origin header
  console.log(`[API Auth] Request Origin: ${requestOrigin}`);

  // Check if origin is one of the allowed UI origins
  if (requestOrigin && ALLOWED_UI_ORIGINS.includes(requestOrigin)) {
    // Request is likely from the UI, bypass API key check for now
    console.log(`[API Auth] Origin is allowed UI origin. Skipping API Key check.`);
  } else {
    // Origin is not recognized UI or missing - treat as API call, require key
    console.log(`[API Auth] Origin not recognized or missing. Enforcing API Key check.`);
    if (!EXPECTED_API_KEY) {
      console.error("[API Auth] CRITICAL: PROCESS_API_KEY environment variable not set on server.");
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Server configuration error.' }));
      return;
    }
    const providedApiKey = req.headers['x-api-key']; 
    if (providedApiKey !== EXPECTED_API_KEY) {
      console.warn(`[API Auth] Failed API Key attempt. Provided: ${providedApiKey}`);
      res.statusCode = 403; // Forbidden
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Invalid API Key.' }));
      return;
    }
    console.log(`[API Auth] API Key validated successfully.`);
  }
  // --- End Origin Check / API Key Verification ---

  // Re-add method check
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  // Add CORS headers back (important for direct handling without Express/proxy)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust in production!
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const form = formidable({});
  let fields;
  let files;
  let inputPath = null;
  let downloadedTempPath = null;
  let cleanupNeeded = false;
  let params;
  let intermediateOutputPath = null;
  let finalOutputPath = null; 
  let whisperInputPath = null; 
  let tempMusicPath = null;    // Temp path for downloaded original music
  let trimmedMusicPath = null; // Temp path for music trimmed to VO length
  let mixedOutputPath = null;  // Temp path for VO + Music mix
  let normalizedMusicPath = null; // Temp path for normalized music
  let fadedMusicPath = null;     // Temp path for faded music
  let adjustedMusicPath = null;  // Temp path for volume-adjusted music
  let mp3OutputPath = null;
  let srtOutputPath = null;
  let s3SrtKey = null;
  let s3SrtUrl = null; // Declare s3SrtUrl in the outer scope
  let finalExportFormat = 'wav';
  let finalS3Key = '';
  let finalContentType = 'audio/wav';
  let pathToUpload = null; // Final path (mixed or not, converted or not) before S3 upload
  let fullTranscriptText = null;

  try {
    // --- Get Input: File Upload OR URL --- 
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });

    // Parameter Parsing (moved inside main try)
    try {
        if (!fields.params || !fields.params[0]) {
            throw new Error('Missing parameters');
        }
        params = JSON.parse(fields.params[0]); // Assign to outer scope params
        console.log('[API] Received Params:', params);
    } catch (err) {
        console.error('[API] Error parsing parameters:', err);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Invalid parameters format' }));
        return;
    }

    if (files.audioFile && files.audioFile[0]) {
        // Option 1: Use uploaded file
        const inputFile = files.audioFile[0];
        inputPath = inputFile.filepath; // Temporary path from formidable
        cleanupNeeded = true; // Formidable might clean up, but good to track
        console.log(`[API] Using uploaded file: ${inputPath}`);
    } else if (fields.audioUrl && typeof fields.audioUrl[0] === 'string') {
        // Option 2: Download from URL
        const audioUrl = fields.audioUrl[0];
        console.log(`[API] Attempting to download from URL: ${audioUrl}`);
        try {
            const tempFilename = `downloaded_${Date.now()}${path.extname(new URL(audioUrl).pathname) || '.tmp'}`;
            downloadedTempPath = path.join(os.tmpdir(), tempFilename);
            await downloadFile(audioUrl, downloadedTempPath);
            inputPath = downloadedTempPath;
            cleanupNeeded = true; // We definitely need to clean this up
            console.log(`[API] Successfully downloaded to: ${inputPath}`);
        } catch (downloadError) {
            console.error('[API] Error downloading file:', downloadError);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Failed to download audio from URL' }));
            if (downloadedTempPath && fs.existsSync(downloadedTempPath)) {
                fs.unlinkSync(downloadedTempPath); // Clean up partial download
            }
            return;
        }
    } else {
        // No valid input found
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'No audio file uploaded or audio URL provided' }));
        return;
    }
    // --- End Get Input ---

  } catch (err) {
    console.error('[API] Error processing input:', err);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Error processing input data' }));
    return;
  }

  // At this point, inputPath should be valid
  if (!inputPath) {
       // This case should theoretically be caught above, but belt-and-suspenders
       console.error("[API] Internal error: inputPath is null after input processing.");
       res.statusCode = 500;
       res.setHeader('Content-Type', 'application/json');
       res.end(JSON.stringify({ success: false, error: 'Internal server error processing input' }));
       return;
  }
   // And params should be valid
  if (!params) {
      console.error("[API] Internal error: params is null after input processing.");
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Internal server error processing parameters' }));
      return;
  }

  // Use a final variable for input path inside the next try block
  const finalInputPath = inputPath;

  try { // Wrap the main processing and cleanup

    // --- Determine Output Paths --- 
    const originalFilename = files?.audioFile?.[0]?.originalFilename 
                              || (fields?.audioUrl?.[0] ? path.basename(new URL(fields.audioUrl[0]).pathname) : null) 
                              || 'audio.wav'; 
    const safeOriginalFilename = originalFilename.replace(/[^a-z0-9_.-]/gi, '_');
    const baseOutputFilename = `processed_${path.parse(safeOriginalFilename).name}_${Date.now()}`;
    // Assign to outer scope variables
    intermediateOutputPath = path.join(os.tmpdir(), `${baseOutputFilename}_intermediate.wav`);
    finalOutputPath = path.join(os.tmpdir(), `${baseOutputFilename}_final.wav`);
    // Determine final S3 key based on export format
    finalS3Key = `${baseOutputFilename}_final.${finalExportFormat}`;
    finalContentType = finalExportFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    // Assign MP3 path (even if not used, for cleanup)
    mp3OutputPath = path.join(os.tmpdir(), `${baseOutputFilename}_final.mp3`);
    // Assign SRT paths as well (SRT key remains the same)
    srtOutputPath = path.join(os.tmpdir(), `${baseOutputFilename}_final.srt`);
    s3SrtKey = `${baseOutputFilename}_final.srt`;
    // -----------------------------

    console.log(`[API] Input Path for Processing: ${finalInputPath}`);
    console.log(`[API] Intermediate Output Path: ${intermediateOutputPath}`);
    console.log(`[API] Final Output Path: ${finalOutputPath}`);
    console.log(`[API] FFmpeg Path: ${ffmpegInstaller.path}`);

    // --- Parameter Validation (including advanced music params) --- 
    const thresholdDb = parseFloat(params.thresholdDb ?? -40);
    const minDuration = parseFloat(params.minDuration ?? 0.2);
    const leftPadding = parseFloat(params.leftPadding ?? 0.0332);
    const rightPadding = parseFloat(params.rightPadding ?? 0.0332);
    const targetDurationParam = params.targetDuration ? parseFloat(params.targetDuration) : null;
    const transcribe = params.transcribe === true || params.transcribe === 'true';
    finalExportFormat = (params.exportFormat === 'mp3') ? 'mp3' : 'wav';
    // Music Params
    const addMusic = params.addMusic === true || params.addMusic === 'true';
    const autoSelectMusic = params.autoSelectMusic === true || params.autoSelectMusic === 'true';
    const musicTrackId = params.musicTrackId || null;
    const musicVolumeDb = params.musicVolumeDb ? parseFloat(params.musicVolumeDb) : -23; // Default to -23 dBFS
    const musicTargetLufs = params.musicTargetLufs ?? DEFAULT_MUSIC_TARGET_LUFS;
    const musicFadeoutThreshold = params.musicFadeoutThreshold ?? DEFAULT_MUSIC_FADEOUT_THRESHOLD_S;
    console.log(`[API Params] Transcription: ${transcribe}, Export Format: ${finalExportFormat}, Add Music: ${addMusic}, AutoSelect: ${autoSelectMusic}, Track ID: ${musicTrackId}, Music Volume: ${musicVolumeDb}dB, Music Target LUFS: ${musicTargetLufs}, Fade Threshold: ${musicFadeoutThreshold}s`);
    // ---------------------------------------------------------

    // --- FFmpeg Pass 1: Silence Removal --- 
    console.log("[API] Starting Pass 1: Silence Removal...");
    await new Promise((resolve, reject) => {
      let command = ffmpeg(finalInputPath);
      let complexFilter = [];
      const effectiveMinDuration = Math.max(0.01, minDuration - leftPadding - rightPadding);
      if (effectiveMinDuration < minDuration) {
        console.log(`[API P1] Applying silenceremove: stop_duration=${effectiveMinDuration.toFixed(4)}, stop_threshold=${thresholdDb}dB`);
        complexFilter.push(`silenceremove=stop_periods=-1:stop_duration=${effectiveMinDuration.toFixed(4)}:stop_threshold=${thresholdDb}dB`);
      } else {
        console.log(`[API P1] Skipping silenceremove.`);
      }
      
      if (complexFilter.length > 0) {
          command = command.audioFilters(complexFilter.join(','));
      } else {
         // If no silence removal is applied, we still need to copy the input to intermediate for the next step
         console.log("[API P1] No silence filter applied, copying input to intermediate path.");
      }

      command
        .toFormat('wav')
        .outputOptions('-ar 44100') // Keep consistent format
        .outputOptions('-ac 2')
        .on('start', (cmd) => console.log(`[API P1] Spawned Ffmpeg: ${cmd}`))
        .on('error', (err, stdout, stderr) => {
          console.error('[API P1] FFmpeg Error:', err.message);
          console.error('[API P1] FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg Pass 1 (Silence Removal) failed`)); 
        })
        .on('end', () => {
          console.log('[API P1] FFmpeg Pass 1 finished successfully.');
          resolve();
        })
        .save(intermediateOutputPath); // Save to intermediate path
    });
    // --- End FFmpeg Pass 1 ---

    // --- Check Intermediate File --- 
    if (!fs.existsSync(intermediateOutputPath) || fs.statSync(intermediateOutputPath).size === 0) {
      console.error('[API] Intermediate file missing or empty after Pass 1.');
      throw new Error('Silence removal process failed to produce output.');
    }
    // --- End Check ---

    // --- Probe Intermediate File Duration --- 
    let intermediateDuration = null;
    try {
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(intermediateOutputPath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata);
            });
        });
        intermediateDuration = metadata?.format?.duration;
        if (intermediateDuration === null || intermediateDuration === undefined) throw new Error('ffprobe could not extract duration');
        console.log(`[API Probe] Intermediate Duration (after silence removal): ${intermediateDuration}s`);
    } catch (probeError) {
        console.error('[API Probe] Error probing intermediate file duration:', probeError);
        // If we can't probe, we can't reliably apply target duration. Upload intermediate.
        console.warn('[API Probe] Could not determine intermediate duration. Skipping speed adjustment.');
        pathToUpload = intermediateOutputPath; // Mark intermediate for upload
    }
    // --- End Probe ---

    let actualPlaybackRate = 1.0;
    let runSecondPass = false;

    // --- Decide if Speed Adjustment (Pass 2) is Needed --- 
    if (pathToUpload === null && intermediateDuration !== null && targetDurationParam && targetDurationParam > 0) {
        // Only adjust speed if intermediate duration is significantly longer than target
        if (intermediateDuration > targetDurationParam + 0.01) { // Add tolerance
            actualPlaybackRate = intermediateDuration / targetDurationParam;
            actualPlaybackRate = Math.max(0.5, Math.min(100.0, actualPlaybackRate)); 
            console.log(`[API Calc] Intermediate ${intermediateDuration.toFixed(3)}s > Target ${targetDurationParam}s. Calculated rate: ${actualPlaybackRate.toFixed(4)}`);
            // We only speed up, check if calculated rate > 1
            if (actualPlaybackRate > 1.001) {
                 runSecondPass = true;
            } else {
                console.log(`[API Calc] Calculated rate ${actualPlaybackRate.toFixed(4)} <= 1.0. Skipping Pass 2.`);
                 pathToUpload = intermediateOutputPath; // Target duration met or exceeded, upload intermediate
            }
        } else {
            console.log(`[API Calc] Intermediate duration ${intermediateDuration.toFixed(3)}s <= Target ${targetDurationParam}s. Skipping Pass 2.`);
            pathToUpload = intermediateOutputPath; // Target duration already met, upload intermediate
        }
    } else if (pathToUpload === null) {
        // No target duration or probing failed, just use intermediate result
        console.log(`[API Calc] No target duration or probe failed. Using intermediate result.`);
        pathToUpload = intermediateOutputPath;
    }
    // --- End Decision Logic ---

    // --- FFmpeg Pass 2: Speed Adjustment (Conditional) --- 
    if (runSecondPass) {
        console.log("[API] Starting Pass 2: Speed Adjustment...");
        await new Promise((resolve, reject) => {
            let command = ffmpeg(intermediateOutputPath); // Input is the intermediate file
            let tempoFilter = `atempo=${actualPlaybackRate.toFixed(4)}`;
            console.log(`[API P2] Applying ${tempoFilter}`);
            command = command.audioFilters(tempoFilter);

            command
                .toFormat('wav')
                .outputOptions('-ar 44100')
                .outputOptions('-ac 2')
                .on('start', (cmd) => console.log(`[API P2] Spawned Ffmpeg: ${cmd}`))
                .on('error', (err, stdout, stderr) => {
                    console.error('[API P2] FFmpeg Error:', err.message);
                    console.error('[API P2] FFmpeg stderr:', stderr);
                    reject(new Error(`FFmpeg Pass 2 (Speed Adjustment) failed`)); 
                })
                .on('end', () => {
                    console.log('[API P2] FFmpeg Pass 2 finished successfully.');
                    resolve();
                })
                .save(finalOutputPath); // Save to final output path
        });
        pathToUpload = finalOutputPath; // Mark final output for upload
    }
    // --- End FFmpeg Pass 2 ---

    // --- Determine Base WAV Path (result of Pass 1 or Pass 2) --- 
    let wavPathToProcess = null;
    if (fs.existsSync(finalOutputPath)) {
         wavPathToProcess = finalOutputPath;
         console.log(`[API Base WAV] Path selected (from Pass 2): ${wavPathToProcess}`);
    } else if (fs.existsSync(intermediateOutputPath)) {
         console.log("[API Base WAV] Path selected (from Pass 1):", intermediateOutputPath);
         wavPathToProcess = intermediateOutputPath;
    } else {
         console.warn("[API Base WAV] Neither final nor intermediate exist. Using original input, processing might fail if not audio.");
         wavPathToProcess = finalInputPath; 
    }
    
    if (!wavPathToProcess || !fs.existsSync(wavPathToProcess)) {
        console.error(`[API Base WAV] Critical Error: Base WAV path not found or invalid: ${wavPathToProcess}`);
        throw new Error('Base audio file for processing not found.');
    }
    // --- End Base WAV Path Determination ---

    // --- Prepare Input for Whisper (MP3 from Base WAV) --- 
    const whisperTempMp3Path = path.join(os.tmpdir(), `${baseOutputFilename}_whisper_temp.mp3`);
    console.log(`[API Whisper Prep] Converting ${wavPathToProcess} to MP3 for Whisper: ${whisperTempMp3Path}...`);
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(wavPathToProcess) // Input is the final WAV before export formatting
                .audioCodec('libmp3lame')
                .audioBitrate('128k') // Lower bitrate might be fine for Whisper
                .toFormat('mp3')
                .on('error', (err, stdout, stderr) => {
                     console.error('[API Whisper Prep MP3] FFmpeg Error:', err.message);
                     console.error('[API Whisper Prep MP3] FFmpeg stderr:', stderr);
                     reject(new Error(`Failed to convert audio to MP3 for Whisper: ${err.message}`));
                })
                .on('end', () => {
                     console.log(`[API Whisper Prep MP3] Successfully converted to ${whisperTempMp3Path}`);
                     resolve();
                 })
                 .save(whisperTempMp3Path);
         });
         // Conversion successful, set the path for Whisper input
         whisperInputPath = whisperTempMp3Path;
    } catch (whisperMp3Error) {
         console.error("[API Whisper Prep MP3] Failed to convert. Transcription may fail.", whisperMp3Error);
    }
    // --- End Whisper Input Prep ---

    // --- Determine if Transcription is needed (for SRT or LLM) ---
    // Run if user wants SRT OR if auto music needs it (and OpenAI is configured)
    const needsTranscription = openai && (
        transcribe || 
        (addMusic && autoSelectMusic)
    );
    console.log(`[API Logic] Needs Transcription (for SRT or LLM)? ${needsTranscription}`);
    // ----------------------------------------------------------

    // --- Run Whisper Transcription (Conditional) ---
    if (needsTranscription) {
        if (!whisperInputPath || !fs.existsSync(whisperInputPath)) {
            console.error(`[API Transcribe Core] MP3 file for Whisper not found or conversion failed: ${whisperInputPath}. Cannot run transcription.`);
        } else {
            console.log(`[API Transcribe Core] Starting transcription using MP3: ${whisperInputPath}...`);
            try {
                const transcriptionResult = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(whisperInputPath),
                    model: "whisper-1",
                    response_format: "verbose_json",
                    timestamp_granularities: ["word"]
                });

                // Extract Full Transcript Text (always needed if transcription runs)
                fullTranscriptText = transcriptionResult.text || null;
                if (fullTranscriptText) {
                    console.log("[API Transcribe Core] Extracted full transcript text.");
                    console.log(`[API Transcribe Core] Transcript Text (start): "${fullTranscriptText.substring(0, 100)}..."`);
                } else {
                    console.warn("[API Transcribe Core] Could not extract full text from transcription result.");
                }

                // --- Handle SRT Generation/Upload ONLY if requested by user --- 
                if (transcribe) {
                    console.log("[API Transcribe SRT] User requested SRT file generation.");
                    if (transcriptionResult.words && transcriptionResult.words.length > 0) {
                         console.log("[API Transcribe SRT Raw Words]:", JSON.stringify(transcriptionResult.words.slice(0, 10), null, 2));
                        const srtContent = generateSrtFromWhisperWords(transcriptionResult.words);
                        if (srtContent) {
                            fs.writeFileSync(srtOutputPath, srtContent);
                            console.log(`[API Transcribe SRT] SRT file generated: ${srtOutputPath}`);
                            // Upload SRT to S3
                            console.log(`[API Transcribe SRT] Uploading SRT to S3 bucket: ${S3_BUCKET_NAME}, Key: ${s3SrtKey}`);
                            const srtUploadCommand = new PutObjectCommand({
                                Bucket: S3_BUCKET_NAME,
                                Key: s3SrtKey,
                                Body: fs.createReadStream(srtOutputPath),
                                ContentType: 'text/plain' // Or application/x-subrip
                            });
                            await s3Client.send(srtUploadCommand);
                            s3SrtUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3SrtKey}`;
                            console.log(`[API Transcribe SRT] SRT uploaded successfully: ${s3SrtUrl}`);
                        } else {
                            console.warn("[API Transcribe SRT] Generated SRT content was empty. No SRT file saved or uploaded.");
                        }
                    } else {
                        console.warn("[API Transcribe SRT] Transcription result missing word-level timestamps needed for SRT.");
                    }
                } else {
                    console.log("[API Transcribe SRT] User did not request SRT file generation. Skipping SRT processing.");
                }
                 // ------------------------------------------------------------

            } catch (transcriptionError) {
                console.error("[API Transcribe Core] Error during transcription API call:", transcriptionError);
                // Do not fail the request, just mark transcript as unavailable
                fullTranscriptText = null; 
            }
        }
    } else {
        console.log("[API Transcribe Core] Skipping transcription (OpenAI not configured, or not needed for SRT/LLM).");
    }
    // --- End Whisper Transcription ---

    // --- Base Path for Export (Starts as the processed VO) --- 
    let basePathForExport = wavPathToProcess;
    // ----------------------------------------------------------

    // --- Determine Music Track ID (Manual vs Auto) --- 
    let finalMusicTrackId = null;
    let musicFileUrl = null;
    let musicOriginalDuration = null;
    let musicOriginalLufs = null;
    
    if (addMusic) {
        if (musicTrackId) { // Manual selection takes precedence
            finalMusicTrackId = musicTrackId;
            console.log(`[API Music Select] Using manually selected track ID: ${finalMusicTrackId}`);
        } else if (autoSelectMusic) {
            console.log("[API Music Select] Auto-select requested. Fetching track list...");
            let tracks = [];
            try {
                // Use music service to get tracks
                tracks = await getAllMusicTracks();
                console.log(`[API Music Select] Fetched ${tracks.length} tracks for selection via service.`);
            } catch (listError) {
                console.error("[API Music Select] Error fetching track list via service:", listError);
            }

            // --- LLM Selection Logic --- 
            // Attempt LLM if auto-select is on, OpenAI is ready, and we have a transcript
            if (openai && fullTranscriptText && tracks.length > 0) { 
                console.log("[API Music Select LLM] Attempting LLM-based selection (using script, expecting title)...");
                try {
                    // Format the track list for the new prompt style
                    const trackOptionsString = tracks.map((t, index) => 
                        `${index + 1}. "${t.Title}" — ${t.Description || 'N/A'} [Mood: ${t.Mood || 'N/A'}]` // Use Title, Description, Mood from service object
                    ).join('\n');
                    
                    // Construct the new prompt
                    const combinedPrompt = `You're assisting an automated video production system by selecting the most suitable background music track based on the emotional tone and content of a provided story script.

Story Script:
---
${fullTranscriptText}
---

Available Music Options:
${trackOptionsString}

Based solely on the script's emotional tone and narrative context, select the most fitting music track from the list above.

Respond clearly with only the exact song title (no additional commentary or explanation).`;

                    console.log("[API Music Select LLM] Sending request to OpenAI with new prompt...");
                    // Use gpt-3.5-turbo as requested (closest to '03 mini')
                    const llmResponse = await openai.chat.completions.create({
                        model: "gpt-3.5-turbo",
                        messages: [
                            // Use a single user message with the combined prompt
                            { role: "user", content: combinedPrompt }, 
                        ],
                        temperature: 0.3, // Lower temperature for more deterministic title selection
                        max_tokens: 50, // Allow slightly more tokens for potential longer titles
                    });

                    const potentialTitle = llmResponse.choices[0]?.message?.content?.trim().replace(/^"|"$/g, '');
                    console.log(`[API Music Select LLM] Received potential title: '${potentialTitle}'`);

                    // Validate if the response is a valid TITLE from our list
                    const matchedTrack = tracks.find(t => t.Title === potentialTitle);
                    
                    if (matchedTrack) {
                        finalMusicTrackId = matchedTrack.Id; // Get the ID from the matched track
                        console.log(`[API Music Select LLM] Successfully matched title to track ID: ${finalMusicTrackId}`);
                    } else {
                        console.warn(`[API Music Select LLM] Response title '${potentialTitle}' does not match any available track titles. Skipping music addition.`);
                        // Skip music if LLM fails or returns non-matching title
                        finalMusicTrackId = null; 
                    }
                } catch (llmError) {
                    console.error("[API Music Select LLM] Error during OpenAI call:", llmError);
                    // Skip music on error
                    finalMusicTrackId = null;
                }
            } else {
                // --- Skip Music if LLM prerequisites not met --- 
                if (!openai) {
                    console.warn("[API Music Select] LLM selection skipped (OpenAI unavailable). Skipping music addition.");
                } else if (!fullTranscriptText) {
                    console.warn("[API Music Select] LLM selection skipped (No transcript text available). Skipping music addition.");
                } else if (tracks.length === 0) {
                    console.warn("[API Music Select] LLM selection skipped (No tracks available). Skipping music addition.");
                }
                finalMusicTrackId = null; // Ensure music is skipped
            }
            // --- End LLM / Skip Logic --- 
            
        } else {
             console.log("[API Music Select] Add Music enabled, but no Track ID provided and AutoSelect is off. Skipping music.");
        }
    } else {
        console.log("[API Music] No music track ID determined. Skipping music addition.");
    }
    // --- End Determine Music Track ID ---

    // --- Add Background Music (Conditional on having a finalMusicTrackId) --- 
    if (finalMusicTrackId) {
      console.log(`[API Music] Adding music track ID: ${finalMusicTrackId}`);
      if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) {
        console.error("[API Music] Cannot add music: NocoDB environment variables missing.");
        throw new Error("Server configuration error for music database.");
      }

      try {
        // 1. Fetch music track details using the service
        console.log(`[API Music] Fetching track details for ID ${finalMusicTrackId} via service...`);
        const record = await getMusicTrackById(finalMusicTrackId);
        if (!record) throw new Error(`Track ID ${finalMusicTrackId} not found.`);

        // Extract details from the service response object
        musicFileUrl = record.S3_URL;
        musicOriginalLufs = record.LUFS ? parseFloat(record.LUFS) : NaN; // Ensure LUFS is parsed
        musicOriginalDuration = record.Duration ? parseFloat(record.Duration) : NaN; // Ensure Duration is parsed

        if (!musicFileUrl) throw new Error(`'S3_URL' field missing for track ${finalMusicTrackId}.`);
        if (isNaN(musicOriginalLufs)) console.warn(`[API Music] LUFS value missing or invalid for track ${finalMusicTrackId}. Normalization might be skipped or fail.`);
        if (isNaN(musicOriginalDuration)) throw new Error(`'Duration' field missing or invalid for track ${finalMusicTrackId}.`);

        console.log(`[API Music] Details from service: URL=${musicFileUrl}, LUFS=${musicOriginalLufs}, Duration=${musicOriginalDuration}s`);

        // 2. Download music file
        const musicFileExtension = path.extname(new URL(musicFileUrl).pathname) || '.mp3';
        tempMusicPath = path.join(os.tmpdir(), `${baseOutputFilename}_music_orig${musicFileExtension}`);
        normalizedMusicPath = path.join(os.tmpdir(), `${baseOutputFilename}_music_norm.wav`); // Output normalized as WAV
        fadedMusicPath = path.join(os.tmpdir(), `${baseOutputFilename}_music_fade.wav`);      // Output faded as WAV
        await downloadFile(musicFileUrl, tempMusicPath);
        console.log(`[API Music] Download complete.`);

        // 3. Normalize Music Loudness (if LUFS data available)
        let musicPathForProcessing = tempMusicPath;
        if (!isNaN(musicOriginalLufs)) {
            console.log(`[API Music] Normalizing music to ${musicTargetLufs} LUFS -> ${normalizedMusicPath}`);
            await new Promise((resolve, reject) => {
                 ffmpeg(tempMusicPath)
                    .audioFilter(`loudnorm=I=${musicTargetLufs}:LRA=7:tp=-2`) // Example params, adjust LRA/tp if needed
                    .outputOptions('-ar 44100') // Ensure consistent sample rate
                    .toFormat('wav') // Normalize to WAV
                    .on('error', (err) => reject(new Error(`Music normalization failed: ${err.message}`)))
                    .on('end', resolve)
                    .save(normalizedMusicPath);
            });
            musicPathForProcessing = normalizedMusicPath;
            console.log(`[API Music] Normalization complete.`);
        } else {
             console.warn(`[API Music] Skipping loudness normalization due to missing LUFS data.`);
        }

        // --- Get VO Duration --- 
        console.log(`[API Music] Probing VO duration from: ${wavPathToProcess}`);
        const voMetadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(wavPathToProcess, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata);
            });
        });
        const voDuration = voMetadata?.format?.duration;
        if (typeof voDuration !== 'number' || voDuration <= 0) throw new Error('Could not determine VO duration.');
        console.log(`[API Music] VO Duration: ${voDuration} seconds`);
        // --- End Get VO Duration ---

        // 4. Apply Fade-Out Conditionally (if music shorter than VO)
        let musicPathBeforeTrim = musicPathForProcessing; // Start with normalized (or original)
        const FADE_DURATION_S = 3; // Duration of the fade in seconds
        if (musicOriginalDuration < voDuration) {
            console.log(`[API Music Fade] Music (${musicOriginalDuration}s) is shorter than VO (${voDuration}s). Applying fade-out.`);
            const fadeStartTime = Math.max(0, musicOriginalDuration - FADE_DURATION_S);
            console.log(`[API Music Fade] Fading out last ${FADE_DURATION_S}s starting at ${fadeStartTime.toFixed(2)}s -> ${fadedMusicPath}`);
            await new Promise((resolve, reject) => {
                ffmpeg(musicPathForProcessing) // Input is normalized (or original)
                    .audioFilter(`afade=t=out:st=${fadeStartTime.toFixed(4)}:d=${FADE_DURATION_S}`)
                    .outputOptions('-c:a pcm_s16le') // Ensure WAV codec
                    .toFormat('wav')
                    .on('error', (err) => reject(new Error(`Music conditional fade-out failed: ${err.message}`)))
                    .on('end', resolve)
                    .save(fadedMusicPath);
            });
            musicPathBeforeTrim = fadedMusicPath; // Use the faded path for trimming
            console.log(`[API Music Fade] Conditional fade-out complete.`);
        } else {
            console.log(`[API Music Fade] Music (${musicOriginalDuration}s) is not shorter than VO (${voDuration}s). Skipping fade-out.`);
        }

        // 5. Trim Music (input is normalized/faded path)
        trimmedMusicPath = path.join(os.tmpdir(), `${baseOutputFilename}_music_trim.wav`); // Output trimmed as WAV
        console.log(`[API Music Trim] Trimming music (${musicPathBeforeTrim}) to VO duration ${voDuration}s -> ${trimmedMusicPath}...`);
        await new Promise((resolve, reject) => {
           ffmpeg(musicPathBeforeTrim) // Use the potentially faded path
              .setStartTime(0)
              .setDuration(voDuration)
              // Re-encode to ensure format consistency after potential fade
              .outputOptions('-c:a pcm_s16le') 
              .toFormat('wav')
              .on('error', reject)
              .on('end', resolve)
              .save(trimmedMusicPath); // Save the final trimmed music
        });
        console.log(`[API Music Trim] Music trimmed.`);

        // 6. Apply Final Volume Adjustment to Trimmed Music (Temporarily Bypassed for Debugging)
        /*
        adjustedMusicPath = path.join(os.tmpdir(), `${baseOutputFilename}_music_adj.wav`);
        console.log(`[API Music Volume] Applying final volume adjustment (${musicVolumeDb}dB) -> ${adjustedMusicPath}...`);
        await new Promise((resolve, reject) => {
            ffmpeg(trimmedMusicPath) // Input is the trimmed music
                .audioFilter(`volume=${musicVolumeDb}dB`)
                .outputOptions('-c:a pcm_s16le') 
                .toFormat('wav')
                .on('error', (err) => reject(new Error(`Music volume adjustment failed: ${err.message}`)))
                .on('end', resolve)
                .save(adjustedMusicPath);
        });
        console.log(`[API Music Volume] Music volume adjusted.`);
        */
        console.log("[API Music Volume DEBUG] Bypassing final volume adjustment step.");
        // Use trimmed path directly for mixing in this debug step
        // const musicPathForMixing = trimmedMusicPath; 
        // --- DEBUG STEP 2: Use ORIGINAL downloaded music for mixing ---
        const musicPathForMixing = tempMusicPath; 
        console.log("[API Music Mix DEBUG] Using ORIGINAL downloaded music for mix.");
 
        // 7. Mix VO and Volume-Adjusted Music (Simple Mix)
        mixedOutputPath = path.join(os.tmpdir(), `${baseOutputFilename}_mixed.wav`);
        console.log(`[API Music Mix DEBUG] Mixing VO and ORIGINAL music -> ${mixedOutputPath}...`);
        await new Promise((resolve, reject) => {
            ffmpeg()
              .input(wavPathToProcess)       // Input 0: Voice Over
              .input(musicPathForMixing)    // Input 1: Using trimmed music directly for debug
              // Simple mix, duration determined by the first input (VO)
              .complexFilter(`[0:a][1:a]amix=inputs=2:duration=first[out]`)
              .map('[out]')
              .audioCodec('pcm_s16le') // Standard WAV codec
              .toFormat('wav')
              .on('error', (err, stdout, stderr) => {
                    console.error('[API Music Mix] FFmpeg Error:', err.message);
                    console.error('[API Music Mix] FFmpeg stderr:', stderr);
                    reject(new Error(`Failed to mix audio: ${err.message}`)); 
                })
              .on('end', () => {
                   console.log(`[API Music Mix] Successfully mixed audio.`);
                   resolve();
               })
              .save(mixedOutputPath);
        });
        // Mixing successful, update the base path for export
        basePathForExport = mixedOutputPath;
        console.log(`[API Music] Using mixed audio path for export: ${basePathForExport}`);

      } catch (musicError) {
         console.error("[API Music] Failed to add background music:", musicError);
         // Don't fail the whole request, just skip adding music
         // toast({ title: "Music Error", description: `Failed to add background music: ${musicError.message}. Proceeding without music.`, variant: "warning" }); // Send warning toast? No, backend can't toast.
         // Keep basePathForExport as the original processed VO
         console.warn("[API Music] Proceeding without background music due to error.");
      }
    } else {
        console.log("[API Music] No music track ID determined. Skipping music addition.");
    }
    // --- End Add Background Music ---

    // --- Final Conversion to Export Format (Conditional) --- 
    // Operates on basePathForExport (either original processed VO or the mixed audio)
    pathToUpload = basePathForExport; // Default to the base path
    if (finalExportFormat === 'mp3') {
        console.log(`[API Convert Export] Converting ${basePathForExport} to MP3 export format...`);
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(basePathForExport) // Input is the base path for export
                    .audioCodec('libmp3lame')
                    .audioBitrate('192k') 
                    .toFormat('mp3')
                    .on('error', (err, stdout, stderr) => { /* ... error handling ... */ reject(err); })
                    .on('end', () => { /* ... */ resolve(); })
                    .save(mp3OutputPath); // Save to final MP3 export path
             });
             pathToUpload = mp3OutputPath; // Update path for upload
             console.log(`[API Convert Export] Using MP3 export path for S3 upload: ${pathToUpload}`);
        } catch (mp3ExportError) {
             console.error("[API Convert Export] Failed to convert to MP3. Uploading original format instead.", mp3ExportError);
             // Keep pathToUpload as basePathForExport
        }
    }
    // Determine final S3 key/type *after* potential conversion
    const finalExtension = path.extname(pathToUpload)?.substring(1) || finalExportFormat; // Get extension or use requested format
    finalS3Key = `${baseOutputFilename}_final.${finalExtension}`;
    finalContentType = finalExtension === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    console.log(`[API Upload Prep] Final S3 Key: ${finalS3Key}, ContentType: ${finalContentType}`);
    // --- End Final Conversion ---

    // --- Output Handling (S3 Upload) --- 
    // Uploads the file at `pathToUpload` (WAV/MP3, potentially mixed)
    // Uses finalS3Key and finalContentType
    console.log(`[API Upload] Uploading final audio from: ${pathToUpload}`);
    
    // Check if S3 bucket is configured
    if (!S3_BUCKET_NAME || !s3Client) {
        console.error("[API] S3 Bucket Name or S3 Client is not configured. Cannot upload.");
        throw new Error('S3 is not configured for upload.');
    }

    // Upload final audio to S3 using finalS3Key and finalContentType
    console.log(`[API Upload] Uploading final audio to S3 bucket: ${S3_BUCKET_NAME}, Key: ${finalS3Key}`);
    const audioUploadCommand = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: finalS3Key, // Use the key with correct extension
        Body: fs.createReadStream(pathToUpload),
        ContentType: finalContentType // Use the correct content type
    });
    await s3Client.send(audioUploadCommand);
    // Use finalS3Key to construct the URL
    const s3AudioUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${finalS3Key}`;
    console.log(`[API Upload] Final audio uploaded successfully: ${s3AudioUrl}`);
    // --- End Output Handling ---

    // --- Send Response ---
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
    const responsePayload = {
            success: true,
        audioUrl: s3AudioUrl
    };
    if (s3SrtUrl) {
        responsePayload.srtUrl = s3SrtUrl; // Add SRT URL if generated
    }
    // --- Add logging before sending --- 
    console.log("[API Response] Payload being sent:", JSON.stringify(responsePayload, null, 2));
    // ---------------------------------
    res.end(JSON.stringify(responsePayload));
    console.log("[API] Request processed successfully. Response sent.");
    // --- End Send Response ---

  } catch (processError) {
    // --- Main Processing Error Handling --- 
    console.error('[API] Error during processing or response sending:', processError);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: processError instanceof Error ? processError.message : 'Processing failed' }));

  } finally {
      // --- Cleanup --- 
      console.log("[API] Starting cleanup...");
      const filesToDelete = [
          downloadedTempPath,    // Original download (if URL)
          intermediateOutputPath, // Silence removal output
          finalOutputPath,       // Speed adjustment output
          whisperInputPath,      // Temp MP3 for Whisper
          tempMusicPath,         // Downloaded original music
          trimmedMusicPath,      // Trimmed music
          mixedOutputPath,       // Mixed VO + Music
          mp3OutputPath,         // Final export MP3 (if created)
          srtOutputPath          // Generated SRT
        ];
      filesToDelete.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`[API Cleanup] Deleted: ${filePath}`);
            } catch (unlinkErr) {
                console.error(`[API Cleanup] Error deleting file ${filePath}:`, unlinkErr);
            }
        }
      });
      console.log("[API Cleanup] Cleanup finished.");
      // --- End Cleanup ---
  }
}

// REMOVED: Standalone server startup logic
/*
const entryPointUrl = pathToFileURL(process.argv[1]).href;
if (import.meta.url === entryPointUrl) {
  const PORT = process.env.PORT || 3001;
  http.createServer(handler).listen(PORT, () => {
    console.log(`[API Server] Listening on port ${PORT}`);
  });
}
*/ 