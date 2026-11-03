import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond/500Medium";
import { CormorantGaramond_400Regular } from "@expo-google-fonts/cormorant-garamond/400Regular";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { LookContext } from "./src/Illustration";
import {
  materialize,
  newRoutineId,
  Preferences,
  SavedRoutine,
  useLibrary,
} from "./src/storage";
import { RoutineBuilder } from "./src/components/RoutineBuilder";
import { Settings } from "./src/components/Settings";
import { color, MAX_WIDTH, ui } from "./src/components/design";
import { LogoMark } from "./src/components/Logo";
import { Button, Dialog } from "./src/components/ui";
import { Home, Tab } from "./src/screens/Home";
import { Practice } from "./src/screens/Practice";
import { Complete } from "./src/screens/Complete";
import { copyName, Routine, routines, stepsOf } from "./src/routines";

// Keep the launch screen up until fonts and saved routines are ready.
void SplashScreen.preventAutoHideAsync().catch(() => {});

type Builder = {
  initial?: SavedRoutine;
  template?: { name: string; steps: SavedRoutine["steps"] };
};

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
  const [tab, setTab] = useState<Tab>("presets");
  const [builder, setBuilder] = useState<Builder>({});
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState<SavedRoutine | null>(null);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const ready = (fontsLoaded || !!fontError) && library.ready;
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);
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
  const savedFor = (routine: Routine) =>
    library.state.routines.find((r) => r.id === routine.id);
  const openBuilder = (next: Builder) => {
    setBuilder(next);
    setScreen("builder");
  };
  const duplicate = (routine: Routine) => {
    const saved = savedFor(routine);
    if (!saved) return;
    const copy: SavedRoutine = {
      id: newRoutineId(),
      name: copyName(
        saved.name,
        library.state.routines.map((r) => r.name),
      ),
      steps: saved.steps.map((step) => ({ ...step })),
    };
    void library
      .persist((previous) => ({
        ...previous,
        routines: [...previous.routines, copy],
      }))
      .then(() => setSelected(materialize(copy)))
      .catch(() => {});
  };
  if (!ready)
    return (
      <View style={[s.root, s.loading]}>
        <LogoMark size={88} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <LookContext.Provider
        value={{
          smile: preferences.smile,
          stripes: preferences.stripes,
          bun: preferences.bun,
        }}
      >
        <StatusBar style="dark" />
        <SafeAreaView style={s.root}>
          <View style={s.shell}>
            {screen === "home" ? (
              <Home
                presets={routines}
                custom={customRoutines}
                selected={selected}
                onSelect={setSelected}
                tab={tab}
                onTab={setTab}
                preferences={preferences}
                error={library.error}
                onOpenSettings={() => setSettings(true)}
                onStart={() => setScreen("practice")}
                onCreate={() => openBuilder({})}
                onCustomize={(routine) =>
                  openBuilder({
                    template: {
                      name: copyName(
                        routine.name,
                        library.state.routines.map((r) => r.name),
                        "my way",
                      ),
                      steps: stepsOf(routine),
                    },
                  })
                }
                onEdit={(routine) => openBuilder({ initial: savedFor(routine) })}
                onDuplicate={duplicate}
                onDelete={(routine) => setDeleting(savedFor(routine) ?? null)}
              />
            ) : screen === "builder" ? (
              <RoutineBuilder
                initial={builder.initial}
                template={builder.template}
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
              <Complete
                routine={selected}
                seconds={completedSeconds}
                onDone={() => setScreen("home")}
                onAgain={() => setScreen("practice")}
              />
            )}
            {settings && (
              <Settings
                preferences={preferences}
                onChange={changePreferences}
                onClose={() => setSettings(false)}
                error={library.error}
              />
            )}
            <Dialog
              visible={!!deleting}
              onRequestClose={() => setDeleting(null)}
              title={`Delete ${deleting?.name ?? "routine"}?`}
              body="This removes the saved routine from this device."
            >
              <Button label="Keep routine" onPress={() => setDeleting(null)} />
              <Button
                label="Delete saved routine"
                variant="danger"
                icon="trash"
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
            </Dialog>
          </View>
        </SafeAreaView>
      </LookContext.Provider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.paper },
  loading: { alignItems: "center", justifyContent: "center" },
  shell: { flex: 1, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
});
