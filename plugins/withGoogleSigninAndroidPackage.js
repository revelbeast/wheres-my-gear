const { withMainApplication } = require("@expo/config-plugins");

module.exports = function withGoogleSigninAndroidPackage(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes("com.reactnativegooglesignin.RNGoogleSigninPackage")) {
      contents = contents.replace(
        "import com.facebook.react.defaults.DefaultReactNativeHost\n",
        "import com.facebook.react.defaults.DefaultReactNativeHost\nimport com.reactnativegooglesignin.RNGoogleSigninPackage\n"
      );
    }

    if (!contents.includes("add(RNGoogleSigninPackage())")) {
      contents = contents.replace(
        "              // add(MyReactNativePackage())",
        "              // add(MyReactNativePackage())\n              add(RNGoogleSigninPackage())"
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
