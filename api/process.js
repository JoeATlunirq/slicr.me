import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import http from 'http';
import { pathToFileURL } from 'url';
import process from 'process';
import axios from 'axios';
import ffprobeStatic from 'ffprobe-static';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from 'openai';

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
    bodyParser: {
      sizeLimit: '1mb', // Or a reasonable limit for JSON payload
    }
  },
};

// Helper to download file from URL (NO LONGER USED FOR PRIMARY INPUT)
// async function downloadFile(url, outputPath) { ... } 
// This helper might still be used for downloading music files, so we'll keep it
// but comment out its direct usage for the main audio input if that was the case.

// --- Helper: Download S3 Object to a temporary file path ---
async function downloadS3Object(bucket, key, downloadPath) {
  console.log(`[S3 Download] Attempting to download s3://${bucket}/${key} to ${downloadPath}`);
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(command);
    
    // Ensure response.Body is a readable stream
    if (!response.Body || typeof response.Body.pipe !== 'function') {
      throw new Error('S3 response body is not a readable stream.');
    }

    const writer = fs.createWriteStream(downloadPath);
    response.Body.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`[S3 Download] Successfully downloaded s3://${bucket}/${key} to ${downloadPath}`);
        resolve();
      });
      writer.on('error', (err) => {
        console.error(`[S3 Download] Error writing file ${downloadPath}:`, err);
        reject(err);
      });
      response.Body.on('error', (err) => { // Also catch errors on the S3 stream
        console.error(`[S3 Download] Error on S3 stream for s3://${bucket}/${key}:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`[S3 Download] Failed to download from S3 (s3://${bucket}/${key}):`, error);
    throw error; // Re-throw to be caught by the main handler
  }
}
// --- End Helper ---

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

// --- NocoDB Config --- 
const NOCODB_API_URL = process.env.NOCODB_API_URL;
const NOCODB_AUTH_TOKEN = process.env.NOCODB_AUTH_TOKEN;
const MUSIC_TABLE_NAME = 'MushyMedia Songs'; // Keep for reference/logging if needed
const NOCODB_MUSIC_TABLE_ID = 'mdfijlqr28f4ojj'; // The actual ID for API calls
// ---------------------

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-API-Key'); // Include X-API-Key if used

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let inputPath = null; // This will now be the path to the S3-downloaded file in /tmp
  let downloadedTempPath = null; // This specific variable might be reused or renamed for clarity
  let cleanupNeeded = true; // Assume cleanup is always needed for the downloaded S3 file
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
  let finalExportFormat = 'wav'; // Default, can be overridden by params
  let finalS3Key = ''; // This will be for the PROCESSED output if using S3
  let finalContentType = 'audio/wav'; // Default, can be overridden by params & final file type
  let pathToUpload = null; // Final path (mixed or not, converted or not) before S3 upload or binary stream
  let fullTranscriptText = null;
  let responseFormat = 'url'; // Initialize with default, will be overwritten by params

  try {
    // --- Get Input: Expect s3Key and params from JSON body ---
    // [fields, files] = await new Promise((resolve, reject) => { // REMOVE formidable parsing
    //   form.parse(req, (err, fields, files) => {
    //     if (err) {
    //       reject(err);
    //       return;
    //     }
    //     resolve([fields, files]);
    //   });
    // });

    const { s3Key, params: rawParams } = req.body;

    if (!s3Key || !rawParams) {
      console.error('[API] Missing s3Key or params in request body.');
      res.status(400).json({ success: false, error: 'Missing s3Key or params in request body' });
      return;
    }
    
    console.log(`[API] Received s3Key: ${s3Key}`);

    // Parameter Parsing (from rawParams)
    try {
        // if (!fields.params || !fields.params[0]) { // OLD parsing from formidable fields
        //     throw new Error('Missing parameters');
        // }
        // params = JSON.parse(fields.params[0]); // OLD parsing
        if (typeof rawParams === 'string') { // If params is a string, parse it
            params = JSON.parse(rawParams);
        } else if (typeof rawParams === 'object') { // If params is already an object
            params = rawParams;
        } else {
            throw new Error('Invalid parameters format. Expected object or JSON string.');
        }
        console.log('[API] Received and Parsed Params:', params);
        // --- Get responseFormat parameter ---
        responseFormat = params.responseFormat || 'url'; // Default to 'url'
        console.log(`[API] Response format set to: ${responseFormat}`);
        // ----------------------------------
    } catch (err) {
        console.error('[API] Error parsing parameters:', err);
        res.status(400).json({ success: false, error: 'Invalid parameters format' });
        return;
    }

    // --- Download the source file from S3 to a temporary location ---
    // Use a unique name for the downloaded file in /tmp to avoid collisions
    const tempDownloadedFileName = `s3_input_${Date.now()}_${path.basename(s3Key)}`;
    downloadedTempPath = path.join(os.tmpdir(), tempDownloadedFileName); // Assign to outer scope for cleanup
    inputPath = downloadedTempPath; // This is the path ffmpeg will use

    await downloadS3Object(S3_BUCKET_NAME, s3Key, downloadedTempPath);
    console.log(`[API] File from S3 key ${s3Key} downloaded to ${downloadedTempPath}`);
    // --- End S3 Download ---

    // Validate that the file was actually downloaded and is not empty
    if (!fs.existsSync(inputPath) || fs.statSync(inputPath).size === 0) {
        console.error(`[API] Downloaded file from S3 is missing or empty at ${inputPath}. Original S3 key: ${s3Key}`);
        throw new Error('Failed to download or access the source file from S3.');
    }

    // --- Original file upload/URL logic (REMOVE/COMMENT OUT) ---
    // if (files && files.audioFile && files.audioFile[0]) {
    //   inputPath = files.audioFile[0].filepath;
    //   console.log(`[API] Processing uploaded file: ${inputPath}`);
    //   cleanupNeeded = false; 
    // } else if (fields && fields.audioUrl && fields.audioUrl[0]) {
    //   const audioUrl = fields.audioUrl[0];
    //   console.log(`[API] Processing audio from URL: ${audioUrl}`);
    //   const tempFileName = `download_${Date.now()}_${path.basename(new URL(audioUrl).pathname)}`;
    //   downloadedTempPath = path.join(os.tmpdir(), tempFileName);
    //   await downloadFile(audioUrl, downloadedTempPath);
    //   inputPath = downloadedTempPath;
    //   cleanupNeeded = true;
    //   console.log(`[API] File downloaded to temporary path: ${inputPath}`);
    // } else {
    //   console.error('[API] No audio file uploaded and no audio URL provided.');
    //   res.status(400).json({ success: false, error: 'No audio file or URL provided' });
    //   return;
    // }
    // --- End Original file upload/URL logic ---
    
    // Determine finalExportFormat from params if provided, otherwise default
    finalExportFormat = params.exportFormat === 'mp3' ? 'mp3' : 'wav';
    console.log(`[API] Final export format set to: ${finalExportFormat}`);

    // --- Determine Output Paths --- 
    const originalFilename = path.basename(s3Key); // Use S3 key's basename as original filename
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

    console.log(`[API] Input Path for Processing: ${inputPath}`);
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
    
    // --- Read New Music Params ---
    // Use the new names from the frontend request
    const addMusic = params.addBackgroundMusic === true || params.addBackgroundMusic === 'true';
    const autoSelectMusic = params.autoSelectMusicTrack === true || params.autoSelectMusicTrack === 'true';
    let musicTrackId = addMusic ? (params.selectedMusicTrackId || null) : null; // Manual selection ID
    const musicVolumeDb = addMusic ? parseFloat(params.musicVolumeDb ?? DEFAULT_MUSIC_DUCKING_DB) : DEFAULT_MUSIC_DUCKING_DB;
    // --- End Reading New Music Params ---

    // Keep these for potential future use or clarification
    const musicTargetLufs = addMusic ? parseFloat(params.musicTargetLufs ?? DEFAULT_MUSIC_TARGET_LUFS) : DEFAULT_MUSIC_TARGET_LUFS; // Assuming this might still be a param? If not, remove.
    const musicFadeoutThreshold = addMusic ? parseFloat(params.musicFadeoutThreshold ?? DEFAULT_MUSIC_FADEOUT_THRESHOLD_S) : DEFAULT_MUSIC_FADEOUT_THRESHOLD_S; // Assuming this might still be a param? If not, remove.
    
    console.log(`[API Params] Transcription: ${transcribe}, Export Format: ${finalExportFormat}, Add Music: ${addMusic}, AutoSelect: ${autoSelectMusic}, Track ID: ${musicTrackId}, Music Volume: ${musicVolumeDb}dB, Music Target LUFS: ${musicTargetLufs}, Fade Threshold: ${musicFadeoutThreshold}s`);
    // ---------------------------------------------------------

    // --- FFmpeg Pass 1: Silence Removal --- 
    console.log("[API] Starting Pass 1: Silence Removal...");
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);
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
         wavPathToProcess = inputPath; 
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
    let tracks = []; // Declare tracks here, outside the 'if (addMusic)' block

    if (addMusic) {
        if (musicTrackId) { // Manual selection takes precedence
            finalMusicTrackId = musicTrackId;
            console.log(`[API Music Select] Using manually selected track ID: ${finalMusicTrackId}`);
        } else if (autoSelectMusic) {
            console.log("[API Music Select] Auto-select requested. Fetching track list...");
            tracks = []; // Reset/ensure it's empty before attempting fetch
            try {
                 // --- Determine Base URL based on Environment ---
                const isProduction = process.env.NODE_ENV === 'production';
                // Use VERCEL_URL if available (preferred for previews), fallback to hardcoded prod URL, else use localhost
                const baseUrl = isProduction 
                    ? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.slicr.me') 
                    : `http://localhost:${process.env.PORT || 3001}`; // Use PORT env var if set locally
                const listApiUrl = `${baseUrl}/api/music-tracks`;
                // ----------------------------------------------

                // --- Add Protection Bypass Header if secret is available ---
                const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET; // Use the actual env var name
                const requestHeaders = {};
                if (bypassSecret) {
                    requestHeaders['x-vercel-protection-bypass'] = bypassSecret;
                    console.log("[API Music Select] Added Vercel protection bypass header.");
                } else {
                     console.warn("[API Music Select] Vercel bypass secret env var not found. Internal call might fail if protection is active.");
                }
                // --- End Header Addition ---

                const trackListResponse = await axios.get(listApiUrl, { headers: requestHeaders }); // Pass headers here

                if (trackListResponse.data?.success && trackListResponse.data.tracks?.length > 0) {
                    tracks = trackListResponse.data.tracks; // Assign fetched tracks
                    console.log(`[API Music Select] Fetched ${tracks.length} tracks for selection.`);
                } else {
                    console.warn("[API Music Select] Could not fetch or parse track list for auto-selection. Response:", trackListResponse.data);
                }
            } catch (listError) {
                console.error("[API Music Select] Error fetching track list for auto-selection:", listError.message);
                // Ensure tracks remains [] on error
                tracks = []; 
            }

            // --- LLM Selection Logic --- 
            // Attempt LLM if auto-select is on, OpenAI is ready, and we have a transcript AND tracks
            if (openai && fullTranscriptText && tracks.length > 0) { 
                console.log("[API Music Select] Attempting LLM-based selection (using script, expecting title)...");
                try {
                    // Format the track list for the new prompt style
                    const trackOptionsString = tracks.map((t, index) => 
                        `${index + 1}. "${t.name}" — ${t.description || 'N/A'} [Mood: ${t.mood || 'N/A'}]`
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

                    const potentialTitle = llmResponse.choices[0]?.message?.content?.trim().replace(/^"|"$/g, ''); // Trim and remove surrounding quotes if any
                    console.log(`[API Music Select LLM] Received potential title: '${potentialTitle}'`);

                    // Validate if the response is a valid TITLE from our list
                    const matchedTrack = tracks.find(t => t.name === potentialTitle);
                    
                    if (matchedTrack) {
                        finalMusicTrackId = matchedTrack.id; // Get the ID from the matched track
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

    // Fallback to random: Now 'tracks' is accessible here
    if (addMusic && autoSelectMusic && !finalMusicTrackId && tracks.length > 0) {
      console.log('[API Music Select] LLM selection failed or yielded no match. Falling back to random selection.');
      const randomIndex = Math.floor(Math.random() * tracks.length);
      finalMusicTrackId = tracks[randomIndex].id;
      console.log(`[API Music Select] Randomly selected track ID: ${finalMusicTrackId}`);
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
        // 1. Fetch music track details from NocoDB
        // const recordUrl = `${NOCODB_API_URL}/tables/${encodeURIComponent(MUSIC_TABLE_NAME)}/records?where=(Song ID,eq,${encodeURIComponent(finalMusicTrackId)})`; // Use where filter
        // Construct URL using Table ID and where filter
        const recordUrl = `${NOCODB_API_URL}/tables/${NOCODB_MUSIC_TABLE_ID}/records?where=(Song ID,eq,${encodeURIComponent(finalMusicTrackId)})`;
        console.log(`[API Music] Fetching NocoDB record: ${recordUrl}`);
        const headers = { 'xc-token': NOCODB_AUTH_TOKEN };
        const nocoResponse = await axios.get(recordUrl, { headers });
        
        // NocoDB returns results in a list even with filter
        const record = nocoResponse.data?.list?.[0]; 
        if (!record) throw new Error(`Track ID ${finalMusicTrackId} not found in NocoDB.`);

        musicFileUrl = record['Url (S3)'];
        musicOriginalLufs = parseFloat(record['Lufs']); // Get LUFS
        // Assuming Duration is stored as seconds or easily parseable string
        musicOriginalDuration = parseFloat(record['Duration']); 

        if (!musicFileUrl) throw new Error(`'Url (S3)' field missing for track ${finalMusicTrackId}.`);
        if (isNaN(musicOriginalLufs)) console.warn(`[API Music] LUFS value missing or invalid for track ${finalMusicTrackId}. Normalization might be skipped or fail.`);
        if (isNaN(musicOriginalDuration)) throw new Error(`'Duration' field missing or invalid for track ${finalMusicTrackId}.`);

        console.log(`[API Music] Details: URL=${musicFileUrl}, LUFS=${musicOriginalLufs}, Duration=${musicOriginalDuration}s`);

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
    pathToUpload = basePathForExport; // Default to the base path (likely WAV at this point)

    if (finalExportFormat === 'mp3') {
        console.log(`[API Convert Export] Converting ${basePathForExport} to MP3 export format to ${mp3OutputPath}...`);
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(basePathForExport) 
                    .audioCodec('libmp3lame')
                    .audioBitrate('192k') 
                    .toFormat('mp3')
                    .on('start', (cmd) => console.log(`[API Convert Export MP3] Spawned Ffmpeg: ${cmd}`))
                    .on('error', (err, stdout, stderr) => {
                        console.error('[API Convert Export MP3] FFmpeg Error:', err.message);
                        console.error('[API Convert Export MP3] FFmpeg stderr:', stderr);
                        reject(new Error(`Final MP3 conversion failed: ${err.message}`));
                    })
                    .on('end', () => {
                        console.log('[API Convert Export MP3] FFmpeg final MP3 conversion finished successfully.');
                        resolve();
                    })
                    .save(mp3OutputPath); 
             });
            
            // Check if MP3 conversion was successful and file exists
            if (fs.existsSync(mp3OutputPath)) {
                 pathToUpload = mp3OutputPath; // Update path for upload/stream to the new MP3
                 console.log(`[API Convert Export] Successfully converted to MP3. Using path for S3 upload/binary stream: ${pathToUpload}`);
            } else {
                // This case implies the ffmpeg conversion failed silently or didn't produce output
                console.error(`[API Convert Export] MP3 file not found at ${mp3OutputPath} after conversion attempt. Original WAV will be used.`);
                // pathToUpload remains basePathForExport (the WAV file)
                // Update finalContentType and finalS3Key if we are falling back to WAV
                finalContentType = 'audio/wav'; 
                // Re-calculate S3 key based on WAV if needed, though for binary this might not be strictly necessary for S3 key itself
            }
        } catch (mp3ExportError) {
             console.error("[API Convert Export] Error during MP3 conversion process. Original WAV will be used.", mp3ExportError);
             // pathToUpload remains basePathForExport (the WAV file)
             finalContentType = 'audio/wav';
        }
    } else {
         console.log(`[API Convert Export] Export format is WAV. Using path: ${pathToUpload}`);
    }
    // Determine final S3 key/type *after* potential conversion or fallback
    const finalFileExtension = path.extname(pathToUpload)?.substring(1) || finalExportFormat;
    finalS3Key = `${baseOutputFilename}_final.${finalFileExtension}`;
    finalContentType = finalFileExtension === 'mp3' ? 'audio/mpeg' : 'audio/wav'; // Re-confirm content type based on actual pathToUpload
    console.log(`[API Upload Prep] Final path for operation: ${pathToUpload}, S3 Key: ${finalS3Key}, ContentType: ${finalContentType}`);
    // --- End Final Conversion ---

    // --- Prepare Paths and Keys for Response ---
    // `pathToUpload` (e.g., /tmp/processed_..._final.mp3) is the final local audio file path.
    // `finalS3Key` (e.g., processed_..._final.mp3) is the S3 key for this final audio file.
    // `s3SrtUrl` (e.g., https://bucket.s3.region.amazonaws.com/processed_..._final.srt) is the S3 URL for the SRT file if generated.
    // These are all determined earlier in the script.

    const finalAudioS3KeyForResponse = finalS3Key; // Use the globally determined finalS3Key
    const finalAudioLocalPathForStream = pathToUpload; // Use the globally determined pathToUpload

    console.log(`[Response Prep] Final S3 key for audio response: ${finalAudioS3KeyForResponse}`);
    console.log(`[Response Prep] Final local path for potential binary stream: ${finalAudioLocalPathForStream}`);

    // --- Send Response ---
    if (params.transcribe) {
      // If transcription is requested, always return JSON with audioUrl and srtUrl (if available)
      const successResponse = {
        success: true,
        audioUrl: `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${finalAudioS3KeyForResponse}`
      };
      if (s3SrtUrl) { // s3SrtUrl is the full URL to the SRT file, populated if transcription was successful
        successResponse.srtUrl = s3SrtUrl;
        console.log(`[API Success] Transcription true. JSON response. Adding SRT URL: ${s3SrtUrl}`);
      } else {
        console.log(`[API Success] Transcription true, but no SRT URL was generated (transcription might have failed or produced no SRT).`);
      }
      console.log("[API Success] Transcription requested. Sending JSON response with URLs.");
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(successResponse));
    } else {
      // If transcription is NOT requested, then respect responseFormat
      if (params.responseFormat === 'binary' && finalAudioLocalPathForStream && fs.existsSync(finalAudioLocalPathForStream)) {
        console.log(`[API Success] Transcription false, responseFormat is binary. Streaming file: ${finalAudioLocalPathForStream}`);
        res.statusCode = 200;
        const streamContentType = finalContentType || (params.exportFormat === 'mp3' ? 'audio/mpeg' : 'application/octet-stream');
        res.setHeader('Content-Type', streamContentType);
        
        const readStream = fs.createReadStream(finalAudioLocalPathForStream);
        readStream.pipe(res);

        readStream.on('end', () => {
          console.log('[API Success] Binary stream ended.');
        });
        readStream.on('error', (streamError) => {
          console.error('[API Error] Error streaming binary file:', streamError);
             if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Failed to stream processed file.' }));
          } else {
                res.end();
            }
        });
      } else {
        // Default to JSON response with only audioUrl (transcription false, responseFormat is 'url' or binary conditions not met)
        const successResponse = {
            success: true,
          audioUrl: `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${finalAudioS3KeyForResponse}`
        };
        console.log("[API Success] Transcription false. Sending JSON response with audioUrl.");
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(successResponse));
      }
    }

  } catch (processError) {
    // --- Main Processing Error Handling --- 
    console.error('[API] Error during processing or response sending:', processError);
    if (!res.headersSent) {
        res.status(500).json({ success: false, error: processError instanceof Error ? processError.message : 'Processing failed' });
    } else {
        console.error('[API Catch Block] Headers already sent, could not send error response.');
    }

  } finally {
      console.log("[API Main Finally] Starting cleanup for all temporary files...");
      const filesToDelete = [
          downloadedTempPath, intermediateOutputPath, finalOutputPath,
          whisperInputPath, tempMusicPath, normalizedMusicPath,
          fadedMusicPath, trimmedMusicPath, mixedOutputPath, mp3OutputPath, srtOutputPath
      ].filter(p => p); // Filter out null/undefined paths

      filesToDelete.forEach(filePath => {
          if (filePath && fs.existsSync(filePath)) {
              try {
                  fs.unlinkSync(filePath);
                  console.log(`[API Main Finally Cleanup] Deleted: ${filePath}`);
              } catch (unlinkErr) {
                  console.error(`[API Main Finally Cleanup] Error deleting file ${filePath}:`, unlinkErr);
              }
          }
      });
      console.log("[API Main Finally] Cleanup finished.");
  }
}