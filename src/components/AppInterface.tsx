
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Scissors, 
  Download, 
  Settings, 
  ArrowLeft, 
  Upload, 
  Clock, 
  Layers, 
  Save,
  History,
  FileText,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Timeline from "@/components/Timeline";
import SectionsPanel from "@/components/SectionsPanel";
import { useNavigate } from "react-router-dom";

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
  const [timelineData, setTimelineData] = useState<{segments: {start: number, end: number, type: string}[]}>({
    segments: []
  });
  const [sectionSplitDuration, setSectionSplitDuration] = useState([5]);
  const [activeViewTab, setActiveViewTab] = useState("audio-video");

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
      
      // Generate some mock timeline data
      const mockSegments = [];
      let currentTime = 0;
      
      for (let i = 0; i < 20; i++) {
        const segmentLength = Math.random() * 10 + 2;
        const segmentType = Math.random() > 0.3 ? "audio" : "silence";
        
        mockSegments.push({
          start: currentTime,
          end: currentTime + segmentLength,
          type: segmentType
        });
        
        currentTime += segmentLength;
      }
      
      setTimelineData({ segments: mockSegments });
      
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

  const handleCreateSections = () => {
    toast({
      title: "Creating Sections",
      description: `Splitting timeline into sections based on ${sectionSplitDuration[0]}s silence threshold...`,
    });
    
    // In a real app, this would update the timeline with section markers
    setTimeout(() => {
      toast({
        title: "Sections Created!",
        description: "Your timeline has been divided into sections.",
      });
    }, 1500);
  };

  const handleSaveScript = () => {
    toast({
      title: "Script Saved",
      description: "Your editing settings have been saved for future use.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-purple-50 to-blue-50 flex flex-col">
      {/* App Header */}
      <header className="bg-white border-b border-violet-200 py-4 shadow-md">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={onBack} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              SilenceCut
            </h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-1">
            <Button
              variant="ghost"
              className="flex flex-col items-center px-3 py-2 hover:bg-purple-50"
              onClick={() => toast({ title: "Saved Scripts", description: "Feature coming soon!" })}
            >
              <Save className="h-5 w-5 mb-1 text-purple-600" />
              <span className="text-xs text-gray-600">Scripts</span>
            </Button>
            
            <Button
              variant="ghost"
              className="flex flex-col items-center px-3 py-2 hover:bg-purple-50"
              onClick={() => toast({ title: "History", description: "Feature coming soon!" })}
            >
              <History className="h-5 w-5 mb-1 text-pink-600" />
              <span className="text-xs text-gray-600">History</span>
            </Button>
            
            <Button
              variant="ghost"
              className="flex flex-col items-center px-3 py-2 hover:bg-purple-50"
              onClick={() => toast({ title: "Templates", description: "Feature coming soon!" })}
            >
              <FileText className="h-5 w-5 mb-1 text-blue-600" />
              <span className="text-xs text-gray-600">Templates</span>
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline"
              disabled={!hasFile}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={handleSaveScript}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Script
            </Button>
            
            <Button 
              className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-600 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-700 shadow-sm" 
              disabled={!hasFile} 
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" />
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
              className={`bg-gradient-to-br from-white to-purple-50 rounded-xl border-2 ${
                dragActive ? "border-fuchsia-500 border-dashed" : "border-gray-200"
              } flex-1 flex flex-col items-center justify-center p-12 shadow-lg`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-xl font-medium text-gray-700">Processing your file...</p>
                </div>
              ) : (
                <>
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-200 to-fuchsia-200 rounded-full flex items-center justify-center mb-6 shadow-md">
                    <Upload className="h-10 w-10 text-fuchsia-500" />
                  </div>
                  <h2 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">Drop a File to Edit</h2>
                  <p className="text-xl text-blue-600 mb-8">audio or video</p>

                  <p className="text-gray-600">Drag and drop or click to browse your files</p>
                  
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload">
                    <Button 
                      variant="outline" 
                      className="mt-6 border-fuchsia-300 text-fuchsia-700 hover:bg-fuchsia-50 px-8 py-6 text-lg"
                    >
                      Browse Files
                    </Button>
                  </label>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-purple-200 flex-1 flex flex-col shadow-lg overflow-hidden">
              <div className="bg-gray-800 h-80 flex items-center justify-center rounded-t-lg">
                <p className="text-white">Video Preview</p>
              </div>
              <div className="p-4 border-t border-gray-300">
                {/* Timeline Component */}
                <Timeline timelineData={timelineData} />
                
                <div className="flex justify-between mt-4">
                  <Button variant="outline" size="sm" className="bg-white">
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
            <Card className="border-0 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <Tabs value={activeViewTab} onValueChange={setActiveViewTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-3 bg-gradient-to-r from-purple-100 to-pink-100 p-1">
                    <TabsTrigger 
                      value="audio-video" 
                      className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
                    >
                      Audio/Video
                    </TabsTrigger>
                    <TabsTrigger 
                      value="timeline" 
                      className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
                    >
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger 
                      value="sections" 
                      className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
                    >
                      Sections
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="audio-video" className="p-4 border-t border-purple-100">
                    <div className="flex flex-col gap-4">
                      <div>
                        <label htmlFor="export-type" className="block text-sm font-medium text-gray-700 mb-1">
                          Export Format
                        </label>
                        <Select onValueChange={setSelectedFileType} defaultValue="audio-wav">
                          <SelectTrigger className="w-full border-purple-200 focus:ring-purple-500">
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
                      <p className="text-sm text-purple-600">32-bit PCM WAV</p>
                      <Button 
                        onClick={handleExport} 
                        className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-600 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-700"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export...
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="timeline" className="p-4 border-t border-purple-100">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-purple-800">Timeline Controls</h3>
                        <div className="flex space-x-1">
                          <Button variant="outline" size="sm" className="text-xs">Split</Button>
                          <Button variant="outline" size="sm" className="text-xs">Merge</Button>
                          <Button variant="outline" size="sm" className="text-xs">Delete</Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        Click and drag on timeline segments to adjust cut points manually.
                        Use the controls above to fine-tune your edits.
                      </p>
                      <div className="p-2 bg-purple-50 rounded text-sm text-purple-700 border border-purple-200 flex items-center">
                        <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
                        Tip: Double-click a segment to toggle between silence and audio
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="sections" className="p-4 border-t border-purple-100">
                    <div className="flex flex-col gap-4">
                      <h3 className="font-medium text-purple-800">Section Markers</h3>
                      <p className="text-sm text-gray-600">
                        Create chapter markers or split your project into multiple files based on detected sections.
                      </p>
                      <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-2">
                        <div className="flex justify-between text-sm font-medium mb-1">
                          <span>Section 1</span>
                          <span>00:00 - 02:45</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium mb-1">
                          <span>Section 2</span>
                          <span>02:45 - 08:12</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span>Section 3</span>
                          <span>08:12 - 12:30</span>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full">
                        Export Sections as Separate Files
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Settings Panel */}
        <div className="md:w-1/3">
          <Card className="shadow-lg border-violet-200 overflow-hidden bg-white">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-3 bg-gradient-to-r from-purple-100 to-pink-100 p-1">
                  <TabsTrigger
                    value="silence" 
                    className="relative data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
                  >
                    <Scissors className="h-5 w-5 mr-2" />
                    Silence
                  </TabsTrigger>
                  <TabsTrigger 
                    value="sections" 
                    className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
                  >
                    <Layers className="h-5 w-5 mr-2" />
                    Sections
                  </TabsTrigger>
                  <TabsTrigger 
                    value="export" 
                    className="data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Export
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="silence" className="p-4">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <Button 
                        onClick={handleRemoveSilence} 
                        disabled={!hasFile}
                        className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-600 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-700 shadow-md"
                      >
                        <Scissors className="mr-2 h-5 w-5" />
                        Remove Silence
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        disabled={!hasFile}
                        className="border-purple-200 text-purple-700"
                      >
                        <Settings className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="border-t border-purple-100 pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-purple-800">Advanced Settings</h3>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-purple-600"
                          onClick={handleSaveScript}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save Script
                        </Button>
                      </div>

                      <div className="space-y-6">
                        {/* Threshold slider */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-purple-800">Threshold</label>
                            <span className="text-sm font-medium text-fuchsia-600">Auto</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Below this is considered silent.</p>
                          <div className="flex items-center">
                            <Slider 
                              value={threshold} 
                              onValueChange={setThreshold}
                              max={0.1}
                              step={0.001}
                              disabled={!hasFile}
                              className="[&>*:nth-child(2)]:bg-gradient-to-r [&>*:nth-child(2)]:from-purple-500 [&>*:nth-child(2)]:to-pink-500"
                            />
                            <span className="ml-2 text-sm font-mono w-12">{threshold[0].toFixed(3)}</span>
                          </div>
                        </div>

                        {/* Minimum Duration slider */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-purple-800">Minimum Duration</label>
                            <span className="text-sm font-mono">{minDuration[0]} s</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Silence longer than this will be cut.</p>
                          <Slider 
                            value={minDuration} 
                            onValueChange={setMinDuration}
                            max={2}
                            step={0.01}
                            disabled={!hasFile}
                            className="[&>*:nth-child(2)]:bg-gradient-to-r [&>*:nth-child(2)]:from-purple-500 [&>*:nth-child(2)]:to-pink-500"
                          />
                        </div>

                        {/* Padding sliders */}
                        <div>
                          <label className="text-sm font-medium text-purple-800 block mb-2">Padding</label>
                          <p className="text-xs text-gray-500 mb-2">Leave space between cuts.</p>
                          
                          <div className="flex justify-between items-center gap-4 mb-2">
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-fuchsia-700">Left</span>
                                <span className="text-xs font-mono">{leftPadding[0].toFixed(4)} s</span>
                              </div>
                              <Slider 
                                value={leftPadding} 
                                onValueChange={setLeftPadding}
                                max={0.2}
                                step={0.0001}
                                disabled={!hasFile}
                                className="[&>*:nth-child(2)]:bg-fuchsia-500"
                              />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-pink-700">Right</span>
                                <span className="text-xs font-mono">{rightPadding[0].toFixed(4)} s</span>
                              </div>
                              <Slider 
                                value={rightPadding} 
                                onValueChange={setRightPadding}
                                max={0.2}
                                step={0.0001}
                                disabled={!hasFile}
                                className="[&>*:nth-child(2)]:bg-pink-500"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                              disabled={!hasFile}
                            >
                              <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                              </svg>
                              Link Values
                            </Button>
                          </div>
                        </div>

                        {/* Remove Short Audio Spikes */}
                        <div>
                          <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-purple-800">Remove Short Audio Spikes</label>
                            <span className="text-sm font-mono">{audioSpikes[0]} s</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">Audible clips shorter than this will be cut.</p>
                          <Slider 
                            value={audioSpikes} 
                            onValueChange={setAudioSpikes}
                            max={1}
                            step={0.01}
                            disabled={!hasFile}
                            className="[&>*:nth-child(2)]:bg-gradient-to-r [&>*:nth-child(2)]:from-blue-500 [&>*:nth-child(2)]:to-cyan-500"
                          />
                        </div>

                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-100">
                          <h4 className="text-sm font-medium text-purple-800 mb-2 flex items-center">
                            <Sparkles className="h-4 w-4 mr-1 text-fuchsia-500" />
                            Preset Scripts
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="text-sm bg-white border-purple-200">Podcast</Button>
                            <Button variant="outline" size="sm" className="text-sm bg-white border-purple-200">Interview</Button>
                            <Button variant="outline" size="sm" className="text-sm bg-white border-purple-200">Tutorial</Button>
                            <Button variant="outline" size="sm" className="text-sm bg-white border-purple-200">Vlog</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sections">
                  <SectionsPanel 
                    sectionSplitDuration={sectionSplitDuration} 
                    onSectionSplitDurationChange={setSectionSplitDuration} 
                    onCreateSections={handleCreateSections} 
                    disabled={!hasFile} 
                  />
                </TabsContent>

                <TabsContent value="export">
                  <div className="p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-800 mb-1">Export Format</label>
                        <Select defaultValue="audio-wav">
                          <SelectTrigger className="border-purple-200 focus:ring-purple-500">
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
                        <span className="text-sm text-purple-800">Include Silence Markers</span>
                        <Switch disabled={!hasFile} className="data-[state=checked]:bg-fuchsia-500" />
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-purple-800">Export With Cuts Applied</span>
                        <Switch defaultChecked disabled={!hasFile} className="data-[state=checked]:bg-fuchsia-500" />
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-100 mb-4">
                        <h4 className="text-sm font-medium text-purple-800 mb-2">Quality Settings</h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Video Bitrate</span>
                              <span>High Quality</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full w-3/4 rounded-full"></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Audio Bitrate</span>
                              <span>320 kbps</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full w-full rounded-full"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-600 hover:from-purple-600 hover:via-fuchsia-600 hover:to-pink-700 shadow-md" 
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

          {/* Quick Stats Panel */}
          {hasFile && (
            <Card className="mt-4 border-0 shadow-md overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-500 w-full" />
              <CardContent className="p-4">
                <h3 className="text-lg font-medium text-blue-800 mb-3">Project Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-500">Original Length</span>
                    <span className="font-medium">02:30</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">After Edits</span>
                    <span className="font-medium">01:45</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">Silence Removed</span>
                    <span className="font-medium text-green-600">45s (30%)</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">Cut Points</span>
                    <span className="font-medium">24</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
