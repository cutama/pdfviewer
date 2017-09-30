const srcDir = __dirname + '/src';
const distDir = __dirname + '/dist';
const libraryName = 'PdfViewer';
const outputFileName = 'pdfviewer.js';

module.exports = {
  entry: srcDir + '/PdfViewer.jsx',
  output: {
    path: distDir,
    filename: outputFileName,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  },
  module: {
    rules: [
      {
        test: /pdf\.worker(\.min)?\.js$/,
        use: 'raw-loader'
      },
      {
        test: /\.jsx?$/,
        exclude: [/node_modules/, /pdf\.worker(\.min)?\.js$/],
        use: 'babel-loader'
      },
      {
        test: /\.styl$/,
        use: ['style-loader', 'css-loader', 'stylus-loader']
      }
    ],
  }
}