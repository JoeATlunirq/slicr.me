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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from 'openai';

// --- API Key Check --- 
const EXPECTED_API_KEY = process.env.PROCESS_API_KEY;
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

// Export default handler function
export default async function handler(req, res) {

  // --- API Key Verification --- 
  if (!EXPECTED_API_KEY) {
    console.error("[API Auth] CRITICAL: PROCESS_API_KEY environment variable not set on server.");
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Server configuration error.' }));
    return;
  }
  const providedApiKey = req.headers['x-api-key']; // Read from custom header (lowercase)
  if (providedApiKey !== EXPECTED_API_KEY) {
    console.warn(`[API Auth] Failed API Key attempt. Provided: ${providedApiKey}`);
    res.statusCode = 403; // Forbidden
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Invalid API Key.' }));
    return;
  }
  // --- End API Key Verification ---

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
  let params; // Declare params in the outer scope
  let intermediateOutputPath = null; // Declare intermediate path here
  let finalOutputPath = null; // Declare final path here
  let pathToUpload = null; // Declare upload path here
  let srtOutputPath = null; // Declare SRT output path
  let s3SrtKey = null; // Declare S3 key for SRT
  let mp3OutputPath = null; // Declare MP3 output path if needed
  let finalExportFormat = 'wav'; // Default export format
  let finalS3Key = ''; // S3 Key with correct extension
  let finalContentType = 'audio/wav'; // Default content type
  let whisperInputPath = null; // Separate path for Whisper input (always MP3)

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

    // --- Input Validation --- 
    const thresholdDb = parseFloat(params.thresholdDb ?? -40);
    const minDuration = parseFloat(params.minDuration ?? 0.2);
    const leftPadding = parseFloat(params.leftPadding ?? 0.0332);
    const rightPadding = parseFloat(params.rightPadding ?? 0.0332);
    const targetDurationParam = params.targetDuration ? parseFloat(params.targetDuration) : null;
    const transcribe = params.transcribe === true || params.transcribe === 'true'; // Check for boolean or string 'true'
    // Get requested export format, default to wav
    finalExportFormat = (params.exportFormat === 'mp3') ? 'mp3' : 'wav'; 
    console.log(`[API] Transcription requested: ${transcribe}`);
    console.log(`[API] Export format requested: ${finalExportFormat}`);
    // ------------------------

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

    // --- Determine Final Path to Use (WAV path before potential MP3 conversion) --- 
    let wavPathToProcess = null;
    if (fs.existsSync(finalOutputPath)) {
         wavPathToProcess = finalOutputPath;
         console.log(`[API] Base WAV path selected (from Pass 2): ${finalOutputPath}`);
    } else if (fs.existsSync(intermediateOutputPath)) {
         console.warn("[API] finalOutputPath doesn't exist, using intermediateOutputPath as base WAV."); 
         wavPathToProcess = intermediateOutputPath; // Fallback if Pass 2 didn't run/create file
    } else {
         console.warn("[API] Neither final nor intermediate WAV exist, falling back to original input path.");
         wavPathToProcess = finalInputPath; // Note: This might not be WAV!
         // Add check if input needs conversion for consistency? Or handle error?
         // For now, assume if we reach here, input was likely compatible or error occurred
    }
    
    if (!wavPathToProcess || !fs.existsSync(wavPathToProcess)) {
        console.error(`[API] Critical Error Before Conversion/Transcription: Base WAV path not found or invalid: ${wavPathToProcess}`);
        throw new Error('Base audio file for processing not found.');
    }
    // --- End Base WAV Path Determination ---

    // --- Prepare Input for Whisper (Always MP3) --- 
    // Create a temporary MP3 for Whisper regardless of final export format
    // Use a different temp filename to avoid conflicts if user also wants MP3 export
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
         console.error("[API Whisper Prep MP3] Failed to convert to MP3 for Whisper. Transcription may fail or be skipped.", whisperMp3Error);
         // Keep whisperInputPath as null
    }
    // --- End Whisper Input Prep ---

    // --- Final Conversion to Export Format (Conditional) --- 
    pathToUpload = wavPathToProcess; // Default to the determined WAV path for EXPORT
    if (finalExportFormat === 'mp3') {
        console.log(`[API Convert] Converting ${wavPathToProcess} to MP3...`);
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(wavPathToProcess)
                    .audioCodec('libmp3lame')
                    .audioBitrate('192k') // Example bitrate
                    .toFormat('mp3')
                    .on('error', (err, stdout, stderr) => {
                         console.error('[API Convert MP3] FFmpeg Error:', err.message);
                         console.error('[API Convert MP3] FFmpeg stderr:', stderr);
                         reject(new Error(`Failed to convert audio to MP3: ${err.message}`));
                    })
                    .on('end', () => {
                         console.log(`[API Convert MP3] Successfully converted to ${mp3OutputPath}`);
                         resolve();
                     })
                     .save(mp3OutputPath);
             });
             // Conversion successful, update path for upload and transcription
             pathToUpload = mp3OutputPath;
             console.log(`[API Convert] Using MP3 path for subsequent steps: ${pathToUpload}`);
        } catch (mp3Error) {
             console.error("[API Convert MP3] Failed to convert to MP3. Uploading WAV instead.", mp3Error);
             // Keep pathToUpload as the original WAV path
             // Reset final key and content type back to WAV as fallback
             finalS3Key = `${baseOutputFilename}_final.wav`;
             finalContentType = 'audio/wav';
             console.warn(`[API Convert MP3 Fallback] Reverted S3 Key to: ${finalS3Key}, ContentType: ${finalContentType}`);
        }
    }
    // --- End Final Conversion ---

    // --- Transcription (Optional) --- 
    // Uses the dedicated `whisperInputPath` (MP3)
    let s3SrtUrl = null;
    if (transcribe) {
        if (!openai) {
            console.warn("[API Transcribe] OpenAI client not initialized. Skipping.");
        // Check the dedicated whisperInputPath
        } else if (!whisperInputPath || !fs.existsSync(whisperInputPath)) { 
             console.error(`[API Transcribe] MP3 file for Whisper transcription not found or conversion failed: ${whisperInputPath}`);
        } else {
            console.log(`[API Transcribe] Starting transcription using MP3: ${whisperInputPath}...`);
            try {
                const transcription = await openai.audio.transcriptions.create({
                    // Use whisperInputPath here
                    file: fs.createReadStream(whisperInputPath), 
                    model: "whisper-1",
                    response_format: "verbose_json",
                    timestamp_granularities: ["word"]
                });
                
                // --- Log Raw Word Timestamps --- 
                if (transcription.words && transcription.words.length > 0) {
                    console.log("[API Transcribe Raw Words]:", JSON.stringify(transcription.words.slice(0, 10), null, 2)); // Log first 10 words
                }
                // -------------------------------

                console.log("[API Transcribe] Transcription successful. Generating SRT...");
                const srtContent = generateSrtFromWhisperWords(transcription.words);

                if (srtContent) {
                    fs.writeFileSync(srtOutputPath, srtContent);
                    console.log(`[API Transcribe] SRT file generated: ${srtOutputPath}`);

                    // Upload SRT to S3
                    console.log(`[API Transcribe] Uploading SRT to S3 bucket: ${S3_BUCKET_NAME}, Key: ${s3SrtKey}`);
                    const srtUploadCommand = new PutObjectCommand({
                        Bucket: S3_BUCKET_NAME,
                        Key: s3SrtKey,
                        Body: fs.createReadStream(srtOutputPath),
                        ContentType: 'text/plain' // Or application/x-subrip
                    });
                    await s3Client.send(srtUploadCommand);
                    // Construct S3 URL for SRT (adjust region/bucket format if needed)
                    s3SrtUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3SrtKey}`;
                    console.log(`[API Transcribe] SRT uploaded successfully: ${s3SrtUrl}`);

                } else {
                    console.warn("[API Transcribe] Generated SRT content was empty (no words found or processed?). No SRT file saved or uploaded.");
                }

            } catch (transcriptionError) {
                console.error("[API Transcribe] Error during transcription or SRT processing:", transcriptionError);
                // Do not fail the request, just skip SRT generation
            }
        }
    }
    // --- End Transcription ---

    // --- Output Handling --- 
    // Uploads the file at `pathToUpload` (WAV or MP3)
    console.log(`[API Upload] Uploading final audio from: ${pathToUpload}`);
    
    // --- Re-determine S3 Key and Content Type based on final path --- 
    const finalExtension = path.extname(pathToUpload).substring(1); // e.g., 'wav' or 'mp3'
    finalS3Key = `${baseOutputFilename}_final.${finalExtension}`;
    finalContentType = finalExtension === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    console.log(`[API Upload] Determined final S3 Key: ${finalS3Key}, ContentType: ${finalContentType}`);
    // --------------------------------------------------------------

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
      // Add whisperInputPath (whisperTempMp3Path) to files to delete
      const filesToDelete = [
          downloadedTempPath, 
          intermediateOutputPath, 
          finalOutputPath, 
          srtOutputPath, 
          mp3OutputPath, // Final export MP3 (if created)
          whisperInputPath // Temp MP3 for Whisper
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
      console.log("[API] Cleanup finished.");
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