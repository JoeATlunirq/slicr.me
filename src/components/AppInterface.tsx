
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Scissors, Download, Settings, ArrowLeft, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface AppInterfaceProps {
  onBack: () => void;
}

const AppInterface = ({ onBack }: AppInterfaceProps) => {
  const [activeTab, setActiveTab] = useState("silence");
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);
  const [threshold, setThreshold] = useState([0.019]);
  const [minDuration, setMinDuration] = useState([0]);
  const [leftPadding, setLeftPadding] = useState([0.0332]);
  const [rightPadding, setRightPadding] = useState([0.0332]);
  const [audioSpikes, setAudioSpikes] = useState([0]);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasFile, setHasFile] = useState(false);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files);
    }
  };

  const handleFile = (files: FileList) => {
    // In a real app, we'd upload and process the file here
    setIsProcessing(true);
    toast({
      title: "File received",
      description: `Processing ${files[0].name}...`,
    });
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      setHasFile(true);
      toast({
        title: "Processing complete!",
        description: "Your file is ready for editing.",
      });
    }, 2000);
  };

  const handleExport = () => {
    toast({
      title: "Exporting!",
      description: "Your file is being exported...",
    });
    
    // Simulate export
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: "Your file has been successfully exported.",
      });
    }, 2000);
  };

  const handleRemoveSilence = () => {
    toast({
      title: "Processing",
      description: "Removing silence from your video...",
    });
    
    // Simulate processing
    setTimeout(() => {
      toast({
        title: "Success!",
        description: "Silence has been removed from your video.",
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* App Header */}
      <header className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onBack} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">SilenceCut</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" disabled={!hasFile}>
              Save Project
            </Button>
            <Button disabled={!hasFile} onClick={handleExport}>
              Export
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        {/* Left: Video Preview */}
        <div className="md:w-2/3 flex flex-col gap-4">
          {/* Video Drop Area */}
          {!hasFile ? (
            <div 
              className={`bg-white rounded-lg border-2 ${
                dragActive ? "border-primary border-dashed" : "border-gray-200"
              } flex-1 flex flex-col items-center justify-center p-12`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-xl font-medium text-gray-700">Processing your file...</p>
                </div>
              ) : (
                <>
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Upload className="h-10 w-10 text-gray-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">Drop a File to Edit</h2>
                  <p className="text-gray-600 mb-8">audio or video</p>

                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-6">
                    <ArrowLeft className="h-8 w-8 text-gray-400 transform rotate-90" />
                  </div>

                  <p className="text-gray-600">Or click to Browse.</p>
                  
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload">
                    <Button variant="outline" className="mt-4">
                      Browse Files
                    </Button>
                  </label>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 flex-1 flex flex-col">
              <div className="bg-gray-800 h-80 flex items-center justify-center rounded-t-lg">
                <p className="text-white">Video Preview</p>
              </div>
              <div className="p-4 border-t border-gray-200">
                <div className="bg-gray-100 h-24 rounded-md flex items-center justify-center">
                  <p className="text-gray-500">Waveform Visualization</p>
                </div>
                <div className="flex justify-between mt-4">
                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Play
                  </Button>
                  <div className="text-sm text-gray-500">
                    00:00:00 / 00:02:30
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Tabs under the video */}
          {hasFile && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <Tabs defaultValue="audio-video" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="audio-video">Audio/Video</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="sections">Sections</TabsTrigger>
                  </TabsList>
                  <div className="p-4">
                    <div className="flex flex-col gap-4">
                      <div>
                        <label htmlFor="export-type" className="block text-sm font-medium text-gray-700 mb-1">
                          Type
                        </label>
                        <Select onValueChange={setSelectedFileType} defaultValue="audio-wav">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select file type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="video-mp4">Video (mp4)</SelectItem>
                            <SelectItem value="video-mp4-software">Video (mp4, software)</SelectItem>
                            <SelectItem value="audio-wav">Audio (wav)</SelectItem>
                            <SelectItem value="audio-m4a">Audio (m4a)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-gray-600">32-bit PCM WAV</p>
                      <Button onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export...
                      </Button>
                    </div>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Settings Panel */}
        <div className="md:w-1/3">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="silence" className="relative">
                    <Scissors className="h-5 w-5 mr-2" />
                    Silence
                  </TabsTrigger>
                  <TabsTrigger value="sections">Sections</TabsTrigger>
                  <TabsTrigger value="export">
                    <Download className="h-5 w-5 mr-2" />
                    Export
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="silence" className="p-4">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <Button onClick={handleRemoveSilence} disabled={!hasFile}>
                        Remove Silence
                      </Button>
                      <Button variant="ghost" size="icon" disabled={!hasFile}>
                        <Settings className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-sm text-gray-500 mb-4">
                        ← to Simple Mode
                      </p>

                      <div className="space-y-6">
                        {/* Threshold slider */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Threshold</label>
                            <span className="text-sm font-medium">Auto</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Below this is considered silent.</p>
                          <div className="flex items-center">
                            <Slider 
                              value={threshold} 
                              onValueChange={setThreshold}
                              max={0.1}
                              step={0.001}
                              disabled={!hasFile}
                            />
                            <span className="ml-2 text-sm font-mono w-12">{threshold[0].toFixed(3)}</span>
                          </div>
                        </div>

                        {/* Minimum Duration slider */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Minimum Duration</label>
                            <span className="text-sm font-mono">{minDuration[0]} s</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Silence longer than this will be cut.</p>
                          <Slider 
                            value={minDuration} 
                            onValueChange={setMinDuration}
                            max={2}
                            step={0.01}
                            disabled={!hasFile}
                          />
                        </div>

                        {/* Padding sliders */}
                        <div>
                          <label className="text-sm font-medium block mb-2">Padding</label>
                          <p className="text-xs text-gray-500 mb-2">Leave space between cuts.</p>
                          
                          <div className="flex justify-between items-center gap-4 mb-2">
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs">Left</span>
                                <span className="text-xs font-mono">{leftPadding[0].toFixed(4)} s</span>
                              </div>
                              <Slider 
                                value={leftPadding} 
                                onValueChange={setLeftPadding}
                                max={0.2}
                                step={0.0001}
                                disabled={!hasFile}
                              />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs">Right</span>
                                <span className="text-xs font-mono">{rightPadding[0].toFixed(4)} s</span>
                              </div>
                              <Slider 
                                value={rightPadding} 
                                onValueChange={setRightPadding}
                                max={0.2}
                                step={0.0001}
                                disabled={!hasFile}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs"
                              disabled={!hasFile}
                            >
                              <span className="lock-icon">🔒</span>
                              Link
                            </Button>
                          </div>
                        </div>

                        {/* Remove Short Audio Spikes */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Remove Short Audio Spikes</label>
                            <span className="text-sm font-mono">{audioSpikes[0]} s</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Audible clips shorter than this will be cut.</p>
                          <Slider 
                            value={audioSpikes} 
                            onValueChange={setAudioSpikes}
                            max={1}
                            step={0.01}
                            disabled={!hasFile}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sections">
                  <div className="p-4">
                    <p className="text-gray-500">Section management tools will appear here.</p>
                  </div>
                </TabsContent>

                <TabsContent value="export">
                  <div className="p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Export Format</label>
                        <Select defaultValue="audio-wav">
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="video-mp4">Video (MP4)</SelectItem>
                            <SelectItem value="audio-wav">Audio (WAV)</SelectItem>
                            <SelectItem value="audio-m4a">Audio (M4A)</SelectItem>
                            <SelectItem value="premiere">Adobe Premiere XML</SelectItem>
                            <SelectItem value="resolve">DaVinci Resolve XML</SelectItem>
                            <SelectItem value="fcpx">Final Cut Pro XML</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Include Silence Markers</span>
                        <Switch disabled={!hasFile} />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Export With Cuts Applied</span>
                        <Switch defaultChecked disabled={!hasFile} />
                      </div>
                      
                      <Button 
                        className="w-full" 
                        onClick={handleExport}
                        disabled={!hasFile}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Now
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// Add a Play icon component since it's not imported from lucide-react
const Play = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

export default AppInterface;
