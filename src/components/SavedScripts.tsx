
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Edit, Star, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Script {
  id: string;
  name: string;
  description: string;
  settings: {
    threshold: number;
    minDuration: number;
    leftPadding: number;
    rightPadding: number;
    audioSpikes: number;
  };
  isFavorite: boolean;
  category: string;
  lastUsed: string;
}

const SavedScriptsPage = () => {
  const [scripts, setScripts] = useState<Script[]>([
    {
      id: '1',
      name: 'Podcast Preset',
      description: 'Best for conversational podcasts with natural pauses',
      settings: {
        threshold: 0.022,
        minDuration: 0.5,
        leftPadding: 0.038,
        rightPadding: 0.042,
        audioSpikes: 0.2
      },
      isFavorite: true,
      category: 'Podcast',
      lastUsed: '2025-04-26'
    },
    {
      id: '2',
      name: 'Fast Tutorial',
      description: 'Removes all pauses for fast-paced tutorial videos',
      settings: {
        threshold: 0.015,
        minDuration: 0.3,
        leftPadding: 0.02,
        rightPadding: 0.02,
        audioSpikes: 0.15
      },
      isFavorite: false,
      category: 'Tutorial',
      lastUsed: '2025-04-24'
    },
    {
      id: '3',
      name: 'Interview Style',
      description: 'Preserves thoughtful pauses in interview content',
      settings: {
        threshold: 0.025,
        minDuration: 1.2,
        leftPadding: 0.045,
        rightPadding: 0.045,
        audioSpikes: 0.3
      },
      isFavorite: true,
      category: 'Interview',
      lastUsed: '2025-04-20'
    },
    {
      id: '4',
      name: 'Vlog Mode',
      description: 'Natural cuts for vlogs and casual content',
      settings: {
        threshold: 0.018,
        minDuration: 0.7,
        leftPadding: 0.035,
        rightPadding: 0.035,
        audioSpikes: 0.25
      },
      isFavorite: false,
      category: 'Vlog',
      lastUsed: '2025-04-15'
    }
  ]);

  const toggleFavorite = (id: string) => {
    setScripts(scripts.map(script => 
      script.id === id ? {...script, isFavorite: !script.isFavorite} : script
    ));
    
    const script = scripts.find(s => s.id === id);
    if (script) {
      toast({
        title: script.isFavorite ? "Removed from favorites" : "Added to favorites",
        description: `"${script.name}" ${script.isFavorite ? "removed from" : "added to"} your favorites.`
      });
    }
  };

  const handleDelete = (id: string) => {
    setScripts(scripts.filter(script => script.id !== id));
    toast({
      title: "Script deleted",
      description: "The script has been removed."
    });
  };

  const handleUseScript = (id: string) => {
    toast({
      title: "Script applied",
      description: "The settings have been applied to the current project."
    });
  };

  const handleDuplicate = (id: string) => {
    const scriptToDuplicate = scripts.find(script => script.id === id);
    if (scriptToDuplicate) {
      const newScript = {
        ...scriptToDuplicate,
        id: Date.now().toString(),
        name: `${scriptToDuplicate.name} (Copy)`,
        isFavorite: false,
        lastUsed: new Date().toISOString().split('T')[0]
      };
      
      setScripts([...scripts, newScript]);
      toast({
        title: "Script duplicated",
        description: `Created a copy of "${scriptToDuplicate.name}".`
      });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Podcast': return 'bg-purple-100 text-purple-800';
      case 'Tutorial': return 'bg-blue-100 text-blue-800';
      case 'Interview': return 'bg-pink-100 text-pink-800';
      case 'Vlog': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              Saved Scripts
            </h1>
            <p className="text-gray-600">
              Reuse your perfect settings for different projects
            </p>
          </div>
          <div className="flex items-center bg-fuchsia-100 p-3 rounded-full text-fuchsia-600">
            <Save className="h-6 w-6" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scripts.map((script) => (
            <Card key={script.id} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm">
              <div className="h-2 bg-gradient-to-r from-purple-400 to-pink-500 w-full" />
              
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{script.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`p-1 ${script.isFavorite ? 'text-yellow-500' : 'text-gray-300'}`}
                    onClick={() => toggleFavorite(script.id)}
                  >
                    <Star className={`h-5 w-5 ${script.isFavorite ? 'fill-yellow-500' : ''}`} />
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(script.category)}`}>
                    {script.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    Last used: {script.lastUsed}
                  </span>
                </div>
                
                <CardDescription className="mt-2">{script.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="pb-2">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Threshold:</span>
                    <span>{script.settings.threshold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Min Duration:</span>
                    <span>{script.settings.minDuration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Padding:</span>
                    <span>{script.settings.leftPadding}s / {script.settings.rightPadding}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Audio Spikes:</span>
                    <span>{script.settings.audioSpikes}s</span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="pt-2 flex justify-between">
                <Button 
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                  onClick={() => handleUseScript(script.id)}
                >
                  Use Script
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => handleDuplicate(script.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(script.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}

          {/* Add New Script Card */}
          <Card className="flex items-center justify-center border-2 border-dashed border-gray-300 bg-transparent shadow-none hover:border-purple-400 transition-colors h-[300px]">
            <Button 
              variant="ghost" 
              className="text-gray-500 hover:text-purple-600 flex flex-col items-center p-6"
            >
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <Plus className="h-8 w-8" />
              </div>
              <span className="text-lg font-medium">Create New Script</span>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Add Plus icon as it wasn't imported from lucide-react
const Plus = ({ className }: { className?: string }) => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default SavedScriptsPage;
