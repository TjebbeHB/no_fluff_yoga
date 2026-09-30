import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond/500Medium";
import { CormorantGaramond_400Regular } from "@expo-google-fonts/cormorant-garamond/400Regular";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { useAmbientAudio } from "./src/useAmbientAudio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import Svg, { Path } from "react-native-svg";
import { Illustration, Sprig } from "./src/Illustration";
import { useGuidance } from "./src/useGuidance";
import {
  useLibrary,
  materialize,
  SavedRoutine,
  Preferences,
} from "./src/storage";
import { RoutineBuilder } from "./src/components/RoutineBuilder";
import { SoundSettings } from "./src/components/SoundSettings";
import { ui } from "./src/components/design";
import { SOUND_OPTIONS } from "./src/soundCatalog";
import {
  formatTime,
  locatePose,
  Routine,
  routines,
  totalSeconds,
  durationLabel,
} from "./src/routines";
const C = {
  ink: "#293D30",
  muted: "#7A7E70",
  sage: "#7D8C6C",
  paper: "#F8F5ED",
  line: "#E2E2D6",
};
function Icon({
  kind,
  size = 22,
  color = C.ink,
}: {
  kind: "back" | "play" | "pause" | "sound" | "mute" | "next" | "check";
  size?: number;
  color?: string;
}) {
  const d = {
    back: "M19 12H5m6-6-6 6 6 6",
    play: "M8 5l11 7-11 7Z",
    pause: "M8 5v14M16 5v14",
    sound: "M4 9h4l5-4v14l-5-4H4Zm13-2q5 5 0 10m3-13q8 8 0 16",
    mute: "M4 9h4l5-4v14l-5-4H4Zm13 0 5 6m0-6-5 6",
    next: "M6 5l10 7-10 7ZM19 5v14",
    check: "m5 12 4 4L19 6",
  }[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={d}
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={kind === "play" ? color : "none"}
      />
    </Svg>
  );
}
function Button({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: C.ink }]}>{label}</Text>
      {!secondary && <Icon kind="play" color="#fff" size={18} />}
    </Pressable>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
  });
  const [selected, setSelected] = useState(routines[0]);
  const [screen, setScreen] = useState<
    "home" | "practice" | "complete" | "builder"
  >("home");
  const library = useLibrary();
  const [tab, setTab] = useState<"presets" | "custom">("presets");
  const [editing, setEditing] = useState<SavedRoutine | undefined>();
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState<SavedRoutine | null>(null);
  const preferences = library.state.preferences;
  const changePreferences = (patch: Partial<Preferences>) => {
    void library
      .persist((previous) => ({
        ...previous,
        preferences: { ...previous.preferences, ...patch },
      }))
      .catch(() => {});
  };
  const customRoutines = library.state.routines.map(materialize);
  const shownRoutines = tab === "presets" ? routines : customRoutines;
  const [completedSeconds, setCompletedSeconds] = useState(0);
  if ((!fontsLoaded && !fontError) || !library.ready)
    return (
      <View
        style={[s.root, { justifyContent: "center", alignItems: "center" }]}
      >
        <Text>Preparing your practice…</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={s.root}>
        <View style={s.shell}>
          {screen === "home" ? (
            <>
              <ScrollView
                contentContainerStyle={s.home}
                showsVerticalScrollIndicator={false}
              >
                <View style={s.brand}>
                  <View style={s.brandName}>
                    <Sprig size={25} color={C.ink} />
                    <Text style={s.wordmark}>verdant</Text>
                  </View>
                  <Text style={s.eyebrow}>A LITTLE SPACE FOR YOU</Text>
                </View>
                <View style={s.headingRow}>
                  <View>
                    <Text style={s.title}>Your practice.</Text>
                    <Text style={s.subtitle}>
                      Come as you are. Begin gently.
                    </Text>
                  </View>
                  <Sprig size={66} />
                </View>
                <View style={s.sectionRow}>
                  <Text style={s.eyebrow}>FIND YOUR FLOW</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSettings(true)}
                    style={ui.textButton}
                  >
                    <Text style={ui.link}>Sound & guidance</Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    ui.row,
                    { justifyContent: "flex-start", marginBottom: 12 },
                  ]}
                >
                  {(["presets", "custom"] as const).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: tab === value }}
                      aria-selected={tab === value}
                      style={[ui.pill, tab === value && ui.selected]}
                      onPress={() => setTab(value)}
                    >
                      <Text style={ui.link}>
                        {value === "presets" ? "Ready-made" : "My routines"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {tab === "custom" && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      style={[ui.button, { marginBottom: 12 }]}
                      onPress={() => {
                        setEditing(undefined);
                        setScreen("builder");
                      }}
                    >
                      <Text style={ui.buttonText}>Create a routine</Text>
                    </Pressable>
                    {!customRoutines.length && (
                      <Text style={[ui.body, { marginVertical: 20 }]}>
                        Make room for your favorite moves. Choose, arrange, and
                        save a practice that feels like you.
                      </Text>
                    )}
                  </>
                )}
                {library.error && <Text style={ui.error}>{library.error}</Text>}
                {shownRoutines.map((r) => (
                  <Pressable
                    key={r.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: r.id === selected.id }}
                    aria-checked={r.id === selected.id}
                    accessibilityLabel={`${r.name}, ${r.minutes} minutes`}
                    onPress={() => setSelected(r)}
                    style={({ pressed }) => [
                      s.card,
                      selected.id === r.id && s.selectedCard,
                      pressed && s.pressed,
                    ]}
                  >
                    <View style={[s.cardArt, { backgroundColor: r.color }]}>
                      <Illustration shape={r.art} compact />
                    </View>
                    <View style={s.cardContent}>
                      <Text style={s.cardMood}>{r.mood}</Text>
                      <Text style={s.cardTitle}>{r.name}</Text>
                      <Text style={s.small}>
                        {durationLabel(totalSeconds(r))} · {r.poses.length}{" "}
                        moves
                      </Text>
                    </View>
                    <View
                      style={[
                        s.radio,
                        selected.id === r.id && {
                          backgroundColor: C.sage,
                          borderColor: C.sage,
                        },
                      ]}
                    >
                      {selected.id === r.id && (
                        <Icon kind="check" color="white" size={13} />
                      )}
                    </View>
                  </Pressable>
                ))}
                {tab === "custom" &&
                  selected.custom &&
                  library.state.routines.some((r) => r.id === selected.id) && (
                    <View style={ui.row}>
                      <Pressable
                        accessibilityRole="button"
                        style={ui.textButton}
                        onPress={() => {
                          setEditing(
                            library.state.routines.find(
                              (r) => r.id === selected.id,
                            ),
                          );
                          setScreen("builder");
                        }}
                      >
                        <Text style={ui.link}>Edit routine</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        style={ui.textButton}
                        onPress={() =>
                          setDeleting(
                            library.state.routines.find(
                              (r) => r.id === selected.id,
                            )!,
                          )
                        }
                      >
                        <Text style={ui.link}>Delete routine</Text>
                      </Pressable>
                    </View>
                  )}
                <View style={s.note}>
                  <Sprig size={27} />
                  <Text style={s.noteText}>
                    No goals to chase. Just a moment to return to yourself.
                  </Text>
                </View>
              </ScrollView>
              <View style={s.footer}>
                <Text style={s.selectedLabel}>
                  {selected.name} <Text style={{ color: "#A3A896" }}> · </Text>{" "}
                  {durationLabel(totalSeconds(selected))} for you
                </Text>
                <Button
                  label="Start yoga"
                  onPress={() => setScreen("practice")}
                />
                <Text style={s.footerNote}>
                  Move within comfort. Rest whenever you need.
                </Text>
              </View>
            </>
          ) : screen === "builder" ? (
            <RoutineBuilder
              initial={editing}
              onCancel={() => setScreen("home")}
              onSave={async (saved) => {
                await library.persist((previous) => ({
                  ...previous,
                  routines: [
                    ...previous.routines.filter((r) => r.id !== saved.id),
                    saved,
                  ],
                }));
                setSelected(materialize(saved));
                setTab("custom");
                setScreen("home");
              }}
            />
          ) : screen === "practice" ? (
            <Practice
              routine={selected}
              preferences={preferences}
              setSound={(enabled) =>
                changePreferences({ ambientEnabled: enabled })
              }
              onOpenSettings={() => setSettings(true)}
              onExit={() => setScreen("home")}
              onComplete={(seconds) => {
                setCompletedSeconds(seconds);
                setScreen("complete");
              }}
            />
          ) : (
            <View style={s.complete}>
              <Sprig size={74} />
              <Text style={s.eyebrow}>PRACTICE COMPLETE</Text>
              <Text style={[s.title, { textAlign: "center" }]}>
                A little more{"\n"}grounded.
              </Text>
              <View style={{ width: "100%", height: 260 }}>
                <Illustration shape="seated" />
              </View>
              <Text style={s.subtitle}>
                Thank you for showing up for yourself.
              </Text>
              <Text style={[s.small, { marginTop: 12, marginBottom: 32 }]}>
                {selected.name} · {Math.floor(completedSeconds / 60)} min{" "}
                {Math.floor(completedSeconds % 60)} sec practiced
              </Text>
              <View style={{ width: "100%" }}>
                <Button
                  label="Back to your practice"
                  onPress={() => setScreen("home")}
                />
              </View>
            </View>
          )}
          {settings && (
            <SoundSettings
              preferences={preferences}
              onChange={changePreferences}
              onClose={() => setSettings(false)}
              error={library.error}
            />
          )}
          <Modal
            visible={!!deleting}
            transparent
            animationType="fade"
            onRequestClose={() => setDeleting(null)}
          >
            <View style={ui.overlay}>
              <View style={ui.dialog}>
                <Text style={ui.heading}>Delete {deleting?.name}?</Text>
                <Text style={[ui.body, { marginVertical: 16 }]}>
                  This removes the saved routine from this device.
                </Text>
                <Button
                  label="Keep routine"
                  onPress={() => setDeleting(null)}
                />
                <View style={ui.gap} />
                <Button
                  label="Delete saved routine"
                  secondary
                  onPress={() => {
                    const id = deleting?.id;
                    void library
                      .persist((previous) => ({
                        ...previous,
                        routines: previous.routines.filter((r) => r.id !== id),
                      }))
                      .then(() => {
                        if (selected.id === id) setSelected(routines[0]);
                        setDeleting(null);
                      })
                      .catch(() => {});
                  }}
                />
                {library.error && <Text style={ui.error}>{library.error}</Text>}
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function Practice({
  routine,
  preferences,
  setSound,
  onOpenSettings,
  onExit,
  onComplete,
}: {
  routine: Routine;
  preferences: Preferences;
  onOpenSettings: () => void;
  setSound: (v: boolean) => void;
  onExit: () => void;
  onComplete: (seconds: number) => void;
}) {
  useEffect(() => {
    let disposed = false;
    let acquired = false;
    const tag = `practice-${Date.now()}`;
    const release = () => {
      void deactivateKeepAwake(tag).catch(() => {});
    };
    void activateKeepAwakeAsync(tag)
      .then(() => {
        acquired = true;
        if (disposed) release();
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (acquired) release();
    };
  }, []);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const actualSeconds = useRef(0);
  const clock = useRef(Date.now());
  const finished = useRef(false);
  const sound = preferences.ambientEnabled;
  const position = locatePose(routine, elapsed),
    pose = routine.poses[position.index],
    next = routine.poses[position.index + 1];
  const total = totalSeconds(routine);
  const sessionId = useRef(`session-${Date.now()}`);
  const guidance = useGuidance({
    poseKey: `${sessionId.current}:${position.index}`,
    text: pose ? `${pose.name}${pose.side ? `, ${pose.side} side` : ""}` : "",
    active: !paused && !!pose && elapsed < total,
    chime: preferences.chime,
    speech: preferences.speech,
  });
  const ambient = useAmbientAudio(
    sound && !paused,
    preferences.ambient,
    guidance.ducking,
  );
  useEffect(() => {
    if (paused) return;
    clock.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now(),
        delta = (now - clock.current) / 1000;
      clock.current = now;
      actualSeconds.current += delta;
      setElapsed((v) => Math.min(v + delta, total));
    }, 100);
    return () => clearInterval(timer);
  }, [paused, total]);
  useEffect(() => {
    if (elapsed >= total && !finished.current) {
      finished.current = true;
      ambient.stop();
      onComplete(Math.min(actualSeconds.current, total));
    }
  }, [elapsed, total, onComplete, ambient.stop]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") setPaused(true);
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      setPaused(true);
      setExitOpen(true);
      return true;
    });
    const handleVisibility = () => {
      if (document.hidden) setPaused(true);
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      sub.remove();
      back.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
  useEffect(() => {
    if (pose && !preferences.speech)
      AccessibilityInfo.announceForAccessibility(
        `${pose.name}${pose.side ? `, ${pose.side} side` : ""}. ${pose.cue}`,
      );
  }, [position.index]);
  if (!pose) return <View />;
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.practice}
      >
        <View style={s.practiceNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave practice"
            style={s.iconButton}
            onPress={() => {
              setPaused(true);
              setExitOpen(true);
            }}
          >
            <Icon kind="back" />
          </Pressable>
          <Text style={s.navTitle}>{routine.name}</Text>
          <Text style={s.small}>
            {position.index + 1} / {routine.poses.length}
          </Text>
        </View>
        <View style={s.poseHeading}>
          <Text style={s.eyebrow}>
            {paused ? "A MOMENT TO PAUSE" : "BREATHE. FIND YOUR SPACE."}
          </Text>
          <Text style={s.poseTitle}>{pose.name}</Text>
          <Text style={s.sideLabel}>
            {pose.side ? `${pose.side.toUpperCase()} SIDE` : " "}
          </Text>
        </View>
        <View style={s.poseArt}>
          <Illustration
            shape={pose.shape}
            side={pose.side}
            animate
            paused={paused}
          />
          <View style={s.breathePill}>
            <View style={[s.dot, paused && { backgroundColor: "#A7AC9E" }]} />
            <Text style={s.small}>
              {paused ? "Take your time" : "Breathe naturally"}
            </Text>
          </View>
        </View>
        <Text style={s.cue}>{pose.cue}</Text>
        {routine.custom && (
          <Text style={[s.small, { textAlign: "center", marginTop: 6 }]}>
            Target pose · change position at your own pace
          </Text>
        )}
        {guidance.speechStatus && (
          <Text style={[ui.error, { textAlign: "center" }]}>
            {guidance.speechStatus}
          </Text>
        )}
        <Text
          accessibilityLabel={`${position.remaining} seconds remaining`}
          style={s.timer}
        >
          {formatTime(position.remaining)}
        </Text>
        <Text style={s.timerCaption}>
          {paused
            ? "paused · resume when you’re ready"
            : "remaining in this pose"}
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: Math.floor(elapsed) }}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.floor(elapsed)}
          style={s.progress}
        >
          <View
            style={[
              s.progressFill,
              { width: `${Math.min(100, (elapsed / total) * 100)}%` },
            ]}
          />
        </View>
        <View style={s.progressLabels}>
          <Text style={s.small}>YOUR PRACTICE</Text>
          <Text style={s.small}>
            {formatTime(Math.ceil(total - elapsed))} left
          </Text>
        </View>
        <View style={s.nextCard}>
          <View style={s.nextArt}>
            <Illustration
              shape={next?.shape ?? "seated"}
              side={next?.side}
              compact
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardMood}>
              {next ? "UP NEXT" : "A QUIET FINISH"}
            </Text>
            <Text style={s.nextTitle}>
              {next ? next.name : "Practice complete"}
            </Text>
            <Text style={s.small}>
              {next
                ? `${next.side ? `${next.side} side · ` : ""}${next.seconds} sec`
                : "Take this calm with you"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={next ? "Skip to next pose" : "Finish practice"}
            style={s.iconButton}
            onPress={() => setElapsed(position.start + pose.seconds)}
          >
            <Icon kind="next" size={19} />
          </Pressable>
        </View>
      </ScrollView>
      <View style={s.practiceFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            sound ? "Mute ambient sound" : "Enable ambient sound"
          }
          accessibilityState={{ selected: sound }}
          accessibilityHint="Tap to mute or enable the selected nature recording."
          style={s.soundButton}
          onPress={() => {
            ambient.clearError();
            setSound(!sound);
          }}
        >
          <Icon kind={sound ? "sound" : "mute"} size={19} />
          <Text style={s.soundText}>
            {ambient.error
              ? "Sound unavailable"
              : !sound
                ? "Sound off"
                : !ambient.loaded
                  ? "Loading sound…"
                  : SOUND_OPTIONS.find(
                      (option) => option.id === preferences.ambient,
                    )?.name}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sound & guidance"
          style={ui.textButton}
          onPress={() => {
            setPaused(true);
            onOpenSettings();
          }}
        >
          <Text style={ui.link}>Tune</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? "Resume practice" : "Pause practice"}
          style={({ pressed }) => [s.pauseButton, pressed && s.pressed]}
          onPress={() => setPaused(!paused)}
        >
          <Icon kind={paused ? "play" : "pause"} color="white" size={27} />
        </Pressable>
      </View>
      <Modal
        visible={exitOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExitOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.dialog}>
            <Sprig size={44} />
            <Text style={s.dialogTitle}>Leave your practice?</Text>
            <Text
              style={[s.subtitle, { textAlign: "center", marginBottom: 24 }]}
            >
              Your session is paused. You can stay a little longer, or begin
              again another time.
            </Text>
            <Button
              label="Keep practicing"
              onPress={() => {
                setExitOpen(false);
                setPaused(false);
              }}
            />
            <View style={{ height: 10 }} />
            <Button
              label="End practice"
              secondary
              onPress={() => {
                ambient.stop();
                onExit();
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  shell: { flex: 1, width: "100%", maxWidth: 540, alignSelf: "center" },
  home: { paddingHorizontal: 25, paddingTop: 24, paddingBottom: 12 },
  brand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 35,
  },
  brandName: { flexDirection: "row", alignItems: "center", gap: 5 },
  wordmark: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 25,
    color: C.ink,
  },
  eyebrow: {
    fontFamily: "DMSans_500Medium",
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.muted,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 34,
  },
  title: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 48,
    lineHeight: 53,
    color: C.ink,
  },
  subtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 22,
    color: C.muted,
    marginTop: 9,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  small: { fontFamily: "DMSans_400Regular", fontSize: 11, color: C.muted },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 130,
    marginBottom: 14,
    backgroundColor: "#FDFBF6",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAE7DC",
    overflow: "hidden",
    boxShadow: "0px 4px 14px rgba(51, 58, 37, 0.035)",
  },
  selectedCard: { borderColor: "#859375", backgroundColor: "#FCFBF5" },
  cardArt: { width: "29%", height: 130, overflow: "hidden" },
  cardContent: { flex: 1, paddingLeft: 13, paddingVertical: 16 },
  cardMood: {
    fontFamily: "DMSans_500Medium",
    fontSize: 8,
    letterSpacing: 1,
    color: C.muted,
    marginBottom: 7,
  },
  cardTitle: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 25,
    color: C.ink,
    marginBottom: 8,
  },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD0C1",
    marginHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  noteText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    lineHeight: 18,
    color: C.muted,
    flex: 1,
  },
  footer: { paddingHorizontal: 25, paddingTop: 10, paddingBottom: 14 },
  selectedLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
    marginBottom: 14,
  },
  button: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: C.sage,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonText: { fontFamily: "DMSans_500Medium", fontSize: 16, color: "white" },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.line,
  },
  pressed: { opacity: 0.72 },
  footerNote: {
    fontFamily: "DMSans_400Regular",
    fontSize: 9,
    color: C.muted,
    textAlign: "center",
    marginTop: 13,
  },
  practice: { paddingHorizontal: 25, paddingTop: 10, paddingBottom: 8 },
  practiceNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 23,
    color: C.ink,
  },
  poseHeading: { alignItems: "center" },
  poseTitle: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 43,
    color: C.ink,
    marginTop: 10,
  },
  sideLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.sage,
    marginTop: 5,
  },
  poseArt: { height: 285, marginHorizontal: -25, marginTop: 3 },
  breathePill: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.paper,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.sage },
  cue: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
    paddingHorizontal: 17,
    marginTop: 16,
    minHeight: 39,
  },
  timer: {
    fontFamily: "CormorantGaramond_400Regular",
    fontSize: 66,
    lineHeight: 75,
    color: C.ink,
    textAlign: "center",
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  timerCaption: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
  },
  progress: {
    height: 4,
    backgroundColor: "#E6E5D9",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 23,
  },
  progressFill: { height: 4, backgroundColor: C.sage, borderRadius: 3 },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
    padding: 8,
    borderRadius: 14,
    backgroundColor: "#F0EFE6",
  },
  nextArt: {
    width: 65,
    height: 64,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#E4E7D8",
  },
  nextTitle: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 23,
    color: C.ink,
    marginBottom: 3,
  },
  practiceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 16,
  },
  soundButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#D8DDCD",
    borderRadius: 26,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  soundText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: C.ink },
  pauseButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: C.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(30,44,33,.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  dialog: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: C.paper,
    borderRadius: 24,
    padding: 27,
  },
  dialogTitle: {
    fontFamily: "CormorantGaramond_500Medium",
    fontSize: 33,
    color: C.ink,
    marginVertical: 12,
    textAlign: "center",
  },
  complete: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
});
