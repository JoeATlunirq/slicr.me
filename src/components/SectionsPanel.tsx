
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Layers } from "lucide-react";

interface SectionsPanelProps {
  sectionSplitDuration: number[];
  onSectionSplitDurationChange: (value: number[]) => void;
  onCreateSections: () => void;
  disabled: boolean;
}

const SectionsPanel: React.FC<SectionsPanelProps> = ({ 
  sectionSplitDuration, 
  onSectionSplitDurationChange, 
  onCreateSections,
  disabled
}) => {
  return (
    <div className="p-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-violet-800 mb-3">Split the timeline into sections</h3>
          <p className="text-sm text-gray-600 mb-6">
            Create logical sections based on silence duration to organize your content and export multiple files.
          </p>
        </div>

        <div className="border-t border-violet-100 pt-4">
          <h4 className="font-medium mb-2 flex items-center">
            <Layers className="h-4 w-4 mr-2 text-violet-500" />
            Split on Silence
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Silence longer than this starts a new section.
          </p>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1">
              <Slider
                value={sectionSplitDuration}
                onValueChange={onSectionSplitDurationChange}
                min={1}
                max={10}
                step={0.5}
                disabled={disabled}
                className="[&>*:nth-child(2)]:bg-violet-500"
              />
            </div>
            <div className="w-24 flex items-center">
              <input
                type="number"
                className="w-16 p-1 border border-gray-300 rounded text-right"
                value={sectionSplitDuration[0]}
                onChange={(e) => onSectionSplitDurationChange([parseFloat(e.target.value) || 0])}
                disabled={disabled}
                min={1}
                max={10}
                step={0.5}
              />
              <span className="ml-2 text-gray-600">s</span>
            </div>
          </div>
          
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-6">
            <h5 className="text-sm font-medium text-violet-800 mb-2">What are sections?</h5>
            <p className="text-xs text-gray-600">
              Sections let you organize longer recordings into logical parts. They're perfect for:
            </p>
            <ul className="text-xs text-gray-600 list-disc pl-5 mt-2 space-y-1">
              <li>Splitting podcast episodes into topics</li>
              <li>Creating chapter markers for videos</li>
              <li>Batch exporting multiple files from a single recording</li>
            </ul>
          </div>
          
          <Button
            onClick={onCreateSections}
            disabled={disabled}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
          >
            Create Sections
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SectionsPanel;
