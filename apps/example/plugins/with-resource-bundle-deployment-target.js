const { withPodfile } = require('expo/config-plugins');

const MARKER = '# [example] resource bundle deployment target';

// RN's post_install lifts IPHONEOS_DEPLOYMENT_TARGET on pod targets but not their
// resource bundles. RNSVG's bundle inherits 12.4 from its podspec, which Xcode 27
// rejects. Raise every bundle to the app's deployment target after RN runs.
//
// Stopgap: delete once react-native-svg ships the podspec fix from
// https://github.com/software-mansion/react-native-svg/pull/3022 (not in 15.15.5).
const SNIPPET = `
    ${MARKER}
    min_ios = (podfile_properties['ios.deploymentTarget'] || '16.4').to_f
    installer.target_installation_results.pod_target_installation_results.each_value do |result|
      result.resource_bundle_targets.each do |bundle|
        bundle.build_configurations.each do |config|
          current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = [min_ios, current].max.to_s
        end
      end
    end
`;

function withResourceBundleDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MARKER)) return config;

    const call = contents.indexOf('react_native_post_install(');
    if (call === -1) {
      throw new Error('Podfile has no react_native_post_install call to anchor on');
    }
    const close = contents.indexOf('\n    )\n', call);
    if (close === -1) {
      throw new Error('Could not find the end of the react_native_post_install call');
    }
    const insertAt = close + '\n    )\n'.length;

    config.modResults.contents =
      contents.slice(0, insertAt) + SNIPPET + contents.slice(insertAt);
    return config;
  });
}

module.exports = withResourceBundleDeploymentTarget;
