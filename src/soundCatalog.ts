/** Local CC0 field recordings. Individual provenance is in AUDIO_CREDITS.md. */
export type AmbientSound = "rain" | "birds" | "stream";

export const SOUND_OPTIONS: {
  id: AmbientSound;
  name: string;
  description: string;
}[] = [
  { id: "rain", name: "Soft rain", description: "A gentle fall of rain" },
  {
    id: "birds",
    name: "Forest birds",
    description: "Birdsong among the trees",
  },
  {
    id: "stream",
    name: "Quiet stream",
    description: "Water flowing over stones",
  },
];

export const SOUND_SOURCES: Record<AmbientSound, number> = {
  rain: require("../assets/natural-rain.wav"),
  birds: require("../assets/natural-birds.wav"),
  stream: require("../assets/natural-stream.wav"),
};
