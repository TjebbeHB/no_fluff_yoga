// The project folder ("Yoga app") contains a space. Two generated iOS build
// scripts pass paths to the shell unquoted and break on it, so quote them
// whenever `expo prebuild` regenerates the native project.
const { withPodfile, withXcodeProject } = require("expo/config-plugins");

const MARK = "# Quote pod script paths (folder name has a space).";
const PODFILE_FIX = `
    ${MARK}
    installer.pods_project.targets.each do |target|
      target.shell_script_build_phases.each do |phase|
        script = phase.shell_script
        next unless script.include?('$PODS_TARGET_SRCROOT/../scripts/')
        phase.shell_script = script.gsub(%r{\\$PODS_TARGET_SRCROOT/\\.\\./scripts/[\\w.-]+}) { |m| "\\\\\\"#{m}\\\\\\"" }
      end
    end
    installer.pods_project.save
`;

module.exports = function withQuotedScriptPaths(config) {
  config = withPodfile(config, (c) => {
    if (!c.modResults.contents.includes(MARK))
      c.modResults.contents = c.modResults.contents.replace(
        /(post_install do \|installer\|[\s\S]*?react_native_post_install\([\s\S]*?\n\s*\)\n)/,
        `$1${PODFILE_FIX}`,
      );
    return c;
  });
  return withXcodeProject(config, (c) => {
    const phases = c.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    for (const phase of Object.values(phases)) {
      if (typeof phase !== "object" || !phase.shellScript) continue;
      phase.shellScript = phase.shellScript.replace(
        /`(\\"\$NODE_BINARY\\" --print \\"[^`]*react-native-xcode\.sh'\\")`/,
        '\\"$($1)\\"',
      );
    }
    return c;
  });
};
