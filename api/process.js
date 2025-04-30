import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import http from 'http';
import { pathToFileURL } from 'url';
import process from 'process';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Keep Vercel specific config for compatibility if deploying there
export const config = {
  api: {
    bodyParser: false,
  },
};

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

  try {
    // Parse req directly (Node http request object)
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
          return;
        }
        resolve([fields, files]);
      });
    });
  } catch (err) {
    console.error('[API] Error parsing form data:', err);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Error parsing form data' }));
    return;
  }

  let params;
  try {
    if (!fields.params || !fields.params[0]) {
      throw new Error('Missing parameters');
    }
    params = JSON.parse(fields.params[0]);
    console.log('[API] Received Params:', params);
  } catch (err) {
    console.error('[API] Error parsing parameters:', err);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Invalid parameters format' }));
    return;
  }

  if (!files.audioFile || !files.audioFile[0]) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'No audio file uploaded' }));
    return;
  }

  const inputFile = files.audioFile[0];
  const inputPath = inputFile.filepath;
  const safeOriginalFilename = inputFile.originalFilename?.replace(/[^a-z0-9_.-]/gi, '_') || 'audio.wav';
  const outputFilename = `processed_${path.parse(safeOriginalFilename).name}_${Date.now()}.wav`;
  const outputPath = path.join(os.tmpdir(), outputFilename);

  console.log(`[API] Input File Path: ${inputPath}`);
  console.log(`[API] Output File Path: ${outputPath}`);
  console.log(`[API] FFmpeg Path: ${ffmpegInstaller.path}`);

  // --- Get Original Duration & Calculate Rate --- 
  let originalDuration = null;
  let actualPlaybackRate = 1.0; // Default to 1.0
  try {
      const metadata = await new Promise((resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, metadata) => {
              if (err) reject(err);
              else resolve(metadata);
          });
      });
      originalDuration = metadata?.format?.duration;
      console.log(`[API] Original Duration: ${originalDuration}s`);

      const targetDurationParam = params.targetDuration ? parseFloat(params.targetDuration) : null;
      
      if (originalDuration && targetDurationParam && targetDurationParam > 0 && Math.abs(originalDuration - targetDurationParam) > 0.01) { // Check if target is valid and different
          actualPlaybackRate = originalDuration / targetDurationParam;
          // Clamp rate to ffmpeg's atempo filter limits (0.5 to 100.0)
          actualPlaybackRate = Math.max(0.5, Math.min(100.0, actualPlaybackRate));
          console.log(`[API] Target duration ${targetDurationParam}s requested. Calculated rate: ${actualPlaybackRate.toFixed(4)}`);
      } else {
         console.log(`[API] No valid target duration specified or it matches original duration. Using rate: 1.0`);
         actualPlaybackRate = 1.0;
      }
  } catch (probeError) {
      console.error('[API] Error probing audio file duration:', probeError);
      // Decide if we should fail or just continue without speed change
      // Let's continue without speed change for robustness
      actualPlaybackRate = 1.0;
      console.warn('[API] Could not determine original duration. Skipping speed adjustment.');
  }
  // --- End Duration & Rate Calc ---

  // --- Input Validation (Basic) ---
  const thresholdDb = parseFloat(params.thresholdDb ?? -40);
  const minDuration = parseFloat(params.minDuration ?? 0.2);
  const leftPadding = parseFloat(params.leftPadding ?? 0.0332);
  const rightPadding = parseFloat(params.rightPadding ?? 0.0332);
  // removed appliedPlaybackRate validation, calculated above
  // ---------------------------------

  try {
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);
      let complexFilter = [];

      // --- Silence Removal Filter --- 
      const effectiveMinDuration = Math.max(0.01, minDuration - leftPadding - rightPadding);
      if (effectiveMinDuration < minDuration) {
        console.log(`[API] Applying silenceremove: stop_duration=${effectiveMinDuration.toFixed(4)}, stop_threshold=${thresholdDb}dB`);
        complexFilter.push(`silenceremove=stop_periods=-1:stop_duration=${effectiveMinDuration.toFixed(4)}:stop_threshold=${thresholdDb}dB`);
      } else {
        console.log(`[API] Skipping silenceremove as effectiveMinDuration (${effectiveMinDuration.toFixed(4)}) >= minDuration (${minDuration.toFixed(4)}) due to padding.`);
      }

      // --- Speed/Tempo Filter (using calculated rate) --- 
      if (actualPlaybackRate && Math.abs(actualPlaybackRate - 1.0) > 0.001) { // Check if rate needs applying
          let rate = actualPlaybackRate;
          let tempoFilter = '';
          console.log(`[API] Applying atempo for calculated rate: ${rate}`);
          // atempo filter range is 0.5 to 100.0. Apply multiple times if needed.
          if (rate >= 0.5 && rate <= 100.0) {
              tempoFilter = `atempo=${rate.toFixed(4)}`;
          } else {
              // This case shouldn't happen due to clamping above, but log just in case.
              console.warn(`[API] Calculated playback rate ${rate} is outside atempo range (0.5-100.0). Skipping tempo adjustment.`);
          }
          if(tempoFilter) complexFilter.push(tempoFilter);
      } else {
          console.log("[API] Playback rate is 1.0. Skipping tempo filter.");
      }
      // --------------------------
      
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
          if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch(e){ console.error("Error deleting temp file on error:", e); }
          }
          reject(new Error(`FFmpeg processing failed`)); 
        })
        .on('end', (stdout, stderr) => {
          console.log('[API] FFmpeg processing finished successfully.');
          resolve();
        })
        .save(outputPath);
    });
  } catch (ffmpegError) {
    console.error("[API] Ffmpeg Promise Error:", ffmpegError);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: ffmpegError.message || 'FFmpeg processing failed' }));
    return;
  }

  try {
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      console.error('[API] Output file missing or empty after ffmpeg processing.');
      throw new Error('Processing resulted in an empty file.');
    }

    const processedData = fs.readFileSync(outputPath);
    const base64Data = processedData.toString('base64');
    fs.unlinkSync(outputPath);

    console.log(`[API] Sending success response with file: ${outputFilename}`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      files: [{ filename: outputFilename, data: base64Data }],
    }));
  } catch (err) {
    console.error('[API] Error reading/encoding/sending processed file:', err);
    if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch(e){ console.error("Error deleting temp file on error:", e); }
    }
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message || 'Error handling processed file' }));
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