
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Clock, Layout, Download, Settings } from "lucide-react";

const Features = () => {
  const features = [
    {
      title: "Smart Silence Detection",
      description: "Our advanced algorithm identifies and removes silent parts with precision and accuracy.",
      icon: Scissors,
      color: "from-violet-400 to-purple-400"
    },
    {
      title: "Timeline Editor",
      description: "Fine-tune your edits with our intuitive timeline interface for complete creative control.",
      icon: Layout,
      color: "from-blue-400 to-indigo-400"
    },
    {
      title: "Time-Saving Automation",
      description: "What used to take hours now happens in seconds - giving you back precious time.",
      icon: Clock,
      color: "from-pink-400 to-rose-400"
    },
    {
      title: "Flexible Export Options",
      description: "Export to popular formats or create edit lists for professional video editing software.",
      icon: Download,
      color: "from-emerald-400 to-teal-400"
    }
  ];

  return (
    <section id="features" className="py-20 bg-gradient-to-r from-violet-50 to-indigo-50">
      <div className="text-center mb-16">
        <span className="inline-block bg-violet-100 text-violet-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
          POWERFUL FEATURES
        </span>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Say goodbye to tedious editing</h2>
        <p className="text-xl text-gray-700 max-w-3xl mx-auto">
          SilenceCut transforms the way you edit by intelligently handling the most time-consuming part of post-production.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto px-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/90 backdrop-blur-sm overflow-hidden group">
            <div className={`h-2 bg-gradient-to-r ${feature.color} w-full`} />
            <CardHeader className="flex flex-col items-center space-y-2 pt-8">
              <div className={`p-3 rounded-full bg-gradient-to-r ${feature.color} text-white transform group-hover:scale-110 transition-transform`}>
                <feature.icon className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl text-center">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <CardDescription className="text-base">{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-16 text-center">
        <div className="inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500">
          <button className="bg-white rounded-full px-8 py-3 font-medium text-gray-800 hover:bg-gray-50">
            See all features
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;
