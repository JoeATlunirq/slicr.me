
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Play, Download, Settings } from "lucide-react";

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

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((feature, index) => (
          <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-col items-center space-y-2">
              <div className="p-3 bg-primary/10 rounded-full">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl text-center">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-base">{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default Features;
