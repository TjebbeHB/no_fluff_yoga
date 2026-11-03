import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import appConfig from "../../app.json";
import { Preferences } from "../storage";
import { SOUND_OPTIONS } from "../soundCatalog";
import { useAmbientAudio } from "../useAmbientAudio";
import { GUIDE_LINES } from "../guideScript";
import { GuideVoice, VOICES, VoiceId, voiceUrl } from "../voices";
import {
  installedVoices,
  installVoice,
  openVoicePack,
  removeVoice,
} from "../voicePacks";
import { createClipPlayer } from "../clipPlayer";
import { speak, stopSpeech } from "../deviceSpeech";
import { Illustration } from "../Illustration";
import { color, font, MAX_WIDTH, radius, type, ui } from "./design";
import { Icon } from "./Icon";
import { AppIcon } from "./Logo";
import { Divider, Group, RadioRow, Segmented, SwitchRow } from "./ui";

type Toggle = {
  key: "ambientEnabled" | "chime" | "guide" | "smile" | "stripes" | "bun";
  label: string;
  description: string;
};
const GUIDE_TOGGLE: Toggle = {
  key: "guide",
  label: "Audio guide",
  description:
    "A calm voice leads you from pose to pose, so you can practise with your screen off.",
};
const CHIME_TOGGLE: Toggle = {
  key: "chime",
  label: "Transition chime",
  description: "A soft bell when it's time to move to the next pose.",
};
const SOUND_TOGGLE: Toggle = {
  key: "ambientEnabled",
  label: "Nature sounds",
  description: "Play softly during your practice.",
};
const LOOK_TOGGLES: Toggle[] = [
  {
    key: "smile",
    label: "Open smile",
    description: "A big, open smile. Off for a softer, closed smile.",
  },
  {
    key: "stripes",
    label: "Striped tee",
    description: "Cream with green stripes. Off for a plain green sports shirt.",
  },
  {
    key: "bun",
    label: "Hair in a bun",
    description: "Hair up for practice. Off to wear it long and loose.",
  },
];
const STYLES = [
  {
    id: "detailed",
    name: "Detailed",
    description:
      "Describes how to move into each pose and what to notice while you hold it.",
  },
  {
    id: "brief",
    name: "Brief",
    description: "Just names the next pose, like “Next, warrior two, right side.”",
  },
] as const;

export function Settings({
  preferences,
  onChange,
  onClose,
  error,
}: {
  preferences: Preferences;
  onChange: (p: Partial<Preferences>) => void;
  onClose: () => void;
  error: string | null;
}) {
  const [preview, setPreview] = useState(false);
  const audio = useAmbientAudio({
    soundOn: true,
    sound: preferences.ambient,
    active: preview,
  });
  const [installed, setInstalled] = useState<VoiceId[]>([]);
  const [progress, setProgress] = useState<Partial<Record<VoiceId, number>>>(
    {},
  );
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [listening, setListening] = useState<string | null>(null);
  const player = useRef<ReturnType<typeof createClipPlayer> | null>(null);
  useEffect(() => {
    let live = true;
    void installedVoices().then((ids) => {
      if (live) setInstalled(ids);
    });
    player.current = createClipPlayer();
    return () => {
      live = false;
      player.current?.release();
      void stopSpeech().catch(() => {});
    };
  }, []);
  useEffect(() => {
    const quiet = () => {
      setPreview(false);
      player.current?.stop();
      void stopSpeech().catch(() => {});
    };
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") quiet();
    });
    const hide = () => {
      if (document.hidden) quiet();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", hide);
    return () => {
      sub.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  const listen = async (voice: GuideVoice) => {
    const again = listening === voice;
    player.current?.stop();
    await stopSpeech().catch(() => {});
    setVoiceError(null);
    if (again) return setListening(null);
    setListening(voice);
    try {
      if (voice === "device") await speak(GUIDE_LINES.sample, () => true);
      else {
        // Installed voices play from the phone; others stream a short sample.
        const pack = installed.includes(voice)
          ? await openVoicePack(voice)
          : null;
        await player.current!.play(
          pack?.clip("sample") ?? voiceUrl(voice, "sample.m4a"),
        );
      }
    } catch {
      setVoiceError(
        voice === "device"
          ? "The device voice isn’t responding. Check your device’s text-to-speech settings."
          : "That sample could not play. Check your connection and try again.",
      );
    }
    setListening((current) => (current === voice ? null : current));
  };
  const install = async (voice: VoiceId) => {
    setVoiceError(null);
    setProgress((p) => ({ ...p, [voice]: 0 }));
    try {
      await installVoice(voice, (fraction) =>
        setProgress((p) => ({ ...p, [voice]: fraction })),
      );
      setInstalled(await installedVoices());
      onChange({ voice });
    } catch (e) {
      setVoiceError(
        "That voice could not be installed. Check your connection and try again.",
      );
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[voice];
        return next;
      });
    }
  };
  const remove = async (voice: VoiceId) => {
    await removeVoice(voice).catch(() => {});
    setInstalled(await installedVoices());
    if (preferences.voice === voice) onChange({ voice: "device" });
  };
  const toggle = (item: Toggle) => (
    <SwitchRow
      label={item.label}
      description={item.description}
      value={preferences[item.key]}
      onChange={(value) => onChange({ [item.key]: value })}
    />
  );
  const voiceRow = (
    id: GuideVoice,
    title: string,
    detail: string,
    ready: boolean,
  ) => {
    const fraction = id === "device" ? undefined : progress[id];
    return (
      <View key={id} style={{ paddingHorizontal: 16 }}>
        <RadioRow
          label={title}
          description={detail}
          accessibilityLabel={id === "device" ? title : `${title} voice`}
          selected={preferences.voice === id}
          disabled={!ready}
          onPress={() => onChange({ voice: id })}
        />
        <View style={s.voiceActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Listen to ${title}`}
            onPress={() => void listen(id)}
            style={({ pressed }) => [s.pill, pressed && s.pillPressed]}
          >
            <Icon
              name={listening === id ? "pause" : "play"}
              size={13}
              tint={color.ink}
            />
            <Text style={s.pillText}>{listening === id ? "Stop" : "Listen"}</Text>
          </Pressable>
          {id !== "device" &&
            (fraction !== undefined ? (
              <Text accessibilityLiveRegion="polite" style={type.caption}>
                Installing… {Math.round(fraction * 100)}%
              </Text>
            ) : ready ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${title} voice`}
                onPress={() => void remove(id)}
                style={({ pressed }) => [
                  s.pill,
                  s.pillQuiet,
                  pressed && s.pillPressed,
                ]}
              >
                <Icon name="trash" size={14} tint={color.muted} />
                <Text style={[s.pillText, { color: color.muted }]}>Remove</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Install ${title} voice`}
                onPress={() => void install(id)}
                style={({ pressed }) => [
                  s.pill,
                  s.pillStrong,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Icon name="down" size={14} tint={color.white} />
                <Text style={[s.pillText, { color: color.white }]}>
                  Install ·{" "}
                  {VOICES.find((v) => v.id === id)!.megabytes.toFixed(1)} MB
                </Text>
              </Pressable>
            ))}
        </View>
      </View>
    );
  };
  const style = STYLES.find((s) => s.id === preferences.guideStyle)!;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.page}>
        <View style={s.header}>
          <View style={[ui.row, s.column]}>
            <Text style={type.title}>Settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              style={({ pressed }) => [s.done, pressed && { opacity: 0.85 }]}
              onPress={onClose}
            >
              <Text style={s.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <Group
            title="AUDIO GUIDE"
            note={
              <Text style={type.caption}>
                With the audio guide on, your practice keeps going when you lock
                your screen. When a pose needs you to change position, the guide
                explains it and carries on after a short pause.
              </Text>
            }
          >
            {toggle(GUIDE_TOGGLE)}
            <View style={!preferences.guide && s.dimmed}>
              <Divider />
              <View style={s.inset}>
                <Text style={[type.label, { marginBottom: 10 }]}>
                  How much it says
                </Text>
                <Segmented
                  role="radio"
                  value={preferences.guideStyle}
                  onChange={(guideStyle) => onChange({ guideStyle })}
                  options={STYLES.map((option) => ({
                    value: option.id,
                    label: option.name,
                    accessibilityLabel: `${option.name} guidance`,
                  }))}
                />
                <Text style={[type.small, { marginTop: 8 }]}>
                  {style.description}
                </Text>
              </View>
              <Divider />
              <View style={[s.inset, { paddingBottom: 4 }]}>
                <Text style={type.label}>Voice</Text>
                <Text style={[type.small, { marginTop: 2 }]}>
                  Paradee voices are small, natural-sounding recordings that
                  work offline once installed.
                </Text>
              </View>
              <View accessibilityRole="radiogroup">
                {voiceRow(
                  "device",
                  "Device voice",
                  "Your phone's built-in speech. Always available.",
                  true,
                )}
                {VOICES.map((voice) => (
                  <View key={voice.id}>
                    <Divider />
                    {voiceRow(
                      voice.id,
                      voice.name,
                      `Paradee · ${voice.accent}`,
                      installed.includes(voice.id),
                    )}
                  </View>
                ))}
              </View>
              {voiceError && (
                <Text style={[ui.error, s.inset, { marginTop: 0 }]}>
                  {voiceError}
                </Text>
              )}
            </View>
          </Group>
          <Group>{toggle(CHIME_TOGGLE)}</Group>

          <Group title="SOUND">
            {toggle(SOUND_TOGGLE)}
            <Divider />
            <View
              accessibilityRole="radiogroup"
              style={[{ paddingLeft: 16, paddingRight: 8 }, !preferences.ambientEnabled && s.dimmed]}
            >
              {SOUND_OPTIONS.map((option, i) => (
                <View key={option.id}>
                  {i > 0 && <Divider inset={36} />}
                  <RadioRow
                    label={option.name}
                    description={option.description}
                    selected={preferences.ambient === option.id}
                    onPress={() => onChange({ ambient: option.id })}
                  />
                </View>
              ))}
            </View>
            <Divider />
            <Pressable
              accessibilityRole="button"
              onPress={() => setPreview(!preview)}
              style={({ pressed }) => [s.listen, pressed && s.listenPressed]}
            >
              <Icon
                name={preview ? "pause" : "play"}
                size={16}
                tint={color.forest}
              />
              <Text style={[type.label, { color: color.forest }]}>
                {preview ? "Stop preview" : "Listen to sound"}
              </Text>
            </Pressable>
            {audio.error && (
              <Text style={[ui.error, s.inset, { marginTop: 0 }]}>
                This sound could not play. Try again.
              </Text>
            )}
          </Group>

          <Group title="CHARACTER">
            <View style={s.character}>
              <View style={s.characterArt}>
                <Illustration shape="reach" compact />
              </View>
              <Text style={[type.small, { flex: 1 }]}>
                How she looks in every illustration. Changes show here right
                away.
              </Text>
            </View>
            {LOOK_TOGGLES.map((item) => (
              <View key={item.key}>
                <Divider />
                {toggle(item)}
              </View>
            ))}
          </Group>

          <Group title="ABOUT">
            <View style={s.about}>
              <AppIcon size={52} />
              <View style={{ flex: 1 }}>
                <Text style={type.subheading}>Verdant Yoga</Text>
                <Text style={type.caption}>
                  Version {appConfig.expo.version}
                </Text>
              </View>
            </View>
            <Divider />
            <View style={[s.inset, { gap: 8 }]}>
              <Text style={type.small}>
                No ads, accounts or tracking. Your routines and settings stay on
                this device.
              </Text>
              <Text style={type.small}>
                The device voice uses an English voice from your phone; on
                iPhone, turn silent mode off to hear it. Paradee voices are by
                Sahil Mahendrakar (Apache 2.0), distilled from Kokoro-82M.
              </Text>
              <Text style={type.small}>
                Natural recordings are CC0. Rain: Q.K. · Birds: Magnesus ·
                Stream: peridactyloptrix.
              </Text>
            </View>
          </Group>
          {error && <Text style={ui.error}>{error}</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.paper },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: color.line,
  },
  column: {
    width: "100%",
    maxWidth: MAX_WIDTH - 24,
    alignSelf: "center",
  },
  done: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: color.forest,
    justifyContent: "center",
  },
  doneText: { fontFamily: font.medium, fontSize: 14, color: color.white },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 48,
    width: "100%",
    maxWidth: MAX_WIDTH + 20,
    alignSelf: "center",
  },
  inset: { paddingHorizontal: 16, paddingVertical: 14 },
  dimmed: { opacity: 0.5 },
  voiceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 36,
    marginTop: -6,
    paddingBottom: 14,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.card,
  },
  pillQuiet: { borderColor: "transparent", backgroundColor: "transparent" },
  pillStrong: { backgroundColor: color.forest, borderColor: color.forest },
  pillPressed: { backgroundColor: color.sunken },
  pillText: { fontFamily: font.medium, fontSize: 12, color: color.ink },
  listen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  listenPressed: { backgroundColor: color.sunken },
  character: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
  },
  characterArt: {
    width: 108,
    height: 120,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#DFE4D5",
  },
  about: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
});
