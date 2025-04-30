import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Play, Download, Settings, Zap, FileVideo } from "lucide-react";

const Features = () => {
  const features = [
    {
      title: "Automatic Jump Cutting",
      description: "Our algorithm detects and removes silent parts from your videos with just a few clicks.",
      icon: Scissors
    },
    {
      title: "Real-time Preview",
      description: "See and hear how your video will sound after processing, before committing to the changes.",
      icon: Play
    },
    {
      title: "Multiple Export Options",
      description: "Export to MP4, WAV, or create edit lists for professional video editing software.",
      icon: Download
    },
    {
      title: "Fine-tuned Controls",
      description: "Adjust silence detection sensitivity, minimum silence duration, and padding around cuts.",
      icon: Settings
    }
  ];

  return (
    <section id="features" className="py-20">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Remove the pauses with Snipr.me</h2>
        <p className="text-xl text-gray-700 max-w-3xl mx-auto">
          Snipr.me is an automatic video editing tool that finds and removes silent parts in your videos and podcasts.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary"/> Fast & Automatic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Automatically detect and remove silent parts in your videos and podcasts. No manual cutting needed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary"/> Precise Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Fine-tune silence detection settings and adjust cuts easily on the interactive timeline.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-primary"/> Flexible Exports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Export directly to video/audio files or generate edit lists (EDL) for DaVinci Resolve, Premiere Pro, etc.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Features;
