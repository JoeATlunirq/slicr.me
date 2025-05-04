import React from 'react';
import { Link } from 'react-router-dom'; // Assuming React Router is used
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock'; // We'll create this helper next

const ApiDocs: React.FC = () => {

  const curlExample = `# --- Replace YOUR_API_KEY_HERE if making direct API calls --- 
# Example 1: Remove silence, transcribe, export as MP3, add auto-selected music
curl -X POST \\
  https://www.slicr.me/api/process \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -F 'audioFile=@/path/to/your/audio.wav' \\
  -F 'params={"thresholdDb": -40, "minDuration": 0.2, "leftPadding": 0.05, "rightPadding": 0.05, "transcribe": true, "exportFormat": "mp3", "addMusic": true, "autoSelectMusic": true, "musicVolumeDb": -20}'

# Example 2: Remove silence, export as WAV, add manually selected music track
curl -X POST \\
  https://www.slicr.me/api/process \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -F 'audioUrl=https://example.com/audio.mp3' \\
  -F 'params={"thresholdDb": -35, "minDuration": 0.15, "leftPadding": 0.04, "rightPadding": 0.04, "transcribe": false, "exportFormat": "wav", "addMusic": true, "autoSelectMusic": false, "musicTrackId": "your_track_id_here", "musicVolumeDb": -18}'
  
# Example 3: Simple silence removal, WAV output, no music or transcription
curl -X POST \\
  https://www.slicr.me/api/process \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -F 'audioFile=@/path/to/another/audio.m4a' \\
  -F 'params={"thresholdDb": -45, "minDuration": 0.25, "leftPadding": 0.03, "rightPadding": 0.03}'`;

  const jsExample = `// Replace 'YOUR_API_KEY_HERE' only if making direct API calls outside the Slicr UI
const apiKey = 'YOUR_API_KEY_HERE'; 

// --- Example Call Setup ---
const audioFile = /* get your File object or null if using URL */;
const audioUrl = /* "your_audio_url" or null if using File */;

const params = {
    // Silence Removal
    thresholdDb: -40,       // (Number) Silence threshold in dBFS (-60 to 0). Default: -40
    minDuration: 0.2,       // (Number) Min silence duration in seconds. Default: 0.2
    leftPadding: 0.05,      // (Number) Padding before speech in seconds. Default: 0.0332
    rightPadding: 0.05,     // (Number) Padding after speech in seconds. Default: 0.0332

    // Optional Speed Adjustment
    targetDuration: null,   // (Number | null) Target duration in seconds. Speeds up only. Default: null

    // Optional Transcription
    transcribe: true,       // (Boolean) Generate SRT subtitles via Whisper. Default: false

    // Optional Export Format
    exportFormat: "mp3",    // (String) 'wav' or 'mp3'. Default: 'wav'
    
    // Optional Background Music
    addMusic: true,                    // (Boolean) Enable music mixing. Default: false
    autoSelectMusic: true,             // (Boolean) Let AI choose music (requires transcribe=true). Default: false
    musicTrackId: null,                // (String | null) Manually selected track ID (if addMusic=true, autoSelectMusic=false).
    musicVolumeDb: -20                 // (Number) Ducking level in dBFS (-40 to -6). Default: -23
};

// --- Create FormData ---
const formData = new FormData();
if (audioFile) {
    formData.append('audioFile', audioFile);
} else if (audioUrl) {
    formData.append('audioUrl', audioUrl);
} else {
    console.error("Error: Must provide either audioFile or audioUrl");
    // Handle error appropriately
}
formData.append('params', JSON.stringify(params));

// --- Fetch Call ---
fetch('https://www.slicr.me/api/process', {
    method: 'POST',
    headers: {
      // IMPORTANT: Only include X-API-Key for direct API calls outside the Slicr UI.
      // If calling from your own server/script, include the key.
      // If calling from the Slicr UI itself, authentication is handled by origin.
      // ...(apiKey ? { 'X-API-Key': apiKey } : {}) // Conditionally add header
    },
    body: formData
})
.then(response => {
    if (!response.ok) {
        return response.json().then(errData => Promise.reject(errData)).catch(() => { throw new Error(\`HTTP error! status: \${response.status}\`); });
    }
    return response.json();
})
.then(data => {
    console.log('Success:', data);
    // data: { success: true, audioUrl: string, srtUrl?: string }
    if (data.audioUrl) {
        console.log("Processed Audio:", data.audioUrl);
        // Trigger download or use URL
    }
    if (data.srtUrl) {
        console.log("Subtitles:", data.srtUrl);
        // Trigger download or use URL
    }
})
.catch(error => {
    console.error('Error:', error);
    // error: { success: false, error: string }
});`;

  const successResponseExample = `{
  "success": true,
  "audioUrl": "https://your-bucket-name.s3.your-region.amazonaws.com/processed_some_audio_12345.mp3",
  "srtUrl": "https://your-bucket-name.s3.your-region.amazonaws.com/processed_some_audio_12345.srt" 
  // srtUrl is only present if 'transcribe' was true and successful.
}`;

  const errorResponseExample = `{
  "success": false,
  "error": "Descriptive error message (e.g., 'Invalid parameters format', 'FFmpeg processing failed', 'Music track not found', 'Transcription failed - file too large')"
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
            <CardTitle>Endpoint: /api/process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>This endpoint processes an audio file (uploaded or from URL) based on the provided parameters. It performs silence removal, optional speed adjustment (to fit a target duration), optional transcription (generating SRT subtitles), optional background music mixing (with ducking), and export format conversion (WAV or MP3).</p>
            <ul>
              <li><strong>Method:</strong> <code className="bg-muted px-1 rounded">POST</code></li>
              <li><strong>Content-Type:</strong> <code className="bg-muted px-1 rounded">multipart/form-data</code></li>
              <li><strong>URL:</strong> <code className="bg-muted px-1 rounded">https://www.slicr.me/api/process</code> (Production URL)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent>
             <p>
               Requests to the <code className="bg-muted px-1 rounded">/api/process</code> endpoint require authentication, handled differently based on the request source:
             </p>
             <ul className="list-disc list-inside mt-2 space-y-1">
                <li>
                    <strong>Requests from the Official UI</strong> (e.g., <code className="bg-muted px-1 rounded">https://www.slicr.me</code>, <code className="bg-muted px-1 rounded">http://localhost:8080</code>): Authentication is handled automatically based on the request's <code className="bg-muted px-1 rounded">Origin</code> header matching allowed UI domains. No explicit API key header is needed when using the web application directly.
                </li>
                <li>
                    <strong>Direct API Calls</strong> (e.g., from servers, scripts, tools like cURL/Postman): These requests <strong>MUST</strong> include a valid API key in the <code className="bg-muted px-1 rounded">X-API-Key</code> HTTP header. The key is defined by the <code className="bg-muted px-1 rounded">PROCESS_API_KEY</code> environment variable on the server.
                </li>
             </ul>
             <p className="mt-3 text-sm text-muted-foreground">
               Contact the administrator if you require an API key (<code className="bg-muted px-1 rounded">PROCESS_API_KEY</code>) for direct integration. The <code className="bg-muted px-1 rounded">VITE_SLICR_API_KEY</code> visible in the UI source code is only used for requests *from* the UI and is ignored by the server if the Origin matches.
             </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Request Body (Form Data)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>The request must be sent as <code className="bg-muted px-1 rounded">multipart/form-data</code> with the following fields:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong><code className="bg-muted px-1 rounded">audioFile</code></strong> OR <strong><code className="bg-muted px-1 rounded">audioUrl</code></strong> (Required - Provide ONE)
                <ul className="list-circle list-inside ml-4 text-sm text-muted-foreground">
                  <li><code className="font-mono">audioFile</code>: The audio file blob (e.g., WAV, MP3, M4A).</li>
                  <li><code className="font-mono">audioUrl</code>: A publicly accessible URL string pointing to the audio file.</li>
                </ul>
              </li>
              <li>
                <strong><code className="bg-muted px-1 rounded">params</code></strong> (Required)
                <ul className="list-circle list-inside ml-4 text-sm text-muted-foreground">
                  <li>A JSON string containing the processing parameters. See details below.</li>
                </ul>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Parameters Object (JSON String)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p>The <code className="bg-muted px-1 rounded">params</code> form field must contain a valid JSON string representing an object with the following keys (defaults applied if omitted):</p>
             <div className="overflow-x-auto">
                 <table className="w-full min-w-[600px] text-sm border-collapse border border-border">
                   <thead>
                     <tr className="bg-muted">
                       <th className="border border-border p-2 text-left">Parameter</th>
                       <th className="border border-border p-2 text-left">Type</th>
                       <th className="border border-border p-2 text-left">Description</th>
                       <th className="border border-border p-2 text-left">Default</th>
                       <th className="border border-border p-2 text-left">Example</th>
                     </tr>
                   </thead>
                   <tbody>
                     {/* Silence Removal */}
                     <tr><td colSpan={5} className="border border-border p-2 bg-muted-foreground/10 font-semibold">Silence Removal</td></tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">thresholdDb</code></td>
                       <td className="border border-border p-2">Number</td>
                       <td className="border border-border p-2">Silence threshold in dBFS. Audio below this level is considered silent. Range: -60 to 0.</td>
                       <td className="border border-border p-2"><code className="font-mono">-40</code></td>
                       <td className="border border-border p-2"><code className="font-mono">-35</code></td>
                     </tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">minDuration</code></td>
                       <td className="border border-border p-2">Number</td>
                       <td className="border border-border p-2">Minimum duration (in seconds) for a segment to be considered silent.</td>
                       <td className="border border-border p-2"><code className="font-mono">0.2</code></td>
                       <td className="border border-border p-2"><code className="font-mono">0.15</code></td>
                     </tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">leftPadding</code></td>
                       <td className="border border-border p-2">Number</td>
                       <td className="border border-border p-2">Padding (in seconds) added *before* kept audio sections (start of speech).</td>
                       <td className="border border-border p-2"><code className="font-mono">0.0332</code></td>
                       <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                     </tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">rightPadding</code></td>
                       <td className="border border-border p-2">Number</td>
                       <td className="border border-border p-2">Padding (in seconds) added *after* kept audio sections (end of speech).</td>
                       <td className="border border-border p-2"><code className="font-mono">0.0332</code></td>
                       <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                     </tr>
                     {/* Speed Adjustment */}
                     <tr><td colSpan={5} className="border border-border p-2 bg-muted-foreground/10 font-semibold">Speed Adjustment</td></tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">targetDuration</code></td>
                       <td className="border border-border p-2">Number | null</td>
                       <td className="border border-border p-2">Optional target duration in seconds. If provided and shorter than the processed duration, audio is sped up (pitch preserved).</td>
                       <td className="border border-border p-2"><code className="font-mono">null</code></td>
                       <td className="border border-border p-2"><code className="font-mono">60.0</code></td>
                     </tr>
                     {/* Transcription */}
                     <tr><td colSpan={5} className="border border-border p-2 bg-muted-foreground/10 font-semibold">Transcription</td></tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">transcribe</code></td>
                       <td className="border border-border p-2">Boolean</td>
                       <td className="border border-border p-2">If true, generates word-level SRT subtitles via Whisper. (Requires input audio &lt; 25MB after initial processing).</td>
                       <td className="border border-border p-2"><code className="font-mono">false</code></td>
                       <td className="border border-border p-2"><code className="font-mono">true</code></td>
                     </tr>
                     {/* Export Format */}
                     <tr><td colSpan={5} className="border border-border p-2 bg-muted-foreground/10 font-semibold">Export Format</td></tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">exportFormat</code></td>
                       <td className="border border-border p-2">String</td>
                       <td className="border border-border p-2">Output audio format. Options: 'wav' (lossless) or 'mp3' (compressed).</td>
                       <td className="border border-border p-2"><code className="font-mono">wav</code></td>
                       <td className="border border-border p-2"><code className="font-mono">mp3</code></td>
                     </tr>
                      {/* Background Music */}
                     <tr><td colSpan={5} className="border border-border p-2 bg-muted-foreground/10 font-semibold">Background Music</td></tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">addMusic</code></td>
                       <td className="border border-border p-2">Boolean</td>
                       <td className="border border-border p-2">If true, enables background music mixing.</td>
                       <td className="border border-border p-2"><code className="font-mono">false</code></td>
                       <td className="border border-border p-2"><code className="font-mono">true</code></td>
                     </tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">autoSelectMusic</code></td>
                       <td className="border border-border p-2">Boolean</td>
                       <td className="border border-border p-2">If true (and <code className="font-mono">addMusic</code> is true), uses an LLM (requires <code className="font-mono">transcribe=true</code>) to select music based on transcript content. Falls back to random if LLM fails or transcription is off.</td>
                       <td className="border border-border p-2"><code className="font-mono">false</code></td>
                       <td className="border border-border p-2"><code className="font-mono">true</code></td>
                     </tr>
                      <tr>
                       <td className="border border-border p-2"><code className="font-mono">musicTrackId</code></td>
                       <td className="border border-border p-2">String | null</td>
                       <td className="border border-border p-2">If <code className="font-mono">addMusic</code> is true and <code className="font-mono">autoSelectMusic</code> is false, provide the ID of the desired music track from the NocoDB database.</td>
                       <td className="border border-border p-2"><code className="font-mono">null</code></td>
                       <td className="border border-border p-2"><code className="font-mono">your_track_id</code></td>
                     </tr>
                     <tr>
                       <td className="border border-border p-2"><code className="font-mono">musicVolumeDb</code></td>
                       <td className="border border-border p-2">Number</td>
                       <td className="border border-border p-2">Target music volume relative to voice (ducking level) in dBFS. Applied if <code className="font-mono">addMusic</code> is true. Range: -40 to -6.</td>
                       <td className="border border-border p-2"><code className="font-mono">-23</code></td>
                       <td className="border border-border p-2"><code className="font-mono">-18</code></td>
                     </tr>
                   </tbody>
                 </table>
             </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Example Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div>
                <h4 className="font-semibold mb-2">cURL Examples:</h4>
                <CodeBlock language="bash" code={curlExample} />
             </div>
             <div>
                <h4 className="font-semibold mb-2">JavaScript Fetch Example:</h4>
                <CodeBlock language="javascript" code={jsExample} />
             </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Response Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p>The API will respond with a JSON object.</p>
             <div>
                <h4 className="font-semibold mb-2">Success (Status Code 200):</h4>
                 <p className="text-sm mb-2">Indicates successful processing. The <code className="bg-muted px-1 rounded">audioUrl</code> field contains a publicly accessible URL to the processed audio file (WAV or MP3, potentially mixed with music) stored in AWS S3. If transcription was requested (<code className="bg-muted px-1 rounded">transcribe: true</code>) and successful, the <code className="bg-muted px-1 rounded">srtUrl</code> field will also be present, containing a URL to the SRT subtitle file.</p>
                <CodeBlock language="json" code={successResponseExample} />
             </div>
             <div>
                <h4 className="font-semibold mb-2">Error (Status Code 4xx or 5xx):</h4>
                 <p className="text-sm mb-2">Indicates an error occurred during processing or request handling. The <code className="bg-muted px-1 rounded">error</code> field provides details about the failure.</p>
                <CodeBlock language="json" code={errorResponseExample} />
             </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default ApiDocs; 