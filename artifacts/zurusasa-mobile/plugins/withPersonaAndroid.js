const { withProjectBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

const withPersonaAndroid = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('https://sdk.withpersona.com/android/releases')) {
      return config;
    }

    const personaMaven = `        maven { url 'https://sdk.withpersona.com/android/releases' }`;
    const searchPattern = /allprojects\s*\{\s*repositories\s*\{/;
    if (searchPattern.test(config.modResults.contents)) {
      config.modResults.contents = config.modResults.contents.replace(
        searchPattern,
        `allprojects {\n    repositories {\n${personaMaven}`
      );
    }
    return config;
  });
};

module.exports = createRunOncePlugin(withPersonaAndroid, 'withPersonaAndroid', '1.0.0');
