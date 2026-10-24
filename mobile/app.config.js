/**
 * app.json, plus what depends on the environment.
 *
 * Google sign-in on iPhone needs a URL scheme made from the iOS OAuth
 * client id (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, see
 * src/auth/googleSignIn.ts), and its config plugin refuses to run without
 * one, so the plugin is only added once that id is set. Android needs
 * nothing from the plugin.
 */

const GOOGLE_PLUGIN = '@react-native-google-signin/google-signin';

module.exports = ({ config }) => {
  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();
  if (!iosClientId) return config;
  const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return {
    ...config,
    plugins: [...(config.plugins ?? []), [GOOGLE_PLUGIN, { iosUrlScheme: `com.googleusercontent.apps.${id}` }]],
  };
};
