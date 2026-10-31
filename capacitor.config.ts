export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
  };
  android?: {
    buildOptions?: {
      keystorePath?: string;
      keystoreAlias?: string;
    };
  };
  plugins?: Record<string, any>;
}
const config: CapacitorConfig = {
  appId: 'com.nexaearn.app',
  appName: 'NEXA EARN',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: 'release-key.jks',
      keystoreAlias: 'nexa-earn',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0B0914',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#F59E0B',
    },
  },
};

export default config;
