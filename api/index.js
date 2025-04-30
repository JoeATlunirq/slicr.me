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

  const thresholdDb = parseFloat(params.thresholdDb ?? -40);
  const minDuration = parseFloat(params.minDuration ?? 0.2);
  const leftPadding = parseFloat(params.leftPadding ?? 0.0332);
  const rightPadding = parseFloat(params.rightPadding ?? 0.0332);
  const appliedPlaybackRate = params.appliedPlaybackRate ? parseFloat(params.appliedPlaybackRate) : null;

  try {
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);
      let complexFilter = [];

      const effectiveMinDuration = Math.max(0.01, minDuration - leftPadding - rightPadding);
      if (effectiveMinDuration < minDuration) {
        console.log(`[API] Applying silenceremove: stop_duration=${effectiveMinDuration.toFixed(4)}, stop_threshold=${thresholdDb}dB`);
        complexFilter.push(`silenceremove=stop_periods=-1:stop_duration=${effectiveMinDuration.toFixed(4)}:stop_threshold=${thresholdDb}dB`);
      } else {
        console.log(`[API] Skipping silenceremove as effectiveMinDuration (${effectiveMinDuration.toFixed(4)}) >= minDuration (${minDuration.toFixed(4)}) due to padding.`);
      }

      if (appliedPlaybackRate && appliedPlaybackRate !== 1) {
          let rate = appliedPlaybackRate;
          let tempoFilter = '';
          console.log(`[API] Applying atempo for rate: ${rate}`);
          if (rate > 0 && rate < 0.5) {
              while (rate < 0.5) {
                  tempoFilter += 'atempo=0.5,';
                  rate /= 0.5;
              }
              if (rate > 0.5) tempoFilter += `atempo=${rate.toFixed(4)},`;
          } else if (rate > 100.0) {
               while (rate > 100.0) {
                  tempoFilter += 'atempo=100.0,';
                  rate /= 100.0;
              }
              tempoFilter += `atempo=${rate.toFixed(4)},`;
          } else if (rate >= 0.5 && rate <= 100.0) {
              tempoFilter = `atempo=${rate.toFixed(4)},`;
          } else {
              console.warn(`[API] Unsupported playback rate for atempo: ${appliedPlaybackRate}. Skipping tempo adjustment.`);
          }
          if (tempoFilter.endsWith(',')) {
             tempoFilter = tempoFilter.slice(0, -1);
          }
          if(tempoFilter) complexFilter.push(tempoFilter);
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

// Create and start the HTTP server only if this script is run directly (ESM way)
// Convert the entry point script path (process.argv[1]) to a file URL
// Compare it with the current module's URL (import.meta.url)
const entryPointUrl = pathToFileURL(process.argv[1]).href;
if (import.meta.url === entryPointUrl) {
  const PORT = process.env.PORT || 3001;
  http.createServer(handler).listen(PORT, () => {
    console.log(`[API Server] Listening on port ${PORT}`);
  });
} 