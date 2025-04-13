const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

/* Clean compiler that only wipes the folder */
const clean = {
  name: "clean",
  mode: "production",
  output: { path: path.resolve(__dirname, "dist") },
  plugins: [ new CleanWebpackPlugin() ]
};

/* UI compiler (without CleanWebpackPlugin) */
const ui = {
  name: 'ui',
  mode: "production",
  devtool: "source-map",
  entry: {
    content: "./src/content/index.ts",
    popup: "./src/popup/popup.ts",
    options: "./src/options/options.ts",
    sidepanel: "./src/sidepanel/index.ts",
    blocked: "./src/blocked.ts" // ← add this line
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js"
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/popup/popup.html", to: "popup.html" },
        { from: "src/options/options.html", to: "options.html" },
        { from: "src/sidepanel/index.html", to: "sidepanel.html" },
        { from: "src/blocked.html", to: "blocked.html" },
        { from: "src/onboarding.html", to: "onboarding.html", noErrorOnMissing: true },
        { from: "manifest.json", to: "manifest.json" },
        { from: "icons", to: "icons" },
        { from: "src/sounds", to: "sounds", noErrorOnMissing: true }
      ]
    })
  ]
};

/* Background compiler */
const bg = {
  name: 'bg',
  mode: 'production',
  target: 'webworker',
  devtool: 'source-map',
  entry: { background: './src/background/index.ts' },
  output: { 
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js' 
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: { 
    rules: [{ 
      test: /\.tsx?$/, 
      use: 'ts-loader', 
      exclude: /node_modules/ 
    }] 
  }
};

/* Export all three - webpack will run them in order */
module.exports = [clean, ui, bg];