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

// --- AWS S3 Configuration --- 
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME } = process.env;

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

// Export default handler function
export default async function handler(req, res) {
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
  let finalOutputPath = null;

  try { // Wrap the main processing and cleanup

    // --- Determine Output Path --- 
    const originalFilename = files?.audioFile?.[0]?.originalFilename 
                              || (fields?.audioUrl?.[0] ? path.basename(new URL(fields.audioUrl[0]).pathname) : null) 
                              || 'audio.wav'; 
    const safeOriginalFilename = originalFilename.replace(/[^a-z0-9_.-]/gi, '_');
    const outputFilename = `processed_${path.parse(safeOriginalFilename).name}_${Date.now()}.wav`;
    finalOutputPath = path.join(os.tmpdir(), outputFilename);
    // Define S3 Key (using the same filename for consistency)
    const s3Key = outputFilename; 
    // -----------------------------

    console.log(`[API] Input Path for Processing: ${finalInputPath}`);
    console.log(`[API] Output Path: ${finalOutputPath}`);
    console.log(`[API] FFmpeg Path: ${ffmpegInstaller.path}`);

    // --- Get Original Duration & Calculate Rate --- 
    let originalDuration = null;
    let actualPlaybackRate = 1.0;
    try {
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(finalInputPath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata);
            });
        });
        originalDuration = metadata?.format?.duration;
        console.log(`[API] Original Duration: ${originalDuration}s`);

        const targetDurationParam = params.targetDuration ? parseFloat(params.targetDuration) : null;
        
        if (originalDuration && targetDurationParam && targetDurationParam > 0 && Math.abs(originalDuration - targetDurationParam) > 0.01) {
            actualPlaybackRate = originalDuration / targetDurationParam;
            actualPlaybackRate = Math.max(0.5, Math.min(100.0, actualPlaybackRate)); 
            console.log(`[API] Target duration ${targetDurationParam}s requested. Calculated rate: ${actualPlaybackRate.toFixed(4)}`);
        } else {
            console.log(`[API] No valid target duration specified or it matches original duration. Using rate: 1.0`);
            actualPlaybackRate = 1.0;
        }
    } catch (probeError) {
        console.error('[API] Error probing audio file duration:', probeError);
        actualPlaybackRate = 1.0;
        console.warn('[API] Could not determine original duration. Skipping speed adjustment.');
    }
    // --- End Duration & Rate Calc ---

    // --- Input Validation --- 
    const thresholdDb = parseFloat(params.thresholdDb ?? -40);
    const minDuration = parseFloat(params.minDuration ?? 0.2);
    const leftPadding = parseFloat(params.leftPadding ?? 0.0332);
    const rightPadding = parseFloat(params.rightPadding ?? 0.0332);
    // ------------------------

    // --- FFmpeg Processing --- 
    await new Promise((resolve, reject) => {
      let command = ffmpeg(finalInputPath);
      let complexFilter = [];

      // Silence Removal
      const effectiveMinDuration = Math.max(0.01, minDuration - leftPadding - rightPadding);
      if (effectiveMinDuration < minDuration) {
        console.log(`[API] Applying silenceremove: stop_duration=${effectiveMinDuration.toFixed(4)}, stop_threshold=${thresholdDb}dB`);
        complexFilter.push(`silenceremove=stop_periods=-1:stop_duration=${effectiveMinDuration.toFixed(4)}:stop_threshold=${thresholdDb}dB`);
      } else {
        console.log(`[API] Skipping silenceremove as effectiveMinDuration (${effectiveMinDuration.toFixed(4)}) >= minDuration (${minDuration.toFixed(4)}) due to padding.`);
      }

      // Speed/Tempo Filter (Conditional: Only Speed Up)
      if (actualPlaybackRate > 1.001) { // Only apply if rate > 1.0 (speeding up)
          let rate = actualPlaybackRate;
          let tempoFilter = '';
          console.log(`[API] Applying atempo for calculated rate: ${rate}`);
          if (rate >= 0.5 && rate <= 100.0) { // Should always be true due to clamping
              tempoFilter = `atempo=${rate.toFixed(4)}`;
          }
          if(tempoFilter) complexFilter.push(tempoFilter);
      } else {
          console.log(`[API] Calculated Playback rate <= 1.0 (${actualPlaybackRate.toFixed(4)}). Skipping tempo filter.`);
      }
      
      if (complexFilter.length > 0) {
          console.log('[API] Applying Complex Filter:', complexFilter.join(','));
          command = command.audioFilters(complexFilter.join(','));
      }

      command
        .toFormat('wav')
        .outputOptions('-ar 44100')
        .outputOptions('-ac 2')
        .on('start', (commandLine) => {
          console.log('[API] Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('error', (err, stdout, stderr) => {
          console.error('[API] FFmpeg Error:', err.message);
          console.error('[API] FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg processing failed`)); 
        })
        .on('end', (stdout, stderr) => {
          console.log('[API] FFmpeg processing finished successfully.');
          resolve();
        })
        .save(finalOutputPath); // Save to final output path
    });
    // --- End FFmpeg Processing ---

    // --- Check FFmpeg Output --- 
    if (!fs.existsSync(finalOutputPath) || fs.statSync(finalOutputPath).size === 0) {
      console.error('[API] Output file missing or empty after ffmpeg processing.');
      throw new Error('Processing resulted in an empty file.');
    }
    // --- End Check ---
    
    // --- Upload to S3 --- 
    console.log(`[API] Uploading ${finalOutputPath} to S3 bucket ${S3_BUCKET_NAME} as ${s3Key}...`);
    const fileStream = fs.createReadStream(finalOutputPath);
    const uploadParams = {
        Bucket: S3_BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        ContentType: 'audio/wav' // Set appropriate content type
    };
    try {
        await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`[API] Successfully uploaded to S3.`);
    } catch (s3Error) {
        console.error("[API] Error uploading to S3:", s3Error);
        throw new Error("Failed to upload processed file to storage."); // Throw specific error
    }
    // --- End Upload to S3 ---

    // --- Send Response (S3 URL) --- 
    const fileUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`[API] Sending success response with S3 URL: ${fileUrl}`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      fileUrl: fileUrl, // Return the S3 URL
      // Optionally include filename:
      // filename: outputFilename 
    }));
    // --- End Send Response ---

  } catch (processError) {
    // --- Main Processing Error Handling ---
    console.error('[API] Error during processing or response sending:', processError);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: processError instanceof Error ? processError.message : 'Processing failed' }));
    // --- End Main Processing Error Handling ---

  } finally {
      // --- Cleanup --- 
      // Clean up local ffmpeg output file AFTER potential S3 upload
      if (finalOutputPath && fs.existsSync(finalOutputPath)) {
          try { fs.unlinkSync(finalOutputPath); } catch(e){ console.error("Error deleting output temp file:", e); }
      }
      // Clean up input file ONLY if we downloaded it
      if (downloadedTempPath && fs.existsSync(downloadedTempPath)) {
          try { fs.unlinkSync(downloadedTempPath); } catch(e){ console.error("Error deleting downloaded temp file:", e); }
      }
      // Note: formidable might auto-cleanup uploaded files depending on options/setup.
      // If using explicit formidable cleanup: fs.unlinkSync(finalInputPath);
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