
import { Check } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      number: 1,
      title: "Add your files",
      description: "Upload your video or audio files. SilenceCut supports multiple tracks while keeping them in perfect sync.",
      features: [
        "MP4, WAV, M4A, and more formats supported",
        "Multiple camera angles and audio tracks",
        "Keep everything in perfect sync"
      ]
    },
    {
      number: 2,
      title: "Cut silence, with preview",
      description: "Adjust the settings and hear how it will sound – instantly – without needing to wait for reprocessing.",
      features: [
        "Skip silence during playback",
        "Tweak settings instantly",
        "Fine-tune for perfect results"
      ]
    },
    {
      number: 3,
      title: "Export",
      description: "Export a new audio/video file, or take the timeline into your favorite editor to continue your work.",
      features: [
        "Export to MP4, WAV, or M4A",
        "Create edit lists for professional software",
        "No quality loss in the process"
      ]
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How SilenceCut Works</h2>
        
        <div className="space-y-20">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
              <div className={`md:w-1/2 ${index % 2 === 1 ? "md:order-2" : ""}`}>
                <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-primary mb-6">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <p className="text-lg text-gray-700 mb-6">{step.description}</p>
                
                <ul className="space-y-3">
                  {step.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      <Check className="h-5 w-5 text-primary mr-2 mt-1 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className={`md:w-1/2 ${index % 2 === 1 ? "md:order-1" : ""}`}>
                <div className="bg-gray-200 rounded-lg h-64 flex items-center justify-center">
                  <p className="text-gray-500 text-lg">Step {step.number} illustration</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
