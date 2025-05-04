import React from 'react';
import { Link } from 'react-router-dom'; // Assuming React Router is used
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock'; // We'll create this helper next

const ApiDocs: React.FC = () => {

  const curlExample = `# --- Replace YOUR_API_KEY_HERE with the key from your .env (VITE_SLICR_API_KEY) --- 
curl -X POST \\
  https://www.slicr.me/api/process \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -F 'audioFile=@/path/to/your/audio.wav' \\
  -F 'params={"thresholdDb": -40, "minDuration": 0.2, "leftPadding": 0.05, "rightPadding": 0.05, "targetDuration": 60.0, "transcribe": true, "exportFormat": "mp3", "addMusic": true, "musicTrackId": "YOUR_TRACK_ID", "musicVolumeLevel": 0.15}'

# OR using URL and Auto-Select Music:
curl -X POST \\
  https://www.slicr.me/api/process \\
  -H 'X-API-Key: YOUR_API_KEY_HERE' \\
  -F 'audioUrl=https://example.com/audio.mp3' \\
  -F 'params={"thresholdDb": -40, "minDuration": 0.2, "leftPadding": 0.05, "rightPadding": 0.05, "targetDuration": null, "transcribe": true, "exportFormat": "wav", "addMusic": true, "autoSelectMusic": true, "musicVolumeLevel": 0.1}'`;

  const jsExample = `// Replace 'YOUR_API_KEY_HERE' with the key from your .env (VITE_SLICR_API_KEY)
const apiKey = 'YOUR_API_KEY_HERE'; 

// Option 1: Using File object with Manual Music Selection
const audioFile = /* get your File object */;
const paramsFile = {
    thresholdDb: -40,       
    minDuration: 0.2,       
    leftPadding: 0.05,      
    rightPadding: 0.05,    
    targetDuration: 60.0,   // Optional: Target duration > 0. Speeds up only.
    transcribe: true,       // Optional: Set to true to generate SRT subtitles.
    exportFormat: "mp3",    // Optional: 'wav' or 'mp3'. Default is 'wav'.
    addMusic: true,         // Optional: Enable background music. (Default: false)
    musicTrackId: "YOUR_TRACK_ID", // Optional: NocoDB ID of the music track. Required if addMusic=true and autoSelectMusic=false.
    // autoSelectMusic: false, // Default if not provided when addMusic=true
    musicVolumeLevel: 0.15  // Optional: Music volume multiplier (0.0 to 1.0). Default: 0.1
};
const formDataFile = new FormData();
formDataFile.append('audioFile', audioFile);
formDataFile.append('params', JSON.stringify(paramsFile));

// Option 2: Using URL with Auto Music Selection
const audioUrl = "https://example.com/audio.mp3";
const paramsUrl = {
    thresholdDb: -40,       
    minDuration: 0.2,       
    leftPadding: 0.05,      
    rightPadding: 0.05,    
    targetDuration: null,   // Omit or null for no speed change.
    transcribe: true,       // Need transcription for auto-select context.
    exportFormat: "wav",    // Default
    addMusic: true,         // Enable background music.
    autoSelectMusic: true,  // Optional: Use AI to select music based on transcript. (Default: false)
    // musicTrackId: null,  // Omit if autoSelectMusic=true
    musicVolumeLevel: 0.1   // Optional: Music volume multiplier (0.0 to 1.0). Default: 0.1
};
const formDataUrl = new FormData();
formDataUrl.append('audioUrl', audioUrl);
formDataUrl.append('params', JSON.stringify(paramsUrl));

// Choose formDataFile or formDataUrl
const formData = formDataFile; // Or formDataUrl

fetch('https://www.slicr.me/api/process', {
    method: 'POST',
    headers: {
      // Add the required API Key header
      'X-API-Key': apiKey
    },
    body: formData
})
.then(response => {
    if (!response.ok) {
        // Handle non-JSON error responses if necessary
        return response.json().then(errData => Promise.reject(errData)).catch(() => { throw new Error(\`HTTP error! status: \${response.status}\`); });
    }
    return response.json();
})
.then(data => {
    console.log('Success:', data);
    // data format: { success: true, audioUrl: string, srtUrl?: string }
    // Use the URLs (e.g., trigger downloads)
})
.catch(error => {
    console.error('Error:', error);
    // error format: { success: false, error: string }
});`;

  const successResponseExample = `{
  "success": true,
  "audioUrl": "https://your-bucket-name.s3.your-region.amazonaws.com/processed_audio_1234567890.mp3",
  "srtUrl": "https://your-bucket-name.s3.your-region.amazonaws.com/processed_audio_1234567890.srt" // Only present if requested and successful
}`;

  const errorResponseExample = `{
  "success": false,
  "error": "Error message describing the issue (e.g., 'No audio file uploaded', 'FFmpeg processing failed', 'Transcription failed')"
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
            <p>This endpoint processes an uploaded audio file or URL based on the provided parameters, performing silence removal, optional speed adjustment, optional transcription, and export format conversion.</p>
            <ul>
              <li><strong>Method:</strong> <code className="bg-muted px-1 rounded">POST</code></li>
              <li><strong>Content-Type:</strong> <code className="bg-muted px-1 rounded">multipart/form-data</code></li>
              <li><strong>URL:</strong> <code className="bg-muted px-1 rounded">https://www.slicr.me/api/process</code> (Replace with your actual domain if different)</li>
              <li><strong>Authentication:</strong> Requires an API key sent in the <code className="bg-muted px-1 rounded">X-API-Key</code> header.</li>
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
                    <strong>Requests from the official UI</strong> (e.g., <code className="bg-muted px-1 rounded">https://www.slicr.me</code>): Authentication is handled automatically based on the request origin. No explicit API key is needed when using the web application directly.
                </li>
                <li>
                    <strong>Direct API Calls</strong> (e.g., from servers, scripts, tools like cURL/Postman): These requests MUST include a valid API key in the <code className="bg-muted px-1 rounded">X-API-Key</code> HTTP header.
                </li>
             </ul>
             <p className="mt-3 text-sm text-muted-foreground">
               Please contact the administrator if you require an API key for direct integration.
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
                  <li><code className="font-mono">audioFile</code>: The audio file blob to be processed.</li>
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
             <p>The <code className="bg-muted px-1 rounded">params</code> form field must contain a valid JSON string representing an object with the following keys:</p>
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
                   <td className="border border-border p-2">Duration (in seconds) of silence to keep *before* the start of a detected silent section (effectively shortening the cut from the beginning).</td>
                   <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">rightPadding</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Duration (in seconds) of silence to keep *after* the end of a detected silent section (effectively shortening the cut from the end).</td>
                   <td className="border border-border p-2"><code className="font-mono">0.05</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">targetDuration</code></td>
                   <td className="border border-border p-2">Number | null</td>
                   <td className="border border-border p-2">Target final duration in seconds. If provided and shorter than the original duration, the audio will be sped up. Otherwise, speed is not changed.</td>
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
                   <td className="border border-border p-2">Desired output format for the audio file. Options: 'wav' (default) or 'mp3'.</td>
                   <td className="border border-border p-2"><code className="font-mono">"mp3"</code></td>
                 </tr>
                 {/* --- Music Parameters --- */}
                 <tr>
                   <td className="border border-border p-2 font-semibold bg-muted/50" colSpan={4}>Music Parameters (Optional)</td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">addMusic</code></td>
                   <td className="border border-border p-2">Boolean</td>
                   <td className="border border-border p-2">Set to true to enable adding background music. (Default: false)</td>
                   <td className="border border-border p-2"><code className="font-mono">true</code></td>
                 </tr>
                  <tr>
                   <td className="border border-border p-2"><code className="font-mono">autoSelectMusic</code></td>
                   <td className="border border-border p-2">Boolean</td>
                   <td className="border border-border p-2">If true and <code className='font-mono'>addMusic</code> is true, attempts to use AI (requires transcription) to select a suitable track from the NocoDB library. Overrides <code className='font-mono'>musicTrackId</code> if both are present. (Default: false)</td>
                   <td className="border border-border p-2"><code className="font-mono">true</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">musicTrackId</code></td>
                   <td className="border border-border p-2">String | null</td>
                   <td className="border border-border p-2">The unique ID (from NocoDB) of the music track to use. Required if <code className='font-mono'>addMusic</code> is true and <code className='font-mono'>autoSelectMusic</code> is false.</td>
                   <td className="border border-border p-2"><code className="font-mono">"YOUR_TRACK_ID"</code></td>
                 </tr>
                 <tr>
                   <td className="border border-border p-2"><code className="font-mono">musicVolumeLevel</code></td>
                   <td className="border border-border p-2">Number</td>
                   <td className="border border-border p-2">Volume multiplier for the background music track. Range: 0.0 (silent) to 1.0 (original volume). (Default: 0.1)</td>
                   <td className="border border-border p-2"><code className="font-mono">0.15</code></td>
                 </tr>
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
                <h4 className="font-semibold mb-2">cURL Example:</h4>
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
                 <p className="text-sm mb-2">Indicates successful processing. The <code className="bg-muted px-1 rounded">audioUrl</code> field contains a publicly accessible URL to the processed audio file (WAV or MP3) stored in AWS S3. If transcription was requested and successful, the <code className="bg-muted px-1 rounded">srtUrl</code> field will also be present.</p>
                <CodeBlock language="json" code={successResponseExample} />
             </div>
             <div>
                <h4 className="font-semibold mb-2">Error (Status Code 4xx or 5xx):</h4>
                 <p className="text-sm mb-2">Indicates an error occurred during processing or request handling. The <code className="bg-muted px-1 rounded">error</code> field provides details.</p>
                <CodeBlock language="json" code={errorResponseExample} />
             </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default ApiDocs; 