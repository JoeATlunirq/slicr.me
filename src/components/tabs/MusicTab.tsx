import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MusicTrack {
  Id: string | number; // Allow string or number for ID
  Title: string;
  Mood?: string;
  Description?: string;
}

interface MusicTabProps {
  addMusic: boolean;
  setAddMusic: (value: boolean) => void;
  autoSelectMusic: boolean;
  setAutoSelectMusic: (value: boolean) => void;
  musicTrackId: string | null; // Can be null
  setMusicTrackId: (value: string | null) => void;
  musicVolumeDb: number;
  setMusicVolumeDb: (value: number) => void;
  availableMusicTracks: MusicTrack[];
  isLoadingMusic: boolean;
  tracksError: Error | null; // Pass error state
}

const MusicTab: React.FC<MusicTabProps> = ({
  addMusic,
  setAddMusic,
  autoSelectMusic,
  setAutoSelectMusic,
  musicTrackId,
  setMusicTrackId,
  musicVolumeDb,
  setMusicVolumeDb,
  availableMusicTracks,
  isLoadingMusic,
  tracksError
}) => {

  const handleVolumeChange = (value: number[]) => {
    setMusicVolumeDb(value[0]);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="add-music"
              checked={addMusic}
              onCheckedChange={(checked) => setAddMusic(Boolean(checked))}
            />
            <Label htmlFor="add-music" className="text-base font-medium">
              Add Background Music
            </Label>
          </div>

          {addMusic && (
            <div className="space-y-4 pl-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-select-music"
                  checked={autoSelectMusic}
                  onCheckedChange={(checked) => {
                    setAutoSelectMusic(Boolean(checked));
                    if (Boolean(checked)) {
                      setMusicTrackId(null); // Clear manual selection if auto is chosen
                    }
                  }}
                />
                <Label htmlFor="auto-select-music">
                  Auto-Select Music (Requires Transcription)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Let an AI choose the best track based on the voiceover's content.
                Falls back to random if transcription is off or analysis fails.
              </p>

              {!autoSelectMusic && (
                <div className="space-y-2">
                  <Label htmlFor="music-track">Manually Select Track</Label>
                  <Select
                    value={musicTrackId ?? ''} // Handle null case for value
                    onValueChange={(value) => setMusicTrackId(value || null)} // Set back to null if empty
                    disabled={isLoadingMusic || autoSelectMusic}
                  >
                    <SelectTrigger className="w-[80%]">
                      <SelectValue placeholder={isLoadingMusic ? "Loading tracks..." : "Select a music track"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tracksError && <SelectItem value="error" disabled>Error loading tracks</SelectItem>}
                      {availableMusicTracks?.map((track) => (
                        <SelectItem key={track.Id} value={track.Id.toString()}>
                          {track.Title} ({track.Mood})
                        </SelectItem>
                      ))}
                      {availableMusicTracks?.length === 0 && !isLoadingMusic && !tracksError && (
                           <SelectItem value="none" disabled>No tracks found</SelectItem>
                       )}
                    </SelectContent>
                  </Select>
                  {tracksError && <p className="text-xs text-red-500">Failed to load music list.</p>}
                  {musicTrackId && !autoSelectMusic && (
                    <p className="text-xs text-muted-foreground mt-1 w-[80%]">
                      {availableMusicTracks.find(t => t.Id.toString() === musicTrackId)?.Description}
                    </p>
                  )}
                </div>
              )}

              {(musicTrackId || autoSelectMusic) && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="music-volume">Music Ducking Level (dBFS)</Label>
                  <Slider
                    id="music-volume"
                    min={-40}
                    max={-6}
                    step={1}
                    defaultValue={[-23]}
                    value={[musicVolumeDb]}
                    onValueChange={handleVolumeChange}
                    className="w-[60%]"
                    disabled={!addMusic}
                  />
                  <span className="text-sm text-muted-foreground">{musicVolumeDb} dBFS</span>
                  <p className="text-xs text-muted-foreground">
                    Adjust how much the music volume lowers when voice is present. (-23dBFS is default).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MusicTab; 