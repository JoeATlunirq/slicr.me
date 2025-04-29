
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Play, Trash2, Edit, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface HistoryItem {
  id: string;
  name: string;
  duration: string;
  date: string;
  thumbnail: string;
}

const HistoryPage = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([
    {
      id: '1',
      name: 'Podcast Episode 42',
      duration: '54:32',
      date: '2025-04-25',
      thumbnail: 'https://via.placeholder.com/150/3b82f6/ffffff'
    },
    {
      id: '2',
      name: 'Tutorial Video - Getting Started',
      duration: '12:45',
      date: '2025-04-23',
      thumbnail: 'https://via.placeholder.com/150/8b5cf6/ffffff'
    },
    {
      id: '3',
      name: 'Interview with Jane Smith',
      duration: '31:18',
      date: '2025-04-20',
      thumbnail: 'https://via.placeholder.com/150/ec4899/ffffff'
    },
    {
      id: '4',
      name: 'Monthly Wrap-up',
      duration: '22:10',
      date: '2025-04-15',
      thumbnail: 'https://via.placeholder.com/150/10b981/ffffff'
    }
  ]);

  const handleDelete = (id: string) => {
    setHistoryItems(items => items.filter(item => item.id !== id));
    toast({
      title: "Project removed from history",
      description: "The project has been removed from your history."
    });
  };

  const handleEdit = (id: string) => {
    toast({
      title: "Loading project",
      description: "Opening project for editing..."
    });
  };

  const handleDownload = (id: string) => {
    toast({
      title: "Downloading project",
      description: "Your project file is being prepared for download."
    });
  };

  const handlePlay = (id: string) => {
    toast({
      title: "Playing preview",
      description: "Loading preview..."
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
              Project History
            </h1>
            <p className="text-gray-600">
              Access and continue your previous editing projects
            </p>
          </div>
          <div className="flex items-center bg-blue-100 p-3 rounded-full text-blue-600">
            <History className="h-6 w-6" />
          </div>
        </div>

        {historyItems.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {historyItems.map((item) => (
              <Card key={item.id} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm">
                <div className="relative h-40 bg-gradient-to-r from-indigo-400 to-blue-500">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button 
                      variant="ghost" 
                      className="bg-white/20 hover:bg-white/30 text-white rounded-full"
                      onClick={() => handlePlay(item.id)}
                    >
                      <Play className="h-8 w-8 fill-white" />
                    </Button>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{item.name}</CardTitle>
                  <CardDescription>
                    <div className="flex justify-between items-center">
                      <span>{item.date}</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                        {item.duration}
                      </span>
                    </div>
                  </CardDescription>
                </CardHeader>
                
                <CardFooter className="pt-0 flex justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(item.id)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(item.id)}>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="flex justify-center mb-4">
              <History className="h-16 w-16 text-gray-300" />
            </div>
            <h3 className="text-xl font-medium mb-2">No history yet</h3>
            <p className="text-gray-500 mb-4">
              Your project history will appear here once you start editing videos
            </p>
            <Button>Upload a File</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
