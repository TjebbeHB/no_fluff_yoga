import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Illustration } from "../Illustration";
import { usePracticeTimeline } from "../usePracticeTimeline";
import { poseFrame, sampleMotion } from "../motion";
import { useAudioGuide } from "../useAudioGuide";
import { useAmbientAudio } from "../useAmbientAudio";
import { Preferences } from "../storage";
import { SOUND_OPTIONS } from "../soundCatalog";
import { formatTime, Routine, totalSeconds } from "../routines";
import { color, font, radius, shadow, tabular, type, ui } from "../components/design";
import { Icon } from "../components/Icon";
import { Button, Dialog, IconButton, Overline } from "../components/ui";

export function Practice({
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
  const guided = preferences.guide;
  // The screen stays on, unless the audio guide is leading the practice.
  useEffect(() => {
    if (guided) return;
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
  }, [guided]);
  const [paused, setPaused] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const finished = useRef(false);
  const timeline = usePracticeTimeline(routine, paused);
  const { state } = timeline;
  const complete = state.phase === "complete";
  // The last pose stays on screen while the closing words play.
  const pose = routine.poses[Math.min(state.index, routine.poses.length - 1)],
    next = complete ? undefined : routine.poses[state.index + 1];
  const changing = state.phase === "move" || state.phase === "reposition";
  const completedHolds = routine.poses
    .slice(0, state.index)
    .reduce((sum, p) => sum + p.seconds, 0);
  const elapsed = completedHolds + (state.phase === "hold" ? state.time : 0);
  const position = {
    index: Math.min(state.index, routine.poses.length - 1),
    remaining:
      pose && !complete
        ? Math.ceil(pose.seconds - (state.phase === "hold" ? state.time : 0))
        : 0,
  };
  const total = totalSeconds(routine);
  const sound = preferences.ambientEnabled;
  const frame = pose
    ? state.phase === "move" && state.plan
      ? sampleMotion(state.plan, state.time)
      : poseFrame(pose)
    : undefined;
  const title = pose
    ? `${pose.name}${pose.side ? `, ${pose.side} side` : ""}`
    : "";
  const guide = useAudioGuide({
    routine,
    state,
    paused,
    enabled: guided,
    style: preferences.guideStyle,
    voice: preferences.voice,
    chime: preferences.chime,
    onReady: timeline.ready,
    // Straight away without the guide; after its closing words with it.
    onFinished: () => {
      if (finished.current) return;
      finished.current = true;
      ambient.stop();
      onComplete(state.activeSeconds);
    },
  });
  const ambient = useAmbientAudio({
    soundOn: sound,
    sound: preferences.ambient,
    active: !paused,
    ducking: guide.speaking,
    background: guided,
    nowPlaying: { title, artist: routine.name },
    onRemote: (playing) => setPaused(!playing),
  });
  const guidedNow = useRef(guided);
  guidedNow.current = guided;
  useEffect(() => {
    // With the audio guide on, practice carries on with the screen off.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && !guidedNow.current) setPaused(true);
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      setPaused(true);
      setExitOpen(true);
      return true;
    });
    const handleVisibility = () => {
      if (document.hidden && !guidedNow.current) setPaused(true);
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
    if (pose && !guided && !paused && state.phase === "hold")
      AccessibilityInfo.announceForAccessibility(`${title}. ${pose.cue}`);
  }, [position.index, state.phase]);
  if (!pose) return <View />;
  const holdsLeft = Math.ceil(total - elapsed);
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.practice}
      >
        <View style={s.nav}>
          <IconButton
            icon="back"
            label="Leave practice"
            onPress={() => {
              setPaused(true);
              setExitOpen(true);
            }}
          />
          <View style={s.navCenter}>
            <Text style={s.navTitle} numberOfLines={1}>
              {routine.name}
            </Text>
            <Text style={[type.caption, tabular]}>
              {position.index + 1} of {routine.poses.length} ·{" "}
              {formatTime(holdsLeft)} left
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Your practice"
          accessibilityValue={{ min: 0, max: total, now: Math.floor(elapsed) }}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.floor(elapsed)}
          style={s.progress}
        >
          {routine.poses.map((p, i) => {
            const fill = complete
              ? 1
              : i < state.index
                ? 1
                : i === state.index && state.phase === "hold"
                  ? Math.min(1, state.time / p.seconds)
                  : 0;
            return (
              <View key={i} style={[s.segment, { flexGrow: p.seconds }]}>
                <View style={[s.segmentFill, { width: `${fill * 100}%` }]} />
              </View>
            );
          })}
        </View>
        <View style={s.poseHeading}>
          <Overline tint={paused ? color.muted : color.sageDeep}>
            {complete
              ? "WELL DONE"
              : paused
                ? "A MOMENT TO PAUSE"
                : changing
                  ? "CHANGE POSITION"
                  : "BREATHE. FIND YOUR SPACE."}
          </Overline>
          <Text style={s.poseTitle}>{pose.name}</Text>
          <Text style={s.sideLabel}>
            {pose.side ? `${pose.side.toUpperCase()} SIDE` : " "}
          </Text>
        </View>
        <View style={s.poseArt}>
          <Illustration shape={pose.shape} side={pose.side} frame={frame} />
          <View style={s.breathePill}>
            <View style={[s.dot, paused && { backgroundColor: color.subtle }]} />
            <Text style={[type.caption, { color: color.text }]}>
              {complete
                ? "Rest here a moment"
                : paused
                  ? "Paused"
                  : state.phase === "move"
                    ? "Moving into position"
                    : state.phase === "reposition"
                      ? "Move at your own pace"
                      : "Breathe naturally"}
            </Text>
          </View>
        </View>
        <Text style={s.cue}>
          {state.phase === "move"
            ? frame?.label || state.plan?.label
            : state.phase === "reposition"
              ? guided
                ? "Change to the illustrated position at your own pace. The hold begins on its own after a moment, or tap when you are ready."
                : "Change to the illustrated position at your own pace. Tap when you are ready."
              : pose.cue}
        </Text>
        {state.phase === "reposition" && (
          <Button
            label="I'm in position"
            accessibilityLabel="Start pose hold"
            icon="check"
            size="md"
            disabled={paused}
            onPress={timeline.ready}
            style={{ marginTop: 14 }}
          />
        )}
        {state.queuedIndex !== null && (
          <Text style={[s.note]}>
            Next move queued · finishing this movement first
          </Text>
        )}
        <Text
          accessibilityLabel={`${position.remaining} seconds remaining`}
          style={s.timer}
        >
          {formatTime(position.remaining)}
        </Text>
        <Text style={s.timerCaption}>
          {complete
            ? "practice complete"
            : paused
              ? "paused · resume when you’re ready"
              : changing
                ? "hold starts once you’re in position"
                : "remaining in this pose"}
        </Text>
        {routine.custom && (
          <Text style={s.note}>
            Move within comfort · take extra time when needed
          </Text>
        )}
        {guided && (
          <View style={s.guideNote}>
            <Icon name="headphones" size={15} tint={color.sageDeep} />
            <Text style={[type.caption, { color: color.sageDeep }]}>
              Audio guide on · you can lock your screen
            </Text>
          </View>
        )}
        {guided && guide.problem && (
          <Text style={[ui.error, { textAlign: "center" }]}>
            The voice isn’t responding. Check your device’s text-to-speech
            settings, or install a Paradee voice in Settings.
          </Text>
        )}
        <View style={s.nextCard}>
          <View style={s.nextArt}>
            <Illustration
              shape={next?.shape ?? "seated"}
              side={next?.side}
              compact
            />
          </View>
          <View style={{ flex: 1 }}>
            <Overline style={{ marginBottom: 3 }}>
              {next ? "UP NEXT" : "A QUIET FINISH"}
            </Overline>
            <Text style={s.nextTitle} numberOfLines={1}>
              {next ? next.name : "Practice complete"}
            </Text>
            <Text style={type.caption}>
              {next
                ? `${next.side ? `${next.side} side · ` : ""}${next.seconds} sec`
                : "Take this calm with you"}
            </Text>
          </View>
          <IconButton
            icon="next"
            label={next ? "Skip to next pose" : "Finish practice"}
            onPress={timeline.skip}
            variant="outline"
            iconSize={18}
          />
        </View>
      </ScrollView>
      <View style={s.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            sound ? "Mute ambient sound" : "Enable ambient sound"
          }
          accessibilityState={{ selected: sound }}
          accessibilityHint="Tap to mute or enable the selected nature recording."
          style={({ pressed }) => [s.soundButton, pressed && s.soundPressed]}
          onPress={() => {
            ambient.clearError();
            setSound(!sound);
          }}
        >
          <Icon
            name={sound ? "sound" : "mute"}
            size={19}
            tint={sound ? color.ink : color.muted}
          />
          <Text style={[s.soundText, !sound && { color: color.muted }]}>
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
        <View style={s.footerRight}>
          <IconButton
            icon="settings"
            label="Settings"
            variant="outline"
            onPress={() => {
              setPaused(true);
              onOpenSettings();
            }}
          />
          <IconButton
            icon={paused ? "play" : "pause"}
            label={paused ? "Resume practice" : "Pause practice"}
            variant="filled"
            size={64}
            iconSize={26}
            onPress={() => setPaused(!paused)}
          />
        </View>
      </View>
      <Dialog
        visible={exitOpen}
        onRequestClose={() => setExitOpen(false)}
        title="Leave your practice?"
        body="Your session is paused. You can stay a little longer, or begin again another time."
      >
        <Button
          label="Keep practicing"
          icon="play"
          onPress={() => {
            setExitOpen(false);
            setPaused(false);
          }}
        />
        <Button
          label="End practice"
          variant="secondary"
          onPress={() => {
            ambient.stop();
            onExit();
          }}
        />
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  practice: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 12 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: -6,
  },
  navCenter: { flex: 1, alignItems: "center", gap: 1 },
  navTitle: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    color: color.ink,
  },
  progress: {
    flexDirection: "row",
    gap: 3,
    height: 4,
    marginTop: 12,
    marginBottom: 18,
  },
  segment: {
    flexBasis: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E1D5",
    overflow: "hidden",
  },
  segmentFill: { height: 4, backgroundColor: color.sage },
  poseHeading: { alignItems: "center" },
  poseTitle: {
    fontFamily: font.display,
    fontSize: 40,
    lineHeight: 46,
    color: color.ink,
    marginTop: 8,
    textAlign: "center",
  },
  sideLabel: {
    ...type.overline,
    color: color.sageDeep,
    marginTop: 4,
  },
  poseArt: { height: 280, marginHorizontal: -22, marginTop: 2 },
  breathePill: {
    position: "absolute",
    bottom: 2,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: color.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    boxShadow: shadow.card,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.sage },
  cue: {
    ...type.muted,
    textAlign: "center",
    paddingHorizontal: 10,
    marginTop: 16,
    minHeight: 42,
  },
  note: { ...type.caption, textAlign: "center", marginTop: 8 },
  guideNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  timer: {
    fontFamily: font.displayLight,
    fontSize: 64,
    lineHeight: 72,
    color: color.ink,
    textAlign: "center",
    marginTop: 8,
    ...tabular,
  },
  timerCaption: { ...type.caption, textAlign: "center" },
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    padding: 8,
    paddingRight: 12,
    borderRadius: radius.lg,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.line,
  },
  nextArt: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#E7EADC",
  },
  nextTitle: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    color: color.ink,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderColor: color.line,
    backgroundColor: color.paper,
  },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  soundButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.card,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  soundPressed: { backgroundColor: color.sunken },
  soundText: { fontFamily: font.medium, fontSize: 14, color: color.ink },
});
