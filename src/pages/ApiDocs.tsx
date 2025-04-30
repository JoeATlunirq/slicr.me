import React from 'react';
import { Link } from 'react-router-dom'; // Assuming React Router is used
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock'; // We'll create this helper next

const ApiDocs: React.FC = () => {

  const curlExample = `curl -X POST \\
  https://www.slicr.me/api/process \\
  -F 'audioFile=@/path/to/your/audio.wav' \\
  -F 'params={"thresholdDb": -40, "minDuration": 0.2, "leftPadding": 0.05, "rightPadding": 0.05, "appliedPlaybackRate": 1.5}'`;

  const jsExample = `const audioFile = /* get your File object */;
const params = {
    thresholdDb: -40,       // Silence threshold in dBFS (-60 to 0)
    minDuration: 0.2,       // Minimum duration of silence in seconds
    leftPadding: 0.05,      // Padding before cut in seconds
    rightPadding: 0.05,     // Padding after cut in seconds
    appliedPlaybackRate: 1.5, // Optional: Target speed (0.5 to 100.0), null/1 for no change
    // exportAsSections: false // Currently not implemented server-side
};

const formData = new FormData();
formData.append('audioFile', audioFile);
formData.append('params', JSON.stringify(params));

fetch('https://www.slicr.me/api/process', {
    method: 'POST',
    body: formData
})
.then(response => {
    if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
})
.then(data => {
    console.log('Success:', data);
    // data format: { success: true, files: [{ filename: string, data: string (base64) }] }
    // Decode base64 data and handle the file
})
.catch(error => {
    console.error('Error:', error);
    // Handle error response: { success: false, error: string }
});`;

  const successResponseExample = `{
  "success": true,
  "files": [
    {
      "filename": "processed_audio_1746023831506.wav",
      "data": "UklGRiQ...AoADAZG9s=" // Base64 encoded WAV data (truncated)
    }
  ]
  // Note: Currently only returns a single file even if exportAsSections was requested
}`;

  const errorResponseExample = `{
  "success": false,
  "error": "Error message describing the issue (e.g., 'No audio file uploaded', 'FFmpeg processing failed')"
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
            <p>This endpoint processes an uploaded audio file based on the provided parameters, performing silence removal and optional speed adjustment.</p>
            <ul>
              <li><strong>Method:</strong> <code className="bg-muted px-1 rounded">POST</code></li>
              <li><strong>Content-Type:</strong> <code className="bg-muted px-1 rounded">multipart/form-data</code></li>
              <li><strong>URL:</strong> <code className="bg-muted px-1 rounded">https://www.slicr.me/api/process</code> (Replace with your actual domain if different)</li>
            </ul>
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
                <strong><code className="bg-muted px-1 rounded">audioFile</code></strong> (Required)
                <ul className="list-circle list-inside ml-4 text-sm text-muted-foreground">
                  <li>The audio file to be processed (e.g., WAV, MP3, FLAC). FFmpeg compatibility applies.</li>
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
                   <td className="border border-border p-2"><code className="font-mono">appliedPlaybackRate</code></td>
                   <td className="border border-border p-2">Number | null</td>
                   <td className="border border-border p-2">Target playback speed multiplier. Uses FFmpeg's <code className="font-mono">atempo</code> filter (preserves pitch). Range: 0.5 to 100.0. Use <code className="font-mono">1</code> or <code className="font-mono">null</code> for original speed.</td>
                   <td className="border border-border p-2"><code className="font-mono">1.5</code> or <code className="font-mono">null</code></td>
                 </tr>
                  {/* <tr>
                    <td className="border border-border p-2"><code className="font-mono">exportAsSections</code></td>
                    <td className="border border-border p-2">Boolean</td>
                    <td className="border border-border p-2">If true, attempts to export each audible segment as a separate file. (Currently not implemented server-side, returns single file).</td>
                   <td className="border border-border p-2"><code className="font-mono">false</code></td>
                  </tr> */}
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
                 <p className="text-sm mb-2">Indicates successful processing. The <code className="bg-muted px-1 rounded">files</code> array contains the processed file(s).</p>
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