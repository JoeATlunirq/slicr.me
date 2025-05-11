import React from 'react';
import { Link } from 'react-router-dom'; // Assuming React Router is used
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock'; // We'll create this helper next

const ApiDocs: React.FC = () => {

  const curlExample = `# Step 1: Get a pre-signed URL
# --- Replace YOUR_API_KEY_HERE if making direct API calls ---
PRESIGNED_RESPONSE=$(curl -X POST \\
  https://www.slicr.me/api/generate-upload-url \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -H 'Content-Type: application/json' \\
  -d '{"fileName": "my_audio.mp3", "contentType": "audio/mpeg"}')

UPLOAD_URL=$(echo $PRESIGNED_RESPONSE | jq -r .uploadUrl)
S3_KEY=$(echo $PRESIGNED_RESPONSE | jq -r .s3Key)

# Step 2: Upload the file directly to S3
# Replace /path/to/your/audio.mp3 with the actual file path
curl -X PUT -T "/path/to/your/audio.mp3" \\
  -H "Content-Type: audio/mpeg" \\
  "$UPLOAD_URL"

# Step 3: Process the file
# --- Replace YOUR_API_KEY_HERE if making direct API calls ---
curl -X POST \\
  https://www.slicr.me/api/process \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "s3Key": "'"$S3_KEY"'",
    "params": {
      "thresholdDb": -40,
      "minDuration": 0.2,
      "leftPadding": 0.05,
      "rightPadding": 0.05,
      "targetDuration": 60.0,
      "transcribe": true,
      "exportFormat": "mp3",
      "addBackgroundMusic": true,
      "autoSelectMusicTrack": false,
      "selectedMusicTrackId": "your_track_id_here",
      "musicVolumeDb": -18,
      "responseFormat": "binary"
    }
  }'`;

  const jsExample = `// Replace 'YOUR_API_KEY_HERE' if making direct API calls
const apiKey = 'YOUR_API_KEY_HERE'; // Keep null if requests are from slicr.me UI

async function processAudioWithSlicr(audioFile, processingParams) {
  try {
    // Step 1: Get a pre-signed URL from your backend
    console.log("Step 1: Getting pre-signed URL...");
    const presignedUrlResponse = await fetch('https://www.slicr.me/api/generate-upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add API key header if apiKey is set (for direct calls)
        ...(apiKey && { 'X-API-Key': apiKey })
      },
      body: JSON.stringify({
        fileName: audioFile.name,
        contentType: audioFile.type
      })
    });

    if (!presignedUrlResponse.ok) {
      const errorData = await presignedUrlResponse.json().catch(() => ({ error: 'Failed to get pre-signed URL, invalid JSON response' }));
      throw new Error(\`Failed to get pre-signed URL: \${presignedUrlResponse.status} \${errorData.error || presignedUrlResponse.statusText}\`);
    }
    const { uploadUrl, s3Key } = await presignedUrlResponse.json();
    console.log("Pre-signed URL and s3Key obtained:", uploadUrl, s3Key);

    // Step 2: Upload the file directly to S3 using the pre-signed URL
    console.log("Step 2: Uploading file to S3...");
    const s3UploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': audioFile.type
      },
      body: audioFile
    });

    if (!s3UploadResponse.ok) {
      throw new Error(\`S3 upload failed: \${s3UploadResponse.status} \${s3UploadResponse.statusText}\`);
    }
    console.log("File uploaded to S3 successfully.");

    // Step 3: Call the process API with the s3Key
    console.log("Step 3: Calling process API...");
    const processResponse = await fetch('https://www.slicr.me/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add API key header if apiKey is set (for direct calls)
        ...(apiKey && { 'X-API-Key': apiKey })
      },
      body: JSON.stringify({
        s3Key: s3Key,
        params: processingParams
      })
    });

    if (!processResponse.ok) {
      // Handle non-JSON error responses if necessary
      const errorData = await processResponse.json().catch(() => ({ error: 'Processing failed, invalid JSON response' }));
      throw new Error(\`Processing API error: \${processResponse.status} \${errorData.error || processResponse.statusText}\`);
    }

    const data = await processResponse.json();
    console.log('Success:', data);
    // data format: { success: true, audioUrl: string, srtUrl?: string }
    return data;

  } catch (error) {
    console.error('Error during Slicr processing:', error);
    // error format: { success: false, error: string } or Error object
    throw error;
  }
}

// --- Example Usage ---
// const myAudioFile = new File(["content"], "example.mp3", { type: "audio/mpeg" }); // Get your File object
// const myParams = {
//   thresholdDb: -40,
//   minDuration: 0.2,
//   transcribe: true,
//   exportFormat: "mp3"
// };

// processAudioWithSlicr(myAudioFile, myParams)
//   .then(result => console.log("Final Result:", result))
//   .catch(err => console.error("Final Error:", err));
`;

  const successResponseProcessExample = `{
  "success": true,
  "audioUrl": "https://your-bucket-name.s3.your-region.amazonaws.com/processed_audio_1234567890.mp3",
  "srtUrl": "https://your-bucket-name.s3.your-region.amazonaws.com/processed_audio_1234567890.srt" // Only present if requested and successful
}`;

  const errorResponseExample = `{
  "success": false,
  "error": "Error message describing the issue (e.g., 'Failed to download from S3', 'FFmpeg processing failed', 'Transcription failed')"
}`;

  const generateUrlSuccessResponseExample = `{
  "success": true,
  "uploadUrl": "https://your-s3-bucket.s3.your-region.amazonaws.com/uploads/your-unique-key.mp3?AWSAccessKeyId=...",
  "s3Key": "uploads/your-unique-key.mp3"
}`;

  const generateUrlErrorResponseExample = `{
  "success": false,
  "error": "Missing fileName or contentType in request body."
}`;


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" className="p-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Slicr.me API Documentation</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Overview - New Upload Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>To handle larger files and improve reliability, the Slicr.me API uses a three-step process for file uploads and processing:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Generate Upload URL:</strong> Your client requests a secure, pre-signed URL from the Slicr.me API specifically for uploading your audio file.
              </li>
              <li>
                <strong>Upload to S3:</strong> Your client uses this pre-signed URL to upload the audio file directly to AWS S3. This bypasses limitations of sending large files through the main API server.
              </li>
              <li>
                <strong>Process File:</strong> After the S3 upload is successful, your client notifies the Slicr.me API using the unique key associated with the S3 upload, along with your desired processing parameters. The API then fetches the file from S3 and processes it.
              </li>
            </ol>
            <p className="text-sm text-muted-foreground">This multi-step approach is crucial for robustly handling potentially large audio files.</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Generate Upload URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Request a pre-signed S3 URL to upload your audio file.</p>
            <ul>
              <li><strong>Method:</strong> <code className="bg-muted px-1 rounded">POST</code></li>
              <li><strong>Content-Type:</strong> <code className="bg-muted px-1 rounded">application/json</code></li>
              <li><strong>URL:</strong> <code className="bg-muted px-1 rounded">https://www.slicr.me/api/generate-upload-url</code></li>
              <li><strong>Authentication:</strong> Requires an API key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header for direct API calls (same as <code className="bg-muted px-1 rounded">/api/process</code>). Not needed if called from the official UI.</li>
            </ul>
            <h4 className="font-semibold mt-4">Request Body (JSON):</h4>
            <CodeBlock language="json" code={`{\n  "fileName": "your_audio_file.mp3",\n  "contentType": "audio/mpeg"\n}`} />
            <p className="text-sm text-muted-foreground"><code className="font-mono">fileName</code>: The desired name of your file. <br/><code className="font-mono">contentType</code>: The MIME type of your file (e.g., "audio/mpeg", "audio/wav").</p>

            <h4 className="font-semibold mt-4">Success Response (Status Code 200):</h4>
            <CodeBlock language="json" code={generateUrlSuccessResponseExample} />
            <p className="text-sm text-muted-foreground">The <code className="bg-muted px-1 rounded">uploadUrl</code> is the pre-signed S3 URL you'll use for the PUT request in Step 2. The <code className="bg-muted px-1 rounded">s3Key</code> is the identifier you'll send to <code className="bg-muted px-1 rounded">/api/process</code> in Step 3.</p>

            <h4 className="font-semibold mt-4">Error Response (Status Code 4xx or 5xx):</h4>
            <CodeBlock language="json" code={generateUrlErrorResponseExample} />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 2: Upload File Directly to S3</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Use the <code className="bg-muted px-1 rounded">uploadUrl</code> obtained from Step 1 to upload your audio file directly to AWS S3.</p>
            <ul>
              <li><strong>Method:</strong> <code className="bg-muted px-1 rounded">PUT</code></li>
              <li><strong>URL:</strong> The <code className="bg-muted px-1 rounded">uploadUrl</code> from the <code className="bg-muted px-1 rounded">/api/generate-upload-url</code> response.</li>
              <li><strong>Headers:</strong>
                <ul className="list-disc list-inside ml-4">
                  <li><code className="bg-muted px-1 rounded">Content-Type</code>: Must match the <code className="font-mono">contentType</code> you provided in Step 1 (e.g., "audio/mpeg").</li>
                </ul>
              </li>
              <li><strong>Body:</strong> The raw binary data of your audio file.</li>
            </ul>
            <p className="text-sm text-muted-foreground">A successful upload will typically return an HTTP 200 OK status from S3 with an empty body or an ETag header.</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 3: Process File (Modified Endpoint)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>After successfully uploading the file to S3, call this endpoint to trigger the processing.</p>
            <ul>
              <li><strong>Method:</strong> <code className="bg-muted px-1 rounded">POST</code></li>
              <li><strong>Content-Type:</strong> <code className="bg-muted px-1 rounded">application/json</code> (Note: No longer multipart/form-data)</li>
              <li><strong>URL:</strong> <code className="bg-muted px-1 rounded">https://www.slicr.me/api/process</code></li>
              <li><strong>Authentication:</strong> Requires an API key in the <code className="bg-muted px-1 rounded">X-API-Key</code> header for direct API calls.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Request Body (JSON)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>The request body must be a JSON object with the following fields:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong><code className="bg-muted px-1 rounded">s3Key</code></strong> (Required - String)
                <ul className="list-circle list-inside ml-4 text-sm text-muted-foreground">
                  <li>The <code className="font-mono">s3Key</code> returned by the <code className="bg-muted px-1 rounded">/api/generate-upload-url</code> endpoint after successful S3 pre-signed URL generation. This tells the server which file in S3 to process.</li>
                  <li>Example: <code className="font-mono">"uploads/your-unique-key.mp3"</code></li>
                </ul>
              </li>
              <li>
                <strong><code className="bg-muted px-1 rounded">params</code></strong> (Required - Object)
                <ul className="list-circle list-inside ml-4 text-sm text-muted-foreground">
                  <li>A JSON object containing the processing parameters. See details in the table below.</li>
                </ul>
              </li>
            </ul>
             <h4 className="font-semibold mt-4">Example JSON Body:</h4>
            <CodeBlock language="json" code={`{\n  "s3Key": "uploads/your-unique-key.mp3",\n  "params": {\n    "thresholdDb": -40,\n    "minDuration": 0.2,\n    "transcribe": true,\n    "exportFormat": "mp3"\n    // ... other parameters ...\n  }\n}`} />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Response Format (for /api/process)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p>The API will respond with a JSON object.</p>
             <div>
                <h4 className="font-semibold mb-2">Success (Status Code 200):</h4>
                 <p className="text-sm mb-2">Indicates successful processing. The <code className="bg-muted px-1 rounded">audioUrl</code> field contains a publicly accessible URL to the processed audio file (WAV or MP3) stored in AWS S3. If transcription was requested and successful, the <code className="bg-muted px-1 rounded">srtUrl</code> field will also be present.</p>
                <CodeBlock language="json" code={successResponseProcessExample} />
             </div>
             <div>
                <h4 className="font-semibold mb-2">Error (Status Code 4xx or 5xx):</h4>
                 <p className="text-sm mb-2">Indicates an error occurred during processing or request handling. The <code className="bg-muted px-1 rounded">error</code> field provides details.</p>
                <CodeBlock language="json" code={errorResponseExample} />
             </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Processing Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>The <code className="bg-muted px-1 rounded">params</code> object in the request body must contain the following fields:</p>
            <table className="border-collapse border border-border w-full">
              <tbody>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">thresholdDb</code></td>
                  <td className="border border-border p-2">Number</td>
                  <td className="border border-border p-2">The threshold in decibels (dB) for detecting speech. Lower values detect more speech.</td>
                  <td className="border border-border p-2"><code className="font-mono">-40</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">minDuration</code></td>
                  <td className="border border-border p-2">Number</td>
                  <td className="border border-border p-2">The minimum duration of speech in seconds.</td>
                  <td className="border border-border p-2"><code className="font-mono">0.2</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">leftPadding</code></td>
                  <td className="border border-border p-2">Number</td>
                  <td className="border border-border p-2">The left padding in seconds before the detected speech.</td>
                  <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">rightPadding</code></td>
                  <td className="border border-border p-2">Number</td>
                  <td className="border border-border p-2">The right padding in seconds after the detected speech.</td>
                  <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">targetDuration</code></td>
                  <td className="border border-border p-2">Number</td>
                  <td className="border border-border p-2">The target duration of the processed audio in seconds.</td>
                  <td className="border border-border p-2"><code className="font-mono">60.0</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">transcribe</code></td>
                  <td className="border border-border p-2">Boolean</td>
                  <td className="border border-border p-2">Set to <code className="font-mono">true</code> to enable transcription.</td>
                  <td className="border border-border p-2"><code className="font-mono">true</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">exportFormat</code></td>
                  <td className="border border-border p-2">String</td>
                  <td className="border border-border p-2">Desired output format for the audio file. Options: 'wav' (default) or 'mp3'.</td>
                  <td className="border border-border p-2"><code className="font-mono">"mp3"</code></td>
                </tr>
                {/* --- Music Parameters Start --- */}
                <tr className="bg-muted/50">
                  <td colSpan={4} className="border border-border p-2 font-semibold">Music Parameters (All are optional; only used if <code className="font-mono">addBackgroundMusic</code> is true)</td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">addBackgroundMusic</code></td>
                  <td className="border border-border p-2">Boolean</td>
                  <td className="border border-border p-2">Set to <code className="font-mono">true</code> to enable adding background music. (Default: <code className="font-mono">false</code>)</td>
                  <td className="border border-border p-2"><code className="font-mono">true</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">autoSelectMusicTrack</code></td>
                  <td className="border border-border p-2">Boolean</td>
                  <td className="border border-border p-2">Only relevant if <code className="font-mono">addBackgroundMusic</code> is true. If true, the server attempts to automatically select a suitable track. (Default: <code className="font-mono">false</code>)</td>
                  <td className="border border-border p-2"><code className="font-mono">true</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">selectedMusicTrackId</code></td>
                  <td className="border border-border p-2">String | null</td>
                  <td className="border border-border p-2">Only relevant if <code className="font-mono">addBackgroundMusic</code> is true and <code className="font-mono">autoSelectMusicTrack</code> is false. Provide the ID of the desired music track.</td>
                  <td className="border border-border p-2"><code className="font-mono">"your_track_id"</code></td>
                </tr>
                <tr>
                  <td className="border border-border p-2"><code className="font-mono">musicVolumeDb</code></td>
                  <td className="border border-border p-2">Number</td>
                  <td className="border border-border p-2">Only relevant if <code className="font-mono">addBackgroundMusic</code> is true. Sets the target volume level for the background music relative to the main audio in dB. (Default: <code className="font-mono">-18</code>)</td>
                  <td className="border border-border p-2"><code className="font-mono">-15</code></td>
                </tr>
                 {/* --- Music Parameters End --- */}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Parameters Object (JSON String)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p>The <code className="bg-muted px-1 rounded">params</code> object, nested within the JSON body of the request to <code className="bg-muted px-1 rounded">/api/process</code>, must contain a valid JSON object with the following keys:</p>
             <table className="w-full text-sm border-collapse border border-border">
               <thead>
                 <tr className="bg-muted">
                   <th className="border border-border p-2 text-left">Parameter</th>
                   <th className="border border-border p-2 text-left">Type</th>
                   <th className="border border-border p-2 text-left">Description</th>
                   <th className="border border-border p-2 text-left">Example</th>
                 </tr>
               </thead>
               <tbody>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">thresholdDb</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Silence threshold in dBFS. Audio below this level is considered silent. Range: -60 to 0.</td>
                   <td className="border border-border p-2"><code className="font-mono">-40</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">minDuration</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Minimum duration (in seconds) for a segment to be considered silent.</td>
                   <td className="border border-border p-2"><code className="font-mono">0.2</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">leftPadding</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Duration (in seconds) of silence to keep *before* a detected silent section (shortens cut from start).</td>
                   <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">rightPadding</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Duration (in seconds) of silence to keep *after* a detected silent section (shortens cut from end).</td>
                   <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">targetDuration</code></td>
                   <td className="border border-border p-2">Number | null</td>
                   <td className="border border-border p-2">Target final duration in seconds. If provided and audio is longer, it will be sped up. <code className="font-mono">null</code> for no speed change.</td>
                   <td className="border border-border p-2"><code className="font-mono">60.0</code> or <code className="font-mono">null</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">transcribe</code></td>
                    <td className="border border-border p-2">Boolean</td>
                   <td className="border border-border p-2">If true, attempts to generate word-level SRT subtitles using Whisper. (Default: false)</td>
                   <td className="border border-border p-2"><code className="font-mono">true</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">exportFormat</code></td>
                   <td className="border border-border p-2">String</td>
                   <td className="border border-border p-2">Desired output format. Options: 'wav' (default) or 'mp3'.</td>
                   <td className="border border-border p-2"><code className="font-mono">"mp3"</code></td>
                 </tr>
                 {/* --- Music Parameters Start --- */}
                 <tr className="bg-muted/50">
                   <td colSpan={4} className="border border-border p-2 font-semibold">Music Parameters</td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">addBackgroundMusic</code></td>
                   <td className="border border-border p-2">Boolean</td>
                   <td className="border border-border p-2">Set to <code className="font-mono">true</code> to enable adding background music. (Default: <code className="font-mono">false</code>)</td>
                   <td className="border border-border p-2"><code className="font-mono">true</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">autoSelectMusicTrack</code></td>
                   <td className="border border-border p-2">Boolean</td>
                   <td className="border border-border p-2">Only if <code className="font-mono">addBackgroundMusic</code> is true. If true, server attempts auto-selection. (Default: <code className="font-mono">false</code>)</td>
                   <td className="border border-border p-2"><code className="font-mono">true</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">selectedMusicTrackId</code></td>
                   <td className="border border-border p-2">String | null</td>
                   <td className="border border-border p-2">Only if <code className="font-mono">addBackgroundMusic</code> is true and <code className="font-mono">autoSelectMusicTrack</code> is false. Provide the ID of the desired music track.</td>
                   <td className="border border-border p-2"><code className="font-mono">"your_track_id"</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">musicVolumeDb</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Only if <code className="font-mono">addBackgroundMusic</code> is true. Target music volume relative to voice (dB). (Default: <code className="font-mono">-18</code>)</td>
                   <td className="border border-border p-2"><code className="font-mono">-15</code></td>
                 </tr>
                  {/* --- Music Parameters End --- */}
                 {/* --- New Response Format Parameter --- */}
                 <tr className="bg-muted/50">
                   <td colSpan={4} className="border border-border p-2 font-semibold">Response Format</td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">responseFormat</code></td>
                   <td className="border border-border p-2">String</td>
                   <td className="border border-border p-2">Determines the response type for the processed audio. Options: <br/>- <code className="font-mono">"url"</code> (default): Returns a JSON response containing an <code className="font-mono">audioUrl</code> to the processed audio file. If <code className="font-mono">transcribe</code> is also <code className="font-mono">true</code> and transcription succeeds, this JSON will also include an <code className="font-mono">srtUrl</code>. <br/>- <code className="font-mono">"binary"</code>: Returns the processed audio file directly as a binary stream (e.g., <code className="font-mono">audio/mpeg</code> or <code className="font-mono">audio/wav</code>). If <code className="font-mono">transcribe</code> is <code className="font-mono">true</code> and transcription succeeds, the URL to the SRT file will be provided in a custom HTTP header: <code className="font-mono">X-Srt-Url</code>.</td>
                   <td className="border border-border p-2"><code className="font-mono">"binary"</code> or <code className="font-mono">"url"</code></td>
                 </tr>
                 {/* --- End New Response Format Parameter --- */}
               </tbody>
             </table>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Example Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div>
                <h4 className="font-semibold mb-2">cURL Example (Audio as Binary, SRT URL in Header):</h4>
                 <p className="text-sm mb-2 text-muted-foreground">This example requests <code className="font-mono">responseFormat: "binary"</code> and <code className="font-mono">transcribe: true</code>. The audio is streamed directly. To save it, add <code className="font-mono"> &gt; processed_audio.mp3</code> to the cURL command. The SRT URL (if transcription succeeds) will be in the <code className="font-mono">X-Srt-Url</code> response header. Use <code className="font-mono">curl -v ...</code> to see headers.</p>
                <CodeBlock language="bash" code={curlExample.replace(
                  '"musicVolumeDb": -18\n    }\n  }\'' /* Target this closing part */,
                  '"musicVolumeDb": -18,\n      "responseFormat": "binary"\n    }\n  }\'' /* Replacement */
                )} />
             </div>
             <div>
                <h4 className="font-semibold mb-2">JavaScript Fetch Example (requesting URL response):</h4>
                <CodeBlock language="javascript" code={jsExample} />
             </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default ApiDocs; 